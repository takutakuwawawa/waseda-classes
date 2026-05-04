"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import {
  CLASS_MODALITIES,
  DAYS,
  FACULTIES,
  PERIODS,
  TERMS,
} from "@/lib/types";

export function SearchForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const [q, setQ] = useState(params.get("q") ?? "");
  const [faculty, setFaculty] = useState(params.get("faculty") ?? "");
  const [term, setTerm] = useState(params.get("term") ?? "");
  const [day, setDay] = useState(params.get("day") ?? "");
  const [period, setPeriod] = useState(params.get("period") ?? "");
  const [methodType, setMethodType] = useState(params.get("methodType") ?? "");
  const sort = params.get("sort") ?? "";

  function buildQuery() {
    const next = new URLSearchParams();
    const values: Record<string, string> = {
      q,
      faculty,
      term,
      day,
      period,
      methodType,
      sort,
    };
    Object.entries(values).forEach(([key, value]) => {
      if (value) next.set(key, value);
    });
    return next.toString();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(() => {
      const qs = buildQuery();
      router.push(qs ? `/?${qs}` : "/");
    });
  }

  function reset() {
    setQ("");
    setFaculty("");
    setTerm("");
    setDay("");
    setPeriod("");
    setMethodType("");
    startTransition(() => router.push("/"));
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="group flex min-h-12 items-center gap-3 rounded-md border border-[var(--line)] bg-[var(--control)] px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors focus-within:border-[var(--line-strong)]">
          <span className="text-[var(--text-faint)]" aria-hidden="true">
            ⌕
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="科目名・教員名で検索"
            className="h-full min-w-0 flex-1 bg-transparent text-sm font-medium text-[var(--text)] outline-none placeholder:text-[var(--text-faint)]"
          />
        </label>
        <button
          type="submit"
          className="min-h-12 rounded-md bg-[var(--accent)] px-8 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:bg-[var(--accent-strong)]"
        >
          検索
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_1.35fr_auto]">
        <LabeledSelect label="学部" value={faculty} onChange={setFaculty}>
          {FACULTIES.map((facultyName) => (
            <option key={facultyName} value={facultyName}>
              {facultyName}
            </option>
          ))}
        </LabeledSelect>

        <LabeledSelect label="学期" value={term} onChange={setTerm}>
          {TERMS.map((termName) => (
            <option key={termName} value={termName}>
              {termName}
            </option>
          ))}
        </LabeledSelect>

        <LabeledSelect label="曜日" value={day} onChange={setDay}>
          {DAYS.map((dayOption) => (
            <option key={dayOption.value} value={String(dayOption.value)}>
              {dayOption.label}
            </option>
          ))}
        </LabeledSelect>

        <LabeledSelect label="時限" value={period} onChange={setPeriod}>
          {PERIODS.map((periodValue) => (
            <option key={periodValue} value={String(periodValue)}>
              {periodValue}限
            </option>
          ))}
        </LabeledSelect>

        <LabeledSelect label="授業方法" value={methodType} onChange={setMethodType}>
          {CLASS_MODALITIES.map((modality) => (
            <option key={modality.value} value={modality.value}>
              {modality.label}
            </option>
          ))}
        </LabeledSelect>

        <button
          type="button"
          onClick={reset}
          className="min-h-11 rounded-md border border-[var(--line)] bg-[var(--control)] px-4 text-xs font-semibold text-[var(--text)] transition-colors hover:border-[var(--line-strong)]"
        >
          条件をクリア
        </button>
      </div>
    </form>
  );
}

function LabeledSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="grid min-h-11 grid-cols-[auto_1fr] items-center overflow-hidden rounded-md border border-[var(--line)] bg-[var(--control)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors focus-within:border-[var(--line-strong)]">
      <span className="border-r border-[var(--line)] px-3 text-xs font-semibold text-[var(--text-muted)]">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-full min-w-0 appearance-none bg-[var(--control)] px-3 pr-8 text-sm font-semibold text-[var(--text)] outline-none"
      >
        <option value="">すべて</option>
        {children}
      </select>
    </label>
  );
}
