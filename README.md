# Waseda Classes

早稲田大学の公式シラバスから科目データを取得するスクレイパーと、検索・履修計画用のWebアプリです。

## 科目データ更新ツール

`scraper/scraper_gui.py` は、全15提供元と春秋を選択して更新できるWindows用GUIです。年度は公式シラバスで現在公開中の年度を自動取得します。

- **掲示板用（推奨・高速）**: 科目名、教員、学期、曜日時限、単位、授業方法だけを取得し、既存の詳細CSVを変更しません。
- **完全版**: 授業概要や授業計画などの詳細ページも取得します。
- **公式件数と照合**: 公式の現在件数とローカルCSVの件数を比較します。
- **取得済みデータを掲示板へ反映**: `waseda-course-bbs/public/data` を再生成します。

仮想環境を作成済みの環境では、次のファイルから起動できます。

```powershell
scraper\launch_scraper_gui.cmd
```

CLIも引き続き利用できます。

```powershell
cd scraper
.\venv\Scripts\Activate.ps1
python scrape.py all spring --metadata-only --output-dir catalog
python scrape.py all fall --metadata-only --output-dir catalog
```

取得時は公式件数、解析行数、科目IDの欠落・重複を検証し、不一致時には既存CSVを置き換えません。

## Webアプリ

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
