"""
シラバスCSVを Supabase に投入するスクリプト
使い方:
  python upload_to_supabase.py <faculty> [spring|fall]
例:
  python upload_to_supabase.py social_sciences spring
  python upload_to_supabase.py letters spring
  python upload_to_supabase.py culture_community spring
"""

import csv
import os
import re
import sys
import time
import requests
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ .env に SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください")
    sys.exit(1)

BATCH_SIZE = 100

# 学部: slug -> 表示名
FACULTIES = {
    "politics_economics": "政経",
    "law": "法学",
    "education": "教育",
    "commerce": "商",
    "social_sciences": "社学",
    "human_sciences": "人科",
    "sport_sciences": "スポーツ",
    "international": "国際教養",
    "culture_community": "文構",
    "letters": "文",
    "human_correspondence": "人通",
    "fundamental_sci": "基幹",
    "creative_sci": "創造",
    "advanced_sci": "先進",
}

TERM_CONFIG = {
    "spring": {"default_term": "春学期"},
    "fall":   {"default_term": "秋学期"},
}

# classes 用: upsert
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates,return=minimal",
}

# class_slots 用: 純 INSERT（id がないので merge-duplicates は使えない）
HEADERS_INSERT = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

# DELETE 用
DELETE_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

# ---------------- パース ----------------
DAY_MAP = {"月": 1, "火": 2, "水": 3, "木": 4, "金": 5, "土": 6, "日": 7}
KANJI_NUM_MAP = {
    "一": 1,
    "二": 2,
    "三": 3,
    "四": 4,
    "五": 5,
    "六": 6,
    "七": 7,
}
ZEN_TO_HAN = str.maketrans("０１２３４５６７８９①②③④⑤⑥⑦", "01234567891234567")

def parse_schedule(schedule: str) -> list[tuple[int, int]]:
    if not schedule:
        return []
    s = str(schedule).translate(ZEN_TO_HAN)
    s = re.sub(r"\s+", " ", s)
    pattern = re.compile(r"([月火水木金土日])\s*([1-7一二三四五六七])\s*(?:時限|限|時限目|限目)?")
    matches = pattern.findall(s)
    slots = []
    seen = set()
    for day_kanji, period_raw in matches:
        day = DAY_MAP.get(day_kanji)
        period = KANJI_NUM_MAP.get(period_raw)
        if period is None:
            try:
                period = int(period_raw)
            except ValueError:
                continue
        if day is None or not (1 <= period <= 7):
            continue
        key = (day, period)
        if key in seen:
            continue
        seen.add(key)
        slots.append(key)
    return slots

def parse_course_codes(raw: str) -> list[str]:
    if not raw:
        return []
    return [c for c in raw.split() if c]

def parse_year(raw: str) -> int | None:
    try:
        return int(raw)
    except (ValueError, TypeError):
        return None

def parse_credits(raw: str) -> float | None:
    if not raw:
        return None
    s = str(raw).strip()
    s = re.sub(r"[^\d.]", "", s)
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None

def empty_to_none(s: str | None) -> str | None:
    if s is None:
        return None
    s = s.strip()
    return s if s else None

# ---------------- Supabase 通信 ----------------
def post_batch(table: str, rows: list[dict]) -> None:
    """classes 用 upsert"""
    if not rows:
        return
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    res = requests.post(url, headers=HEADERS, json=rows, timeout=60)
    if res.status_code >= 300:
        print(f"❌ {table} への投入に失敗: HTTP {res.status_code}")
        print("    レスポンス:", res.text[:500])
        sys.exit(1)

def insert_batch(table: str, rows: list[dict]) -> None:
    """class_slots 用 純 INSERT"""
    if not rows:
        return
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    res = requests.post(url, headers=HEADERS_INSERT, json=rows, timeout=60)
    if res.status_code >= 300:
        print(f"❌ {table} への投入に失敗: HTTP {res.status_code}")
        print("    レスポンス:", res.text[:500])
        sys.exit(1)

def delete_slots_by_class_ids(class_ids: list[str]) -> None:
    """指定した class_id リストの slots を削除（学部単位で消す）"""
    if not class_ids:
        return
    # Supabase の in フィルタ: ?class_id=in.(id1,id2,...)
    # 件数が多いと URL が長くなるので 500 件ずつ分割
    chunk_size = 500
    total_deleted = 0
    for i in range(0, len(class_ids), chunk_size):
        chunk = class_ids[i:i + chunk_size]
        ids_str = ",".join(chunk)
        url = f"{SUPABASE_URL}/rest/v1/class_slots"
        params = {"class_id": f"in.({ids_str})"}
        res = requests.delete(url, headers=DELETE_HEADERS, params=params, timeout=60)
        if res.status_code >= 300:
            print(f"⚠ class_slots 削除に失敗: HTTP {res.status_code}")
            print("    レスポンス:", res.text[:300])
        else:
            total_deleted += len(chunk)
    print(f"    → {total_deleted} class_id 分の既存 slot を削除")

