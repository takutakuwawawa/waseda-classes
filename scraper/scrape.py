"""
早稲田大学シラバス スクレイパー（複数学部対応 + 詳細キャッシュ）

使い方:
    python scrape.py <faculty> [<faculty> ...] [spring|fall]
    python scrape.py all [spring|fall]

  - 学期は最後の引数で指定。省略時は spring
  - 複数学部を指定すると、詳細フェッチがグループ全体で共有される
  - 同じ科目キー（A/B/C等のクラス違い）も詳細フェッチを1回に集約

例:
    python scrape.py international
    python scrape.py letters culture_community fall
    python scrape.py gec spring
    python scrape.py fundamental_sci creative_sci advanced_sci
    python scrape.py all fall
"""

import csv
import re
import sys
import time
import requests
from bs4 import BeautifulSoup


# ---------------- 設定 ----------------
BASE_URL   = "https://www.wsl.waseda.jp/syllabus/index.php"
INDEX_URL  = "https://www.wsl.waseda.jp/syllabus/JAA101.php"
DETAIL_URL = "https://www.wsl.waseda.jp/syllabus/JAA104.php"
PAGE_SIZE = 100
SLEEP_SEC = 2.5
DETAIL_SLEEP_SEC = 1.2
FACULTY_SLEEP_SEC = 10.0
DEFAULT_TERM = "spring"

TERM_CONFIG = {
    "spring": {"gakki": "1", "label": "春学期・夏学期"},
    "fall":   {"gakki": "2", "label": "秋学期・冬学期"},
}

FACULTIES = {
    "politics_economics":   {"code": "111973", "label": "政経"},
    "law":                  {"code": "121973", "label": "法学"},
    "education":            {"code": "151949", "label": "教育"},
    "commerce":             {"code": "161973", "label": "商学"},
    "social_sciences":      {"code": "181966", "label": "社学"},
    "human_sciences":       {"code": "192000", "label": "人科"},
    "sport_sciences":       {"code": "202003", "label": "スポーツ"},
    "international":        {"code": "212004", "label": "国際教養"},
    "culture_community":    {"code": "232006", "label": "文構"},
    "letters":              {"code": "242006", "label": "文"},
    "human_correspondence": {"code": "252020", "label": "人通"},
    "fundamental_sci":      {"code": "262006", "label": "基幹"},
    "creative_sci":         {"code": "272006", "label": "創造"},
    "advanced_sci":         {"code": "282006", "label": "先進"},
    "global_education":     {"code": "9S2013", "label": "GEC"},
}

FACULTY_ALIASES = {
    "gec": "global_education",
}

# 詳細ページから取り出したい「シラバス内容（クラス間で共有可）」のフィールド。
# クラス別情報（教員・教室・時限など）は一覧から取れるのでここには含めない。
DETAIL_FIELDS = {
    # シラバス情報
    "副題":                 "subtitle",
    "授業概要":             "summary",
    "授業の到達目標":       "goal",
    "事前・事後学習の内容": "study_outside",
    "授業計画":             "schedule_plan",
    "教科書":               "textbook",
    "参考文献":             "reference",
    "成績評価方法":         "grading_method",
    "備考・関連URL":        "notes_url",
    # 授業情報のうち、シラバス共通項目
    "コース・コード":       "course_code_full",
    "大分野名称":           "major_field",
    "中分野名称":           "middle_field",
    "小分野名称":           "minor_field",
    "レベル":               "level",
    "科目区分":             "subject_category",
    "配当年次":             "year_assignment",
    "単位数":               "credits",
    "授業で使用する言語":   "language",
    "授業方法区分":         "method_type",
}


# ---------------- セッション ----------------
session = requests.Session()
session.headers.update({
    "User-Agent": (
        "WasedaClassesScraper/1.0 "
        "(personal syllabus search project; "
        "+https://github.com/takutakuwawawa/waseda-classes)"
    ),
    "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
})


# ---------------- 一覧 ----------------
def build_search_payload(page_num: int, gakki_code: str, gakubu_code: str) -> dict:
    return {
        "ControllerParameters": "JAA103SubCon",
        "pfrontPage": "now",
        "p_number": str(PAGE_SIZE),
        "p_page": str(page_num) if page_num > 1 else "",
        "p_gakubu": gakubu_code,
        "p_gakki": gakki_code,
        "p_youbi": "", "p_jigen": "", "p_gengo": "",
        "keyword": "", "kamoku": "", "kyoin": "",
        "pClsOpnSts": "123", "pLng": "jp",
    }


