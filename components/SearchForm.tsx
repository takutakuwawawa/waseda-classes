"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { FACULTIES, TERMS, DAYS, PERIODS } from "@/lib/types";

export function SearchForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const [q, setQ] = useState(params.get("q") ?? "");
  const [faculty, setFaculty] = useState(params.get("faculty") ?? "");
  const [term, setTerm] = useState(params.get("term") ?? "");
  const [day, setDay] = useState(params.get("day") ?? "");
  const [period, setPeriod] = useState(params.get("period") ?? "");

  function buildQuery(overrides?: Partial<Record<string, string>>) {
    const next = new URLSearchParams();
    const values: Record<string, string> = {
      q,
      faculty,
      term,
      day,
      period,
      ...overrides,
    };
    Object.entries(values).forEach(([k, v]) => {
      if (v) next.set(k, v);
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
    startTransition(() => router.push("/"));
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="科目名・教員名で検索"
          className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white"
        >
          検索
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={faculty} onChange={setFaculty} placeholder="学部">
          {FACULTIES.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </Select>

        <Select value={term} onChange={setTerm} placeholder="学期">
          {TERMS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </Select>

        <Select value={day} onChange={setDay} placeholder="曜日">
          {DAYS.map((d) => (
            <option key={d.value} value={String(d.value)}>{d.label}</option>
          ))}
        </Select>

        <Select value={period} onChange={setPeriod} placeholder="時限">
          {PERIODS.map((p) => (
            <option key={p} value={String(p)}>{p}限</option>
          ))}
        </Select>

        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
        >
          条件をクリア
        </button>
      </div>
    </form>
  );
}

function Select({
  value,
  onChange,
  placeholder,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  );
}