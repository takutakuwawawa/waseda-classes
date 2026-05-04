import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClassDetailTabs } from "@/components/ClassDetailTabs";
import { getClassById } from "@/lib/search";

const DAY_LABELS = ["", "月", "火", "水", "木", "金", "土", "日"];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <h2 className="mb-2 text-sm font-semibold text-zinc-300">{title}</h2>
      <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-200">
        {children}
      </div>
    </section>
  );
}

function MetaRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;

  return (
    <div className="flex gap-3 border-b border-zinc-800/60 py-1.5 text-sm last:border-b-0">
      <span className="w-24 shrink-0 text-zinc-500">{label}</span>
      <span className="break-words text-zinc-200">{value}</span>
    </div>
  );
}

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await getClassById(decodeURIComponent(id));
  if (!row) notFound();

  const slotsLabel =
    row.class_slots && row.class_slots.length > 0
      ? row.class_slots
          .slice()
          .sort((a, b) =>
            a.day_of_week === b.day_of_week
              ? a.period - b.period
              : a.day_of_week - b.day_of_week
          )
          .map((slot) => `${DAY_LABELS[slot.day_of_week]}${slot.period}`)
          .join(" / ")
      : "—";

  const overview = (
    <div className="space-y-4">
      {row.summary && <Section title="授業概要">{row.summary}</Section>}
      {row.goal && <Section title="授業の到達目標">{row.goal}</Section>}
      {row.schedule_plan && (
        <Section title="授業計画">{row.schedule_plan}</Section>
      )}
      {row.study_outside && (
        <Section title="事前・事後学習">{row.study_outside}</Section>
      )}
      {row.textbook && <Section title="教科書">{row.textbook}</Section>}
      {row.reference && <Section title="参考文献">{row.reference}</Section>}
      {row.grading_method && (
        <Section title="成績評価方法">{row.grading_method}</Section>
      )}
      {row.notes_url && <Section title="備考・関連URL">{row.notes_url}</Section>}

      {row.syllabus_url && (
        <div className="pt-2">
          <a
            href={row.syllabus_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-400 hover:underline"
          >
            公式シラバスを開く ↗
          </a>
        </div>
      )}
    </div>
  );

  return (
    <main className="min-h-dvh bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Link
          href="/"
          className="inline-block text-sm text-zinc-400 hover:text-zinc-200"
        >
          ← 検索に戻る
        </Link>

        <header className="mt-4 mb-5">
          <div className="mb-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-zinc-300">
              {row.faculty}
            </span>
            {row.term && (
              <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-zinc-300">
                {row.term}
              </span>
            )}
            {row.year && (
              <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-zinc-300">
                {row.year}年度
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold leading-tight">{row.name}</h1>
          {row.subtitle && (
            <p className="mt-1 text-sm text-zinc-400">{row.subtitle}</p>
          )}
          <p className="mt-2 text-sm text-zinc-300">
            {row.teacher ?? "教員未定"}
          </p>
        </header>

        <section className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
          <MetaRow label="曜日時限" value={slotsLabel} />
          <MetaRow label="使用教室" value={row.classroom} />
          <MetaRow label="キャンパス" value={row.campus} />
          <MetaRow
            label="単位数"
            value={row.credits != null ? String(row.credits) : null}
          />
          <MetaRow label="配当年次" value={row.year_assignment} />
          <MetaRow label="科目区分" value={row.subject_category} />
          <MetaRow label="授業方法" value={row.method_type ?? row.class_format} />
          <MetaRow label="使用言語" value={row.language} />
          <MetaRow label="レベル" value={row.level} />
          <MetaRow label="分野(大)" value={row.major_field} />
          <MetaRow label="分野(中)" value={row.middle_field} />
          <MetaRow label="分野(小)" value={row.minor_field} />
          <MetaRow
            label="コースコード"
            value={
              row.course_code_full ??
              (row.course_codes?.length ? row.course_codes.join(" / ") : null)
            }
          />
        </section>

        <ClassDetailTabs row={row} overview={overview} />
      </div>
    </main>
  );
}