def parse_total_count(soup: BeautifulSoup) -> int | None:
    text = soup.get_text(" ", strip=True)
    m = re.search(r"全\s*(\d+)\s*件中", text)
    return int(m.group(1)) if m else None


def parse_results_table(soup: BeautifulSoup) -> list[dict]:
    rows = []
    for link in soup.find_all("a", onclick=lambda v: v and "JAA104DtlSubCon" in v):
        tr = link.find_parent("tr")
        if not tr:
            continue
        cells = [c.get_text(" ", strip=True) for c in tr.find_all("td")]
        if len(cells) < 7:
            continue
        m = re.search(r"post_submit\(\s*'[^']+'\s*,\s*'([^']+)'", link["onclick"])
        p_key = m.group(1) if m else ""
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


def fetch_page(page_num: int, gakki_code: str, gakubu_code: str) -> tuple[list[dict], int | None]:
    payload = build_search_payload(page_num, gakki_code, gakubu_code)
    print(f"  → 一覧 POST page={page_num} ...", flush=True)
    for attempt in range(2):
        try:
            res = session.post(BASE_URL, data=payload, timeout=30)
            res.raise_for_status()
            res.encoding = res.apparent_encoding or "utf-8"
            soup = BeautifulSoup(res.text, "html.parser")
            return parse_results_table(soup), parse_total_count(soup)
        except requests.RequestException as e:
            if attempt == 0:
                print(f"    ⚠ 一覧失敗: {e} → 30秒待って再試行")
                time.sleep(30)
            else:
                raise


def fetch_list_only(faculty_slug: str, term: dict) -> list[dict]:
    fac = FACULTIES[faculty_slug]
    print(f"\n--- {fac['label']} ({faculty_slug}) 一覧取得 ---")
    session.get(INDEX_URL, timeout=30)
    time.sleep(SLEEP_SEC)

    list_rows: list[dict] = []
    page1_rows, total = fetch_page(1, term["gakki"], fac["code"])
    list_rows.extend(page1_rows)
    print(f"    1ページ目: {len(page1_rows)} 件")
    if total is None:
        return list_rows

    total_pages = (total + PAGE_SIZE - 1) // PAGE_SIZE
    print(f"    総件数: {total} 件 / {total_pages} ページ")
    for page in range(2, total_pages + 1):
        time.sleep(SLEEP_SEC)
        rows, _ = fetch_page(page, term["gakki"], fac["code"])
        print(f"    ページ {page}: {len(rows)} 件")
        list_rows.extend(rows)
    return list_rows