# ---------------- メイン ----------------
def main():
    if len(sys.argv) < 2 or sys.argv[1] not in FACULTIES:
        print("Usage: python upload_to_supabase.py <faculty> [spring|fall]")
        print(f"  faculties: {', '.join(FACULTIES.keys())}")
        sys.exit(1)

    faculty_slug = sys.argv[1]
    term_key = sys.argv[2] if len(sys.argv) >= 3 else "spring"
    if term_key not in TERM_CONFIG:
        print(f"未知の学期: {term_key}")
        sys.exit(1)

    faculty_label = FACULTIES[faculty_slug]
    csv_path = f"{faculty_slug}_{term_key}.csv"
    default_term = TERM_CONFIG[term_key]["default_term"]

    if not os.path.exists(csv_path):
        print(f"❌ CSVが見つかりません: {csv_path}")
        sys.exit(1)

    print(f"=== {faculty_label} ({faculty_slug}) / {term_key} ({default_term}) ===")
    print(f"入力CSV: {csv_path}")

    print("[1/5] CSV を読み込み")
    with open(csv_path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    print(f"    {len(rows)} 行")

    print("[2/5] 整形")
    classes_payload = []
    slots_payload = []
    skipped_no_id = 0
    seen_ids = set()
    duplicate_ids = 0
    unparsed_schedules: list[tuple[str, str, str]] = []

    for r in rows:
        p_key = r.get("p_key", "").strip()
        if not p_key:
            skipped_no_id += 1
            continue
        if p_key in seen_ids:
            duplicate_ids += 1
            continue
        seen_ids.add(p_key)

        course_codes = parse_course_codes(r.get("course_code", ""))
        year = parse_year(r.get("year", ""))
        term = r.get("term", "").strip() or None

        classes_payload.append({
            "id": p_key,
            "course_codes": course_codes,
            "name": r.get("name", "").strip(),
            "teacher": empty_to_none(r.get("teacher")),
            "faculty": faculty_label,
            "faculty_slug": faculty_slug,
            "term": term,
            "campus": empty_to_none(r.get("campus")),
            "credits": parse_credits(r.get("credits", "")),
            "class_format": empty_to_none(r.get("method_type")),
            "language": empty_to_none(r.get("language")),
            "syllabus_url": None,
            "summary": empty_to_none(r.get("summary")) or empty_to_none(r.get("summary_excerpt")),
            "classroom": empty_to_none(r.get("classroom")),
            "year": year,
            "subtitle": empty_to_none(r.get("subtitle")),
            "goal": empty_to_none(r.get("goal")),
            "study_outside": empty_to_none(r.get("study_outside")),
            "schedule_plan": empty_to_none(r.get("schedule_plan")),
            "textbook": empty_to_none(r.get("textbook")),
            "reference": empty_to_none(r.get("reference")),
            "grading_method": empty_to_none(r.get("grading_method")),
            "notes_url": empty_to_none(r.get("notes_url")),
            "course_code_full": empty_to_none(r.get("course_code_full")),
            "major_field": empty_to_none(r.get("major_field")),
            "middle_field": empty_to_none(r.get("middle_field")),
            "minor_field": empty_to_none(r.get("minor_field")),
            "level": empty_to_none(r.get("level")),
            "subject_category": empty_to_none(r.get("subject_category")),
            "year_assignment": empty_to_none(r.get("year_assignment")),
            "method_type": empty_to_none(r.get("method_type")),
        })

        schedule = r.get("schedule", "")
        parsed_slots = parse_schedule(schedule)
        if schedule.strip() and not parsed_slots and "無" not in schedule:
            unparsed_schedules.append((
                p_key,
                r.get("name", "").strip(),
                schedule.strip(),
            ))

        for day, period in parsed_slots:
            slots_payload.append({
                "class_id": p_key,
                "term": term or default_term,
                "day_of_week": day,
                "period": period,
            })

    print(f"    classes: {len(classes_payload)} 件")
    print(f"    class_slots: {len(slots_payload)} 件")
    if skipped_no_id:
        print(f"    ⚠ p_key 空: {skipped_no_id} 件")
    if duplicate_ids:
        print(f"    ⚠ p_key 重複スキップ: {duplicate_ids} 件")
    if unparsed_schedules:
        print(f"    ⚠ schedule を slot 化できなかった行: {len(unparsed_schedules)} 件")
        for p_key, name, schedule in unparsed_schedules[:10]:
            print(f"      - {p_key} / {name}: {schedule}")
        if len(unparsed_schedules) > 10:
            print(f"      ...ほか {len(unparsed_schedules) - 10} 件")

    # [3/5] この学部の class_id に紐づく slots だけ削除
    print("[3/5] 既存slotを学部単位で削除")
    all_class_ids = [r["id"] for r in classes_payload]
    delete_slots_by_class_ids(all_class_ids)
    time.sleep(0.5)

    print("[4/5] classes をアップロード（merge-duplicates でUPSERT）")
    for i in range(0, len(classes_payload), BATCH_SIZE):
        batch = classes_payload[i:i + BATCH_SIZE]
        post_batch("classes", batch)
        print(f"      → {i + len(batch)} / {len(classes_payload)}")
        time.sleep(0.3)

    print("[5/5] class_slots をアップロード（純 INSERT）")
    for i in range(0, len(slots_payload), BATCH_SIZE):
        batch = slots_payload[i:i + BATCH_SIZE]
        insert_batch("class_slots", batch)
        print(f"      → {i + len(batch)} / {len(slots_payload)}")
        time.sleep(0.3)

    print(f"\nDone: {faculty_label} / {term_key}")


if __name__ == "__main__":
    main()
