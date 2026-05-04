import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { ClassCard } from "@/components/ClassCard";
import { SearchForm } from "@/components/SearchForm";
import { SortSelect } from "@/components/SortSelect";
import { searchClasses } from "@/lib/search";
import type { SearchParams } from "@/lib/types";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const { rows, total, page, pageSize } = await searchClasses(params);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const buildPageUrl = (p: number) => {
    const next = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) next.set(key, String(value));
    });
    next.set("page", String(p));
    return `/?${next.toString()}`;
  };

  const visibleFrom = total > 0 ? (page - 1) * pageSize + 1 : 0;
  const visibleTo = Math.min(page * pageSize, total);

  return (
    <main className="min-h-dvh bg-[var(--bg)] text-[var(--text)]">
      <AppHeader />

      <div className="mx-auto max-w-6xl px-5 pb-10 pt-20">
        <section className="mb-5">
          <SearchForm />
        </section>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="text-[var(--text-muted)]">
            {total > 0 ? (
              <>
                {total.toLocaleString()}件中 {visibleFrom}–{visibleTo}件を表示
              </>
            ) : (
              "条件に一致する授業はありません"
            )}
          </div>
          <SortSelect />
        </div>

        <ul className="space-y-2">
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
                className="rounded-md border border-[var(--line)] bg-[var(--control)] px-3 py-1.5 text-[var(--text)] transition-colors hover:border-[var(--line-strong)]"
              >
                前へ
              </Link>
            ) : (
              <span />
            )}
            <span className="text-[var(--text-muted)]">
              {page} / {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                href={buildPageUrl(page + 1)}
                className="rounded-md border border-[var(--line)] bg-[var(--control)] px-3 py-1.5 text-[var(--text)] transition-colors hover:border-[var(--line-strong)]"
              >
                次へ
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