# ---------------- 詳細 ----------------
def parse_detail(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    raw: dict[str, str] = {}
    for table in soup.find_all("table"):
        for tr in table.find_all("tr"):
            cells = [c for c in tr.children if getattr(c, "name", None) in ("th", "td")]
            i = 0
            while i < len(cells) - 1:
                if cells[i].name == "th" and cells[i + 1].name == "td":
                    label = cells[i].get_text(" ", strip=True)
                    td = cells[i + 1]
                    for br in td.find_all("br"):
                        br.replace_with("\n")
                    val = td.get_text("\n", strip=True)
                    val = re.sub(r"[ \t]+", " ", val)
                    val = re.sub(r"\n{3,}", "\n\n", val)
                    val = val.replace("\u2028", "\n").replace("\u2029", "\n\n")
                    if label:
                        if label in raw and val:
                            raw[label] = raw[label] + "\n---\n" + val
                        elif val or label not in raw:
                            raw[label] = val
                    i += 2
                else:
                    i += 1

    result = {col: "" for col in DETAIL_FIELDS.values()}
    for jp, en in DETAIL_FIELDS.items():
        if jp in raw:
            result[en] = raw[jp]
    return result


def fetch_detail(p_key: str) -> dict:
    params = {"pKey": p_key, "pLng": "jp"}
    for attempt in range(2):
        try:
            res = session.get(DETAIL_URL, params=params, timeout=30)
            res.raise_for_status()
            res.encoding = res.apparent_encoding or "utf-8"
            return parse_detail(res.text)
        except requests.RequestException as e:
            if attempt == 0:
                print(f"      ⚠ 詳細失敗 ({p_key}): {e} → 30秒待って再試行")
                time.sleep(30)
            else:
                print(f"      ❌ 詳細スキップ: {p_key}")
                return {col: "" for col in DETAIL_FIELDS.values()}


def syllabus_signature(p_key: str, course_code: str) -> str:
    """同じシラバス内容を共有する識別子。
    p_key の先頭10文字（科目キー）+ course_code を使う。
    """
    if not p_key:
        return f"__nokey__|{course_code}"
    return f"{p_key[:10]}|{course_code}"


# ---------------- メイン処理 ----------------
def scrape_group(faculty_slugs: list[str], term_key: str) -> int:
    term = TERM_CONFIG[term_key]
    print(f"\n=== グループ処理: {faculty_slugs} / {term['label']} ===")

    # (1) 各学部の一覧を取得
    per_faculty_rows: dict[str, list[dict]] = {}
    for i, slug in enumerate(faculty_slugs):
        per_faculty_rows[slug] = fetch_list_only(slug, term)
        if i < len(faculty_slugs) - 1:
            print(f"-- 学部間ウェイト {FACULTY_SLEEP_SEC}秒 --")
            time.sleep(FACULTY_SLEEP_SEC)

    total_list_rows = sum(len(rs) for rs in per_faculty_rows.values())

    # (2) signature ごとに代表 p_key を1つ選ぶ
    rep_pkey_by_sig: dict[str, str] = {}
    for slug, rows in per_faculty_rows.items():
        for r in rows:
            if not r["p_key"]:
                continue
            sig = syllabus_signature(r["p_key"], r["course_code"])
            if sig not in rep_pkey_by_sig:
                rep_pkey_by_sig[sig] = r["p_key"]

    print(f"\n[詳細取得計画]")
    print(f"  一覧合計行数: {total_list_rows}")
    print(f"  ユニーク signature: {len(rep_pkey_by_sig)} 件 ← これだけフェッチ")
    saving = total_list_rows - len(rep_pkey_by_sig)
    if total_list_rows:
        print(f"  節約: {saving} 件 ({saving / total_list_rows * 100:.1f}%)")

    # (3) signature ごとに1回だけ詳細を取得
    shared_cache: dict[str, dict] = {}
    sigs = list(rep_pkey_by_sig.keys())
    for idx, sig in enumerate(sigs, 1):
        rep_pkey = rep_pkey_by_sig[sig]
        if idx % 10 == 1:
            print(f"    詳細 {idx}/{len(sigs)}: {rep_pkey}")
        time.sleep(DETAIL_SLEEP_SEC)
        shared_cache[sig] = fetch_detail(rep_pkey)

    # (4) 各学部の CSV を書き出し（一覧情報 + 共有された詳細）
    grand_total = 0
    empty_detail = {k: "" for k in DETAIL_FIELDS.values()}
    for slug, rows in per_faculty_rows.items():
        output_csv = f"{slug}_{term_key}.csv"
        enriched: list[dict] = []
        for r in rows:
            sig = syllabus_signature(r["p_key"], r["course_code"]) if r["p_key"] else None
            detail = shared_cache.get(sig, empty_detail)
            enriched.append({**r, **detail})

        if not enriched:
            print(f"⚠ {slug}: 0件")
            continue

        fieldnames = list(enriched[0].keys())
        with open(output_csv, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(enriched)
        print(f"✅ {slug}: {len(enriched)} 件 → {output_csv}")
        grand_total += len(enriched)

    return grand_total


# ---------------- main ----------------
def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(1)

    if args[-1] in TERM_CONFIG:
        term_key = args[-1]
        faculty_args = args[:-1]
    else:
        term_key = DEFAULT_TERM
        faculty_args = args

    if not faculty_args:
        print("学部が指定されていません")
        sys.exit(1)

    if faculty_args == ["all"]:
        targets = list(FACULTIES.keys())
    else:
        targets = [FACULTY_ALIASES.get(f, f) for f in faculty_args]
        for f in targets:
            if f not in FACULTIES:
                print(f"未知の学部: {f}")
                sys.exit(1)

    grand_total = scrape_group(targets, term_key)
    print(f"\n🎉 全処理完了: 合計 {grand_total} 件取得")


if __name__ == "__main__":
    main()
