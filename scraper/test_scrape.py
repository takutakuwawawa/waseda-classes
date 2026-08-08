from __future__ import annotations

import csv
import tempfile
import unittest
from pathlib import Path

import scrape


def sample_row(p_key: str) -> dict[str, str]:
    row = {field: "" for field in scrape.CSV_FIELDS}
    row.update(
        {
            "year": "2026",
            "course_code": "TEST101",
            "name": "テスト科目",
            "faculty": "社学",
            "term": "春学期",
            "p_key": p_key,
            "credits": "2",
            "method_type": "【対面】",
        }
    )
    return row


class ScrapeValidationTests(unittest.TestCase):
    def test_complete_unique_rows_are_valid(self) -> None:
        rows = [sample_row("a"), sample_row("b")]
        self.assertEqual(scrape.validate_list_rows(rows, 2), [])

    def test_count_missing_key_and_duplicate_are_reported(self) -> None:
        rows = [sample_row("a"), sample_row("a"), sample_row("")]
        problems = " / ".join(scrape.validate_list_rows(rows, 4))
        self.assertIn("公式 4 件", problems)
        self.assertIn("科目IDが空", problems)
        self.assertIn("科目IDの重複", problems)

    def test_atomic_csv_has_all_columns(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "courses.csv"
            scrape.write_csv_atomic(path, [sample_row("course-1")])
            with path.open("r", encoding="utf-8-sig", newline="") as handle:
                reader = csv.DictReader(handle)
                rows = list(reader)
            self.assertEqual(reader.fieldnames, scrape.CSV_FIELDS)
            self.assertEqual(rows[0]["p_key"], "course-1")
            self.assertFalse(path.with_suffix(".csv.tmp").exists())


if __name__ == "__main__":
    unittest.main()
