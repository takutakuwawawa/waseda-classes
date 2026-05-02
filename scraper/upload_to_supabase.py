"""
social_sciences_spring.csv を Supabase に投入するスクリプト
- classes テーブル: 1授業1行
- class_slots テーブル: 曜日時限を分解して複数行
"""

import csv
import os
import re
import sys
import time
import requests
from dotenv import load_dotenv

# ---------------- 環境変数 ----------------
load_dotenv()
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ .env に SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください")
    sys.exit(1)

CSV_PATH = "social_sciences_spring.csv"
FACULTY_NAME = "社学"  # 今回投入する学部
BATCH_SIZE = 100        # 1リクエストでまとめて送る件数

# ---------------- ヘッダ ----------------
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates,return=minimal",
}

# ---------------- パース関数 ----------------

# 曜日漢字→数値
DAY_MAP = {"月": 1, "火": 2, "水": 3, "木": 4, "金": 5, "土": 6, "日": 7}

# 全角→半角の数字対応
ZEN_TO_HAN = str.maketrans("０１２３４５６７８９", "0123456789")


def parse_schedule(schedule: str) -> list[tuple[int, int]]:
    """
    '01:月１時限 02:水１時限' のような文字列を [(1,1), (3,1)] にする
    返り値: [(day_of_week, period), ...]
    """
    if not schedule:
        return []
    # 全角→半角に変換
    s = schedule.translate(ZEN_TO_HAN)
    # 「(曜日漢字)(数字)時限」のパターンを全部抽出
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
        if day is None:
            continue
        if not (1 <= period <= 7):
            continue
        key = (day, period)
        if key in seen:
            continue
        seen.add(key)
        slots.append(key)
    return slots


def parse_course_codes(raw: str) -> list[str]:
    """空白区切りのコースコード文字列を配列にする"""
    if not raw:
        return []
    return [c for c in raw.split() if c]


def parse_year(raw: str) -> int | None:
    try:
        return int(raw)
    except (ValueError, TypeError):
        return None


# ---------------- Supabaseへの送信 ----------------

def post_batch(table: str, rows: list[dict]) -> None:
    """指定テーブルにrowsをまとめてPOST"""
    if not rows:
        return
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    res = requests.post(url, headers=HEADERS, json=rows, timeout=60)
    if res.status_code >= 300:
        print(f"❌ {table} への投入に失敗: HTTP {res.status_code}")
        print("    レスポンス:", res.text[:500])
        sys.exit(1)


# ---------------- メイン ----------------

def main():
    print("[1/3] CSV を読み込み")
    with open(CSV_PATH, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    print(f"    {len(rows)} 行を読み込みました")

    print("[2/3] classes テーブル用と class_slots テーブル用にデータを整形")
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

        classes_payload.append({
            "id": p_key,
            "course_codes": course_codes,
            "name": r.get("name", "").strip(),
            "teacher": r.get("teacher", "").strip() or None,
            "faculty": FACULTY_NAME,
            "term": term,
            "campus": None,
            "credits": None,
            "class_format": None,
            "language": None,
            "syllabus_url": None,
            "summary": r.get("summary_excerpt", "").strip() or None,
            "classroom": r.get("classroom", "").strip() or None,
            "year": year,
        })

        # 曜日時限を分解
        slots = parse_schedule(r.get("schedule", ""))
        for day, period in slots:
            slots_payload.append({
                "class_id": p_key,
                "term": term or "春学期",
                "day_of_week": day,
                "period": period,
            })

    print(f"    classes: {len(classes_payload)} 件")
    print(f"    class_slots: {len(slots_payload)} 件")
    if skipped_no_id:
        print(f"    ⚠ p_key が空で除外: {skipped_no_id} 件")
    if duplicate_ids:
        print(f"    ⚠ p_key 重複でスキップ: {duplicate_ids} 件")

    print("[3/3] Supabase に投入")
    print("    classes をアップロード中...")
    for i in range(0, len(classes_payload), BATCH_SIZE):
        batch = classes_payload[i:i + BATCH_SIZE]
        post_batch("classes", batch)
        print(f"      → {i + len(batch)} / {len(classes_payload)}")
        time.sleep(0.3)

    print("    class_slots をアップロード中...")
    for i in range(0, len(slots_payload), BATCH_SIZE):
        batch = slots_payload[i:i + BATCH_SIZE]
        post_batch("class_slots", batch)
        print(f"      → {i + len(batch)} / {len(slots_payload)}")
        time.sleep(0.3)

    print("\n✅ 完了: Supabase への投入が成功しました")


if __name__ == "__main__":
    main()