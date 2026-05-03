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
    "politics_economics":   "政経",
    "law":                  "法学",
    "education":            "教育",
    "commerce":             "商",
    "social_sciences":      "社学",
    "human_sciences":       "人科",
    "sport_sciences":       "スポーツ",
    "international":        "国際教養",
    "culture_community":    "文構",
    "letters":              "文",
    "human_correspondence": "人通",
    "fundamental_sci":      "基幹",
    "creative_sci":         "創造",
    "advanced_sci":         "先進",
}

TERM_CONFIG = {
    "spring": {"default_term": "春学期"},
    "fall":   {"default_term": "秋学期"},
}


HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates,return=minimal",
}

DELETE_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}


# ---------------- パース ----------------
DAY_MAP = {"月": 1, "火": 2, "水": 3, "木": 4, "金": 5, "土": 6, "日": 7}
ZEN_TO_HAN = str.maketrans("0123456789", "0123456789")


def parse_schedule(schedule: str) -> list[tuple[int, int]]:
    if not schedule:
        return []
    s = schedule.translate(ZEN_TO_HAN)
    pattern = re.compile(r"([月火水木金土日])\s*(\d+)\s*時限")
    matches = pattern.findall(s)
    slots = []
    seen = set()
    for day_kanji, period_str in matches:
        day = DAY_MAP.get(day_kanji)
        try:
            period = int(period_str)
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
    """'2' や '2.0' を float に。空や非数値は None"""
    if not raw:
        return None
    s = str(raw).strip()
    s = re.sub(r"[^\d.]", "", s)  # 「2単位」のような文字は削る
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
    if not rows:
        return
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    res = requests.post(url, headers=HEADERS, json=rows, timeout=60)
    if res.status_code >= 300:
        print(f"❌ {table} への投入に失敗: HTTP {res.status_code}")
        print("    レスポンス:", res.text[:500])
        sys.exit(1)


def delete_classes_by_faculty_slug(faculty_slug: str) -> None:
    """指定faculty_slugのclassesを削除（再投入時のクリーンアップ用）"""
    url = f"{SUPABASE_URL}/rest/v1/classes"
    params = {"faculty_slug": f"eq.{faculty_slug}"}
    res = requests.delete(url, headers=DELETE_HEADERS, params=params, timeout=60)
    if res.status_code >= 300:
        print(f"⚠ classes(faculty_slug={faculty_slug}) の削除に失敗: HTTP {res.status_code}")
        print("    レスポンス:", res.text[:500])
    else:
        print(f"      → faculty_slug='{faculty_slug}' の既存classesを削除")


def delete_slots_by_term(term_label: str) -> None:
    url = f"{SUPABASE_URL}/rest/v1/class_slots"
    params = {"term": f"eq.{term_label}"}
    res = requests.delete(url, headers=DELETE_HEADERS, params=params, timeout=60)
    if res.status_code >= 300:
        print(f"⚠ class_slots(term={term_label}) の削除に失敗: HTTP {res.status_code}")
        print("    レスポンス:", res.text[:500])
    else:
        print(f"      → term='{term_label}' の既存slot削除")


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

        # 詳細フィールド: 空なら None
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
            # シラバス詳細
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

        for day, period in parse_schedule(r.get("schedule", "")):
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

    print("[3/5] 既存slotを学期単位で削除")
    used_terms = set(s["term"] for s in slots_payload)
    print(f"    対象 term: {used_terms}")
    for t in used_terms:
        delete_slots_by_term(t)
        time.sleep(0.3)

    print("[4/5] classes をアップロード（merge-duplicates でUPSERT）")
    for i in range(0, len(classes_payload), BATCH_SIZE):
        batch = classes_payload[i:i + BATCH_SIZE]
        post_batch("classes", batch)
        print(f"      → {i + len(batch)} / {len(classes_payload)}")
        time.sleep(0.3)

    print("[5/5] class_slots をアップロード")
    for i in range(0, len(slots_payload), BATCH_SIZE):
        batch = slots_payload[i:i + BATCH_SIZE]
        post_batch("class_slots", batch)
        print(f"      → {i + len(batch)} / {len(slots_payload)}")
        time.sleep(0.3)

    print(f"\n✅ 完了: {faculty_label} / {term_key}")


if __name__ == "__main__":
    main()