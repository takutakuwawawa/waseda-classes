"""Desktop UI for validating and refreshing Waseda course data."""

from __future__ import annotations

import csv
import os
import subprocess
import sys
import threading
import tkinter as tk
from pathlib import Path
from tkinter import messagebox, ttk


SCRAPER_DIR = Path(__file__).resolve().parent
PROJECTS_DIR = SCRAPER_DIR.parent.parent
BBS_DIR = PROJECTS_DIR / "waseda-course-bbs"
CATALOG_DIR = SCRAPER_DIR / "catalog"
SCRAPE_SCRIPT = SCRAPER_DIR / "scrape.py"
BUILD_SCRIPT = BBS_DIR / "scripts" / "build_catalog.py"
VENV_PYTHON = SCRAPER_DIR / "venv" / "Scripts" / "python.exe"
PYTHON = VENV_PYTHON if VENV_PYTHON.exists() else Path(sys.executable)

FACULTIES = [
    ("politics_economics", "政治経済学部"),
    ("law", "法学部"),
    ("education", "教育学部"),
    ("commerce", "商学部"),
    ("social_sciences", "社会科学部"),
    ("human_sciences", "人間科学部"),
    ("sport_sciences", "スポーツ科学部"),
    ("international", "国際教養学部"),
    ("culture_community", "文化構想学部"),
    ("letters", "文学部"),
    ("human_correspondence", "人間科学部（通信）"),
    ("fundamental_sci", "基幹理工学部"),
    ("creative_sci", "創造理工学部"),
    ("advanced_sci", "先進理工学部"),
    ("global_education", "GEC"),
]

TERMS = [("spring", "春・夏"), ("fall", "秋・冬")]


class ScraperApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("わせチャン 科目データ更新")
        self.geometry("1040x780")
        self.minsize(900, 680)
        self.configure(bg="#f3f3ee")
        self.process: subprocess.Popen[str] | None = None
        self.worker: threading.Thread | None = None
        self.running = False

        self.faculty_vars = {
            slug: tk.BooleanVar(value=True) for slug, _ in FACULTIES
        }
        self.term_vars = {term: tk.BooleanVar(value=True) for term, _ in TERMS}
        self.mode_var = tk.StringVar(value="metadata")
        self.status_var = tk.StringVar(value="準備完了")

        self._configure_styles()
        self._build_ui()
        self.refresh_file_status()
        self.protocol("WM_DELETE_WINDOW", self.on_close)

    def _configure_styles(self) -> None:
        style = ttk.Style(self)
        if "vista" in style.theme_names():
            style.theme_use("vista")
        style.configure("Root.TFrame", background="#f3f3ee")
        style.configure("Panel.TFrame", background="#ffffff")
        style.configure("Title.TLabel", background="#f3f3ee", foreground="#222222", font=("Yu Gothic UI", 22, "bold"))
        style.configure("Sub.TLabel", background="#f3f3ee", foreground="#5d625d", font=("Yu Gothic UI", 10))
        style.configure("PanelTitle.TLabel", background="#ffffff", foreground="#222222", font=("Yu Gothic UI", 11, "bold"))
        style.configure("Body.TLabel", background="#ffffff", foreground="#444844", font=("Yu Gothic UI", 9))
        style.configure("TCheckbutton", background="#ffffff", font=("Yu Gothic UI", 9))
        style.configure("TRadiobutton", background="#ffffff", font=("Yu Gothic UI", 9))
        style.configure("Primary.TButton", font=("Yu Gothic UI", 10, "bold"), padding=(18, 9))
        style.configure("Secondary.TButton", font=("Yu Gothic UI", 9), padding=(12, 7))
        style.configure("Treeview", rowheight=26, font=("Yu Gothic UI", 9))
        style.configure("Treeview.Heading", font=("Yu Gothic UI", 9, "bold"))

    def _build_ui(self) -> None:
        root = ttk.Frame(self, style="Root.TFrame", padding=(24, 20))
        root.pack(fill="both", expand=True)

        header = ttk.Frame(root, style="Root.TFrame")
        header.pack(fill="x", pady=(0, 14))
        ttk.Label(header, text="科目データ更新", style="Title.TLabel").pack(anchor="w")
        ttk.Label(
            header,
            text="公式シラバスで現在公開中の年度を自動取得し、わせチャンの科目一覧を更新します。",
            style="Sub.TLabel",
        ).pack(anchor="w", pady=(3, 0))

        controls = ttk.Frame(root, style="Panel.TFrame", padding=18)
        controls.pack(fill="x")

        top = ttk.Frame(controls, style="Panel.TFrame")
        top.pack(fill="x")
        faculty_box = ttk.Frame(top, style="Panel.TFrame")
        faculty_box.pack(side="left", fill="both", expand=True)
        title_row = ttk.Frame(faculty_box, style="Panel.TFrame")
        title_row.pack(fill="x", pady=(0, 8))
        ttk.Label(title_row, text="取得対象", style="PanelTitle.TLabel").pack(side="left")
        ttk.Button(title_row, text="全選択", style="Secondary.TButton", command=lambda: self.set_all_faculties(True)).pack(side="left", padx=(12, 4))
        ttk.Button(title_row, text="解除", style="Secondary.TButton", command=lambda: self.set_all_faculties(False)).pack(side="left")

        faculty_grid = ttk.Frame(faculty_box, style="Panel.TFrame")
        faculty_grid.pack(fill="x")
        for index, (slug, label) in enumerate(FACULTIES):
            ttk.Checkbutton(
                faculty_grid,
                text=label,
                variable=self.faculty_vars[slug],
            ).grid(row=index // 3, column=index % 3, sticky="w", padx=(0, 24), pady=2)

        option_box = ttk.Frame(top, style="Panel.TFrame", padding=(22, 0, 0, 0))
        option_box.pack(side="right", fill="y")
        ttk.Label(option_box, text="学期", style="PanelTitle.TLabel").pack(anchor="w", pady=(0, 5))
        for term, label in TERMS:
            ttk.Checkbutton(option_box, text=label, variable=self.term_vars[term]).pack(anchor="w", pady=2)
        ttk.Separator(option_box).pack(fill="x", pady=10)
        ttk.Label(option_box, text="更新方法", style="PanelTitle.TLabel").pack(anchor="w", pady=(0, 5))
        ttk.Radiobutton(
            option_box,
            text="掲示板用（推奨・高速）",
            value="metadata",
            variable=self.mode_var,
        ).pack(anchor="w", pady=2)
        ttk.Radiobutton(
            option_box,
            text="完全版（シラバス詳細を含む）",
            value="full",
            variable=self.mode_var,
        ).pack(anchor="w", pady=2)

        ttk.Label(
            controls,
            text="掲示板用更新では既存の詳細CSVを変更しません。取得件数が公式件数と一致しない場合もファイルを置き換えません。",
            style="Body.TLabel",
        ).pack(anchor="w", pady=(13, 0))

        actions = ttk.Frame(root, style="Root.TFrame")
        actions.pack(fill="x", pady=12)
        self.start_button = ttk.Button(actions, text="更新を開始", style="Primary.TButton", command=self.start_update)
        self.start_button.pack(side="left")
        self.audit_button = ttk.Button(actions, text="公式件数と照合", style="Secondary.TButton", command=self.start_audit)
        self.audit_button.pack(side="left", padx=(8, 0))
        self.build_button = ttk.Button(actions, text="取得済みデータを掲示板へ反映", style="Secondary.TButton", command=self.start_build)
        self.build_button.pack(side="left", padx=(8, 0))
        self.stop_button = ttk.Button(actions, text="停止", style="Secondary.TButton", command=self.stop_process, state="disabled")
        self.stop_button.pack(side="left", padx=(8, 0))
        ttk.Label(actions, textvariable=self.status_var, style="Sub.TLabel").pack(side="right")

        lower = ttk.Panedwindow(root, orient="vertical")
        lower.pack(fill="both", expand=True)

        status_panel = ttk.Frame(lower, style="Panel.TFrame", padding=12)
        lower.add(status_panel, weight=2)
        ttk.Label(status_panel, text="現在のCSV", style="PanelTitle.TLabel").pack(anchor="w", pady=(0, 8))
        self.file_tree = ttk.Treeview(
            status_panel,
            columns=("faculty", "spring", "fall"),
            show="headings",
            height=7,
        )
        self.file_tree.heading("faculty", text="提供元")
        self.file_tree.heading("spring", text="春・夏")
        self.file_tree.heading("fall", text="秋・冬")
        self.file_tree.column("faculty", width=250, anchor="w")
        self.file_tree.column("spring", width=220, anchor="w")
        self.file_tree.column("fall", width=220, anchor="w")
        tree_scroll = ttk.Scrollbar(status_panel, orient="vertical", command=self.file_tree.yview)
        self.file_tree.configure(yscrollcommand=tree_scroll.set)
        self.file_tree.pack(side="left", fill="both", expand=True)
        tree_scroll.pack(side="right", fill="y")

        log_panel = ttk.Frame(lower, style="Panel.TFrame", padding=12)
        lower.add(log_panel, weight=3)
        ttk.Label(log_panel, text="実行ログ", style="PanelTitle.TLabel").pack(anchor="w", pady=(0, 8))
        self.log = tk.Text(
            log_panel,
            height=10,
            wrap="word",
            bg="#151815",
            fg="#e8eee8",
            insertbackground="#ffffff",
            font=("Consolas", 9),
            relief="flat",
            padx=10,
            pady=8,
            state="disabled",
        )
        log_scroll = ttk.Scrollbar(log_panel, orient="vertical", command=self.log.yview)
        self.log.configure(yscrollcommand=log_scroll.set)
        self.log.pack(side="left", fill="both", expand=True)
        log_scroll.pack(side="right", fill="y")

    def set_all_faculties(self, value: bool) -> None:
        for variable in self.faculty_vars.values():
            variable.set(value)

    def selected_faculties(self) -> list[str]:
        return [slug for slug, _ in FACULTIES if self.faculty_vars[slug].get()]

    def selected_terms(self) -> list[str]:
        return [term for term, _ in TERMS if self.term_vars[term].get()]

    def ensure_selection(self) -> tuple[list[str], list[str]] | None:
        faculties = self.selected_faculties()
        terms = self.selected_terms()
        if not faculties:
            messagebox.showwarning("取得対象", "少なくとも1つの提供元を選んでください。")
            return None
        if not terms:
            messagebox.showwarning("学期", "少なくとも1つの学期を選んでください。")
            return None
        return faculties, terms

    def base_command(self) -> list[str]:
        return [str(PYTHON), "-u", str(SCRAPE_SCRIPT)]

    def start_update(self) -> None:
        selection = self.ensure_selection()
        if not selection:
            return
        faculties, terms = selection
        metadata_only = self.mode_var.get() == "metadata"
        output_dir = CATALOG_DIR if metadata_only else SCRAPER_DIR
        output_dir.mkdir(parents=True, exist_ok=True)

        jobs: list[tuple[str, list[str], Path]] = []
        for term in terms:
            command = self.base_command() + faculties + [term, "--output-dir", str(output_dir)]
            if metadata_only:
                command.append("--metadata-only")
            jobs.append((f"{term} の科目取得", command, SCRAPER_DIR))
        if BBS_DIR.exists() and BUILD_SCRIPT.exists():
            jobs.append(("掲示板カタログの生成", [str(PYTHON), "-u", str(BUILD_SCRIPT)], BBS_DIR))
        self.run_jobs(jobs, "更新が完了しました。")

    def start_audit(self) -> None:
        selection = self.ensure_selection()
        if not selection:
            return
        faculties, terms = selection
        jobs = []
        for term in terms:
            command = self.base_command() + faculties + [
                term,
                "--audit",
                "--compare-dir",
                str(CATALOG_DIR),
                "--compare-dir",
                str(SCRAPER_DIR),
            ]
            jobs.append((f"{term} の公式件数照合", command, SCRAPER_DIR))
        self.run_jobs(jobs, "照合が完了しました。")

    def start_build(self) -> None:
        if not BUILD_SCRIPT.exists():
            messagebox.showerror("掲示板", f"変換スクリプトが見つかりません。\n{BUILD_SCRIPT}")
            return
        self.run_jobs(
            [("掲示板カタログの生成", [str(PYTHON), "-u", str(BUILD_SCRIPT)], BBS_DIR)],
            "掲示板用データを生成しました。",
        )

    def run_jobs(
        self,
        jobs: list[tuple[str, list[str], Path]],
        success_message: str,
    ) -> None:
        if self.running:
            return
        self.running = True
        self._set_running_state(True)
        self.clear_log()
        self.status_var.set("実行中")

        def worker() -> None:
            try:
                for label, command, cwd in jobs:
                    self.append_log(f"\n=== {label} ===\n")
                    self.append_log(" ".join(command) + "\n\n")
                    flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
                    self.process = subprocess.Popen(
                        command,
                        cwd=cwd,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT,
                        text=True,
                        encoding="utf-8",
                        errors="replace",
                        bufsize=1,
                        creationflags=flags,
                    )
                    assert self.process.stdout is not None
                    for line in self.process.stdout:
                        self.append_log(line)
                    exit_code = self.process.wait()
                    self.process = None
                    if exit_code != 0:
                        raise RuntimeError(f"{label} が終了コード {exit_code} で停止しました")
                self.after(0, lambda: self._finish(True, success_message))
            except Exception as error:
                self.after(0, lambda error=error: self._finish(False, str(error)))

        self.worker = threading.Thread(target=worker, daemon=True)
        self.worker.start()

    def stop_process(self) -> None:
        if self.process and self.process.poll() is None:
            self.status_var.set("停止処理中")
            self.process.terminate()

    def _finish(self, success: bool, message: str) -> None:
        self.running = False
        self.process = None
        self._set_running_state(False)
        self.refresh_file_status()
        if success:
            self.status_var.set("完了")
            messagebox.showinfo("完了", message)
        else:
            self.status_var.set("要確認")
            messagebox.showerror("処理を完了できませんでした", message + "\n\n実行ログを確認してください。")

    def _set_running_state(self, running: bool) -> None:
        state = "disabled" if running else "normal"
        self.start_button.configure(state=state)
        self.audit_button.configure(state=state)
        self.build_button.configure(state=state)
        self.stop_button.configure(state="normal" if running else "disabled")

    def append_log(self, text: str) -> None:
        def write() -> None:
            self.log.configure(state="normal")
            self.log.insert("end", text)
            self.log.see("end")
            self.log.configure(state="disabled")

        self.after(0, write)

    def clear_log(self) -> None:
        self.log.configure(state="normal")
        self.log.delete("1.0", "end")
        self.log.configure(state="disabled")

    def csv_summary(self, slug: str, term: str) -> str:
        filename = f"{slug}_{term}.csv"
        candidates = [CATALOG_DIR / filename, SCRAPER_DIR / filename]
        path = next((candidate for candidate in candidates if candidate.exists()), None)
        if not path:
            return "未取得"
        try:
            with path.open("r", encoding="utf-8-sig", newline="") as handle:
                rows = list(csv.DictReader(handle))
            years = sorted({(row.get("year") or "").strip() for row in rows if (row.get("year") or "").strip()})
            year_label = "/".join(years) if years else "年度不明"
            source_label = "更新用" if path.parent == CATALOG_DIR else "詳細版"
            return f"{len(rows):,}件・{year_label}・{source_label}"
        except (OSError, csv.Error) as error:
            return f"読込エラー: {error}"

    def refresh_file_status(self) -> None:
        for item in self.file_tree.get_children():
            self.file_tree.delete(item)
        for slug, label in FACULTIES:
            self.file_tree.insert(
                "",
                "end",
                values=(label, self.csv_summary(slug, "spring"), self.csv_summary(slug, "fall")),
            )

    def on_close(self) -> None:
        if self.running:
            if not messagebox.askyesno("実行中", "取得処理を停止して閉じますか？"):
                return
            self.stop_process()
        self.destroy()


if __name__ == "__main__":
    ScraperApp().mainloop()
