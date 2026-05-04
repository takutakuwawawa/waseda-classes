import Link from "next/link";
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
    .map((slot) => `${DAY_LABELS[slot.day_of_week]}${slot.period}`)
    .join(" / ");
}

function shortMethod(value: string | null) {
  if (!value) return null;
  return (
    value
      .replace("【対面】", "")
      .replace("【オンライン】", "")
      .replace("ハイブリッド（対面回数半数以上）", "対面ハイブリッド")
      .replace("ハイブリッド（対面回数半数未満）", "オンラインハイブリッド")
      .trim() || value
  );
}

export function ClassCard({ row }: { row: ClassWithSlots }) {
  const method = shortMethod(row.method_type ?? row.class_format);

  return (
    <Link
      href={`/classes/${encodeURIComponent(row.id)}`}
      className="group block rounded-md border border-[var(--line)] bg-[var(--surface)] px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors hover:border-[var(--line-strong)] hover:bg-[var(--surface-strong)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-snug text-[var(--text)] group-hover:text-[var(--text)]">
            {row.name}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--text)]">
            <span>{row.teacher ?? "教員未定"}</span>
            <span className="rounded bg-[var(--accent)] px-2 py-0.5 text-xs font-semibold text-[var(--chip-text)]">
              {row.faculty}
            </span>
          </div>
        </div>
        <span
          className="shrink-0 text-xl leading-none text-[var(--text-faint)] transition-colors group-hover:text-[var(--accent)]"
          aria-hidden="true"
        >
          ♡
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs">
        <Meta label="曜日時限" value={formatSlots(row.class_slots)} />
        {row.term && <Meta label="学期" value={row.term} />}
        {row.classroom && (
          <Meta label="教室" value={row.classroom.split(" ")[0]} />
        )}
        {row.credits != null && <Meta label="単位" value={`${row.credits}`} />}
        {method && <Meta label="方法" value={method} />}
      </div>

      {row.summary && (
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-[var(--text-muted)]">
          {row.summary}
        </p>
      )}

      {row.course_codes && row.course_codes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {row.course_codes.slice(0, 4).map((code) => (
            <span
              key={code}
              className="rounded border border-[var(--line)] bg-[var(--control)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-muted)]"
            >
              {code}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-[var(--text-faint)]">{label}</span>
      <span className="font-medium text-[var(--text)]">{value}</span>
    </span>
  );
}
