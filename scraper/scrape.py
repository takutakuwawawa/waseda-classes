"""
早稲田大学シラバス スクレイパー（社会科学部・春学期）
- 検索結果リスト画面から、コースコード・科目名・教員名・曜日時限を取得
- リクエスト間に1.5秒のウェイトを入れる
- 結果は social_sciences_spring.csv に保存
"""

import csv
import re
import time
import requests
from bs4 import BeautifulSoup

# ---------------- 設定 ----------------
BASE_URL = "https://www.wsl.waseda.jp/syllabus/index.php"
GAKUBU_CODE = "181966"   # 社学
GAKKI_CODE = "1"         # 春学期・夏学期
PAGE_SIZE = 100          # 1ページあたりの表示件数
SLEEP_SEC = 1.5          # リクエスト間のウェイト
OUTPUT_CSV = "social_sciences_spring.csv"

# ---------------- セッション ----------------
session = requests.Session()
session.headers.update({
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0 Safari/537.36"
    ),
    "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
})


def build_search_payload(page_num: int) -> dict:
    """検索POSTリクエストのフォームデータを組み立てる"""
    return {
        "ControllerParameters": "JAA103SubCon",
        "pfrontPage": "now",
        "p_number": str(PAGE_SIZE),
        "p_page": str(page_num) if page_num > 1 else "",
        "p_gakubu": GAKUBU_CODE,
        "p_gakki": GAKKI_CODE,
        "p_youbi": "",
        "p_jigen": "",
        "p_gengo": "",
        "keyword": "",
        "kamoku": "",
        "kyoin": "",
        "pClsOpnSts": "123",
        "pLng": "jp",
    }


def parse_total_count(soup: BeautifulSoup) -> int | None:
    """『全458件中…』のような表記から総件数をパース"""
    text = soup.get_text(" ", strip=True)
    m = re.search(r"全\s*(\d+)\s*件中", text)
    return int(m.group(1)) if m else None


def parse_results_table(soup: BeautifulSoup) -> list[dict]:
    """検索結果のテーブルをパースして、授業の行リストを返す"""
    rows = []

    # 結果テーブルは <table class="ct-vh"> または ct-vh の中にある
    # 各授業の行は、科目名リンクの onclick に "JAA104DtlSubCon" を持つ
    course_links = soup.find_all(
        "a",
        onclick=lambda v: v and "JAA104DtlSubCon" in v,
    )

    for link in course_links:
        tr = link.find_parent("tr")
        if not tr:
            continue
        cells = [c.get_text(" ", strip=True) for c in tr.find_all("td")]
        if len(cells) < 7:
            continue

        # onclickから pKey を抜き出す（後で詳細ページに使う）
        m = re.search(r"post_submit\(\s*'[^']+'\s*,\s*'([^']+)'", link["onclick"])
        p_key = m.group(1) if m else ""

        # セルの並び:
        # [開講年度, コースコード, 科目名, 担当教員, 開講学部, 学期, 曜日時限, 使用教室, 授業概要]
        rows.append({
            "year": cells[0],
            "course_code": cells[1],
            "name": cells[2],
            "teacher": cells[3],
            "faculty": cells[4],
            "term": cells[5],
            "schedule": cells[6],
            "classroom": cells[7] if len(cells) > 7 else "",
            "summary_excerpt": cells[8] if len(cells) > 8 else "",
            "p_key": p_key,
        })

    return rows


def fetch_page(page_num: int) -> tuple[list[dict], int | None]:
    """1ページ分の検索結果を取得"""
    payload = build_search_payload(page_num)
    print(f"  → POST page={page_num} ...", flush=True)
    res = session.post(BASE_URL, data=payload, timeout=30)
    res.raise_for_status()
    res.encoding = res.apparent_encoding or "utf-8"
    soup = BeautifulSoup(res.text, "html.parser")
    rows = parse_results_table(soup)
    total = parse_total_count(soup)
    return rows, total


def main():
    print("[1/3] シラバスサイトに接続して初期セッションを確立")
    # トップページに一度GETしてCookieなどを確立
    session.get("https://www.wsl.waseda.jp/syllabus/JAA101.php", timeout=30)
    time.sleep(SLEEP_SEC)

    print("[2/3] 1ページ目を取得して総件数を確認")
    all_rows: list[dict] = []
    page1_rows, total = fetch_page(1)
    all_rows.extend(page1_rows)
    print(f"    1ページ目: {len(page1_rows)} 件取得")
    if total is None:
        print("    ⚠ 総件数の取得に失敗しました。1ページ目のみで終了します。")
        total_pages = 1
    else:
        print(f"    総件数: {total} 件")
        total_pages = (total + PAGE_SIZE - 1) // PAGE_SIZE

    print(f"[3/3] 残りのページ（2〜{total_pages}）を順番に取得")
    for page in range(2, total_pages + 1):
        time.sleep(SLEEP_SEC)
        rows, _ = fetch_page(page)
        print(f"    ページ {page}: {len(rows)} 件取得")
        all_rows.extend(rows)

    # CSVに書き出し
    if not all_rows:
        print("⚠ 0件しか取得できませんでした。HTMLパース部分の修正が必要かもしれません。")
        return

    fieldnames = list(all_rows[0].keys())
    with open(OUTPUT_CSV, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_rows)

    print(f"\n✅ 完了: 合計 {len(all_rows)} 件を {OUTPUT_CSV} に保存しました")


if __name__ == "__main__":
    main()
