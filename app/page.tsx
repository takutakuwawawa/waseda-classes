import Link from "next/link";
import { searchClasses } from "@/lib/search";
import { ClassCard } from "@/components/ClassCard";
import { SearchForm } from "@/components/SearchForm";
import type { SearchParams } from "@/lib/types";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const { rows, total, page, pageSize } = await searchClasses(params);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // ページ番号変更用URL生成
  const buildPageUrl = (p: number) => {
    const next = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) next.set(k, String(v));
    });
    next.set("page", String(p));
    return `/?${next.toString()}`;
  };

  return (
    <main className="min-h-dvh bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">
            早稲田 授業情報
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            学部・学期・曜限・キーワードで絞り込み
          </p>
        </header>

        <SearchForm />

        <div className="mt-6 mb-3 text-xs text-zinc-500">
          {total > 0 ? (
            <>
              {total.toLocaleString()} 件中{" "}
              {(page - 1) * pageSize + 1}–
              {Math.min(page * pageSize, total)} 件を表示
            </>
          ) : (
            "条件に一致する授業はありません"
          )}
        </div>

        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id}>
              <ClassCard row={row} />
            </li>
          ))}
        </ul>

        {totalPages > 1 && (
          <nav className="mt-6 flex items-center justify-between text-sm">
            {page > 1 ? (
              <Link
                href={buildPageUrl(page - 1)}
                className="rounded-lg border border-zinc-800 px-3 py-1.5 text-zinc-300 hover:border-zinc-600"
              >
                ← 前へ
              </Link>
            ) : (
              <span />
            )}
            <span className="text-zinc-500">
              {page} / {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                href={buildPageUrl(page + 1)}
                className="rounded-lg border border-zinc-800 px-3 py-1.5 text-zinc-300 hover:border-zinc-600"
              >
                次へ →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>
    </main>
  );
}