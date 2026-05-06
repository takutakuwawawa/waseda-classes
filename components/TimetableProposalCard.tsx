"use client";

const DAY_LABELS = ["月", "火", "水", "木", "金"];
const PERIODS = [1, 2, 3, 4, 5, 6];
const ONLINE_DAY = 0;
const ONLINE_PERIOD = 0;

const COLORS = [
  "bg-blue-900/60 border-blue-500 text-blue-200",
  "bg-green-900/60 border-green-500 text-green-200",
  "bg-purple-900/60 border-purple-500 text-purple-200",
  "bg-yellow-900/60 border-yellow-600 text-yellow-200",
  "bg-red-900/60 border-red-500 text-red-200",
  "bg-pink-900/60 border-pink-500 text-pink-200",
  "bg-teal-900/60 border-teal-500 text-teal-200",
  "bg-orange-900/60 border-orange-500 text-orange-200",
];

export type ProposedClass = {
  class_id: string;
  name: string;
  teacher: string;
  credits: number;
  day: number;
  period: number;
  grading: string;
};

export type Proposal = {
  title: string;
  description: string;
  total_credits: number;
  classes: ProposedClass[];
};

export function TimetableProposalCard({
  proposal,
  onAdopt,
  isAdopting,
}: {
  proposal: Proposal;
  onAdopt: (classes: ProposedClass[]) => void;
  isAdopting: boolean;
}) {
  const grid = new Map<string, ProposedClass>();
  for (const c of proposal.classes) {
    if (c.day === ONLINE_DAY && c.period === ONLINE_PERIOD) continue;
    grid.set(`${c.day}-${c.period}`, c);
  }
  const onlineClasses = proposal.classes.filter(
    (c) => c.day === ONLINE_DAY && c.period === ONLINE_PERIOD
  );
  const totalCredits = proposal.classes.reduce((sum, c) => sum + c.credits, 0);

  const colorMap = new Map<string, string>();
  proposal.classes.forEach((c, i) => {
    colorMap.set(c.class_id, COLORS[i % COLORS.length]);
  });

  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 space-y-3">
      {/* ヘッダー */}
      <div>
        <div className="text-sm font-bold text-[var(--text)]">
          {proposal.title}
        </div>
        <div className="text-xs text-[var(--text-muted)] mt-0.5">
          {proposal.description}
        </div>
        <div className="text-xs text-[var(--text-muted)] mt-0.5">
          合計 <span className="font-bold text-[var(--text)]">{totalCredits}</span> 単位
        </div>
      </div>

      {onlineClasses.length > 0 && (
        <div className="rounded-md border border-[var(--line)] bg-[var(--control)] p-2">
          <div className="mb-1 text-[10px] font-semibold text-[var(--text-faint)]">
            フルオンデマンド
          </div>
          <div className="space-y-1">
            {onlineClasses.map((c, index) => (
              <div
                key={`${c.class_id}-online-${index}`}
                className="flex items-center gap-1.5 text-xs"
              >
                <span className="truncate text-[var(--text)]">{c.name}</span>
                <span className="flex-shrink-0 text-[var(--text-faint)]">
                  {c.credits}単位
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ミニ時間割グリッド */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[9px]" style={{ minWidth: "180px" }}>
          <thead>
            <tr>
              <th className="border border-[var(--line)] px-1 py-0.5 text-[var(--text-faint)] w-5" />
              {DAY_LABELS.map((d) => (
                <th
                  key={d}
                  className="border border-[var(--line)] px-1 py-0.5 text-center text-[var(--text-muted)] font-medium"
                >
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((period) => (
              <tr key={period}>
                <td className="border border-[var(--line)] px-1 py-0.5 text-center text-[var(--text-faint)]">
                  {period}
                </td>
                {[1, 2, 3, 4, 5].map((day) => {
                  const course = grid.get(`${day}-${period}`);
                  const color = course
                    ? colorMap.get(course.class_id) ?? ""
                    : "";
                  return (
                    <td
                      key={day}
                      className="border border-[var(--line)] p-0.5"
                      style={{ height: "2.8rem", verticalAlign: "top" }}
                    >
                      {course && (
                        <div
                          className={`rounded border ${color} h-full px-0.5 py-0.5 overflow-hidden`}
                        >
                          <div className="line-clamp-3 leading-tight font-medium">
                            {course.name}
                          </div>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 授業リスト */}
      <div className="space-y-1">
        {proposal.classes.map((c, index) => (
          <div key={`${c.class_id}-${index}`} className="flex items-center gap-1.5 text-xs">
            <div
              className={`w-2 h-2 rounded-sm border flex-shrink-0 ${colorMap.get(c.class_id) ?? ""}`}
            />
            <span className="text-[var(--text)] truncate">{c.name}</span>
            <span className="text-[var(--text-faint)] flex-shrink-0">
              {c.credits}単位
            </span>
          </div>
        ))}
      </div>

      {/* 採用ボタン */}
      <button
        onClick={() => onAdopt(proposal.classes)}
        disabled={isAdopting}
        className="w-full rounded-lg bg-[var(--text)] px-3 py-2 text-xs font-medium text-[var(--bg)] disabled:opacity-50 transition-opacity hover:opacity-80"
      >
        {isAdopting ? "追加中..." : "この時間割を履修候補に追加"}
      </button>
    </div>
  );
}
