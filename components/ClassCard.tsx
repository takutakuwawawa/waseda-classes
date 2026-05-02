import type { ClassWithSlots } from "@/lib/types";

const DAY_LABELS = ["", "月", "火", "水", "木", "金", "土", "日"];

function formatSlots(slots: ClassWithSlots["class_slots"]) {
  if (!slots || slots.length === 0) return "—";
  return slots
    .slice()
    .sort((a, b) =>
      a.day_of_week === b.day_of_week
        ? a.period - b.period
        : a.day_of_week - b.day_of_week
    )
    .map((s) => `${DAY_LABELS[s.day_of_week]}${s.period}`)
    .join(" / ");
}

export function ClassCard({ row }: { row: ClassWithSlots }) {
  return (
    <article className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 hover:border-zinc-600 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-zinc-100 leading-tight">
          {row.name}
        </h3>
        <span className="shrink-0 rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
          {row.faculty}
        </span>
      </div>
      <p className="mt-1 text-sm text-zinc-400">
        {row.teacher ?? "教員未定"}
      </p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
        <span>📅 {formatSlots(row.class_slots)}</span>
        {row.term && <span>🗓 {row.term}</span>}
        {row.classroom && <span>📍 {row.classroom.split(" ")[0]}</span>}
      </div>
      {row.course_codes && row.course_codes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {row.course_codes.map((c) => (
            <span
              key={c}
              className="rounded bg-zinc-800/70 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400"
            >
              {c}
            </span>
          ))}
        </div>
      )}
      {row.summary && (
        <p className="mt-3 text-sm text-zinc-400 line-clamp-2">
          {row.summary}
        </p>
      )}
    </article>
  );
}