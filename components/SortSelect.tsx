"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { SORT_OPTIONS, type SortKey } from "@/lib/types";

function isSortKey(value: string): value is SortKey {
  return SORT_OPTIONS.some((option) => option.value === value);
}

export function SortSelect() {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const selectedSort = params.get("sort") ?? "name";
  const value = isSortKey(selectedSort) ? selectedSort : "name";

  function changeSort(nextSort: string) {
    const next = new URLSearchParams(params.toString());
    next.delete("page");

    if (nextSort === "name") {
      next.delete("sort");
    } else {
      next.set("sort", nextSort);
    }

    startTransition(() => {
      const qs = next.toString();
      router.push(qs ? `/?${qs}` : "/");
    });
  }

  return (
    <label className="inline-flex min-h-9 items-center overflow-hidden rounded-md border border-[var(--line)] bg-[var(--control)] transition-colors focus-within:border-[var(--line-strong)]">
      <span className="border-r border-[var(--line)] px-3 text-xs font-semibold text-[var(--text-muted)]">
        並び替え
      </span>
      <select
        value={value}
        onChange={(event) => changeSort(event.target.value)}
        className="h-full min-w-36 appearance-none bg-[var(--control)] px-3 pr-8 text-sm font-semibold text-[var(--text)] outline-none"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
