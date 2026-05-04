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

  function buildQuery(overrides?: Partial<Record<string, string>>) {
    const next = new URLSearchParams();
    const values: Record<string, string> = {
      q,
      faculty,
      term,
      day,
      period,
      methodType,
      ...overrides,
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
          {FACULTIES.map((facultyName) => (
            <option key={facultyName} value={facultyName}>
              {facultyName}
            </option>
          ))}
        </Select>

        <Select value={term} onChange={setTerm} placeholder="学期">
          {TERMS.map((termName) => (
            <option key={termName} value={termName}>
              {termName}
            </option>
          ))}
        </Select>

        <Select value={day} onChange={setDay} placeholder="曜日">
          {DAYS.map((dayOption) => (
            <option key={dayOption.value} value={String(dayOption.value)}>
              {dayOption.label}
            </option>
          ))}
        </Select>

        <Select value={period} onChange={setPeriod} placeholder="時限">
          {PERIODS.map((periodValue) => (
            <option key={periodValue} value={String(periodValue)}>
              {periodValue}限
            </option>
          ))}
        </Select>

        <Select
          value={methodType}
          onChange={setMethodType}
          placeholder="授業方法"
        >
          {CLASS_MODALITIES.map((modality) => (
            <option key={modality.value} value={modality.value}>
              {modality.label}
            </option>
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
  onChange: (value: string) => void;
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
