"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { AiChatPanel } from "@/components/AiChatPanel";
import type { ClassWithSlots } from "@/lib/types";

type SavedClassRow = {
  class_id: string;
  created_at: string;
  classes: ClassWithSlots | null;
};

const ONLINE_DAY = "online";
type PlannerDayValue = number | typeof ONLINE_DAY;
const TIMETABLE_GRID = "grid-cols-[5.75rem_repeat(7,minmax(0,1fr))]";
const TIMETABLE_BODY_GRID =
  "grid-cols-[5.75rem_repeat(7,minmax(0,1fr))] grid-rows-[repeat(7,6.75rem)]";

const WEEKDAY_DAYS = [
  { value: 1, label: "月" },
  { value: 2, label: "火" },
  { value: 3, label: "水" },
  { value: 4, label: "木" },
  { value: 5, label: "金" },
  { value: 6, label: "土" },
];

const DAYS: { value: PlannerDayValue; label: string }[] = [
  ...WEEKDAY_DAYS,
  { value: ONLINE_DAY, label: "オンライン" },
];

const PERIODS = [
  { value: 1, time: "8:50-10:30" },
  { value: 2, time: "10:40-12:20" },
  { value: 3, time: "13:10-14:50" },
  { value: 4, time: "15:05-16:45" },
  { value: 5, time: "17:00-18:40" },
  { value: 6, time: "18:55-20:35" },
  { value: 7, time: "20:45-21:35" },
];

export function PlannerClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SavedClassRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<PlannerDayValue>(1);

  useEffect(() => {
    let alive = true;

    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("saved_classes")
        .select(
          `
          class_id,
          created_at,
          classes (
            *,
            class_slots ( term, day_of_week, period )
          )
          `
        )
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false });

      if (!alive) return;

      if (error) {
        setMessage(error.message);
        setItems([]);
      } else {
        setItems((data as unknown as SavedClassRow[]) ?? []);
      }

      setLoading(false);
    }

    load();

    return () => {
      alive = false;
    };
  }, [router]);

  const classes = items.map((item) => item.classes).filter(Boolean) as ClassWithSlots[];
  const { grid, onlineClasses } = useMemo(() => buildGrid(classes), [classes]);
  const stats = useMemo(
    () => buildPlannerStats(classes, grid, onlineClasses),
    [classes, grid, onlineClasses]
  );

  async function removeClass(classId: string) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { error } = await supabase
      .from("saved_classes")
      .delete()
      .eq("user_id", userData.user.id)
      .eq("class_id", classId);

    if (error) {
      setMessage(error.message);
      return;
    }

    setItems((current) => current.filter((item) => item.class_id !== classId));
  }

  if (loading) {
    return <Panel>読み込み中...</Panel>;
  }

  if (message) {
    return <Panel>{message}</Panel>;
  }

  return (
    <>
      {/* AI履修相談ボタン（右下固定） */}
      <button
        onClick={() => setIsChatOpen(true)}
        className="fixed inset-x-4 bottom-4 z-30 flex items-center justify-center gap-2 rounded-full bg-[var(--text)] px-4 py-3 text-sm font-medium text-[var(--bg)] shadow-lg transition-opacity hover:opacity-80 md:inset-x-auto md:bottom-6 md:right-6"
      >
        ✦ AI 履修相談
      </button>

      {/* AIチャットパネル */}
      <AiChatPanel
        savedClassIds={classes.map((c) => c.id)}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />

      <MobilePlannerView
        classes={classes}
        grid={grid}
        onlineClasses={onlineClasses}
        stats={stats}
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
        onRemoveClass={removeClass}
      />

      <div className="hidden gap-5 md:grid lg:grid-cols-[1.4fr_0.9fr]">
        <section className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
          <h2 className="mb-4 text-sm font-bold text-[var(--text)]">時間割プレビュー</h2>
          <div className="overflow-x-auto">
            <div className="min-w-[860px]">
              <div className={`grid ${TIMETABLE_GRID} border-b border-[var(--line)] text-center text-xs font-semibold text-[var(--text-muted)]`}>
                <div className="p-2" />
                {DAYS.map((day) => (
                  <div key={day.value} className="border-l border-[var(--line)] p-2">
                    {day.label}
                  </div>
                ))}
              </div>
              <div className={`grid ${TIMETABLE_BODY_GRID}`}>
                {PERIODS.map((period, periodIndex) => (
                  <div
                    key={`period-${period.value}`}
                    style={{ gridColumn: 1, gridRow: periodIndex + 1 }}
                    className="flex flex-col items-center justify-center border-b border-[var(--line)] px-1 text-center"
                  >
                    <span className="text-xs font-bold text-[var(--text)]">
                      {period.value}限
                    </span>
                    <span className="mt-1 text-[10px] leading-tight text-[var(--text-faint)]">
                      {period.time}
                    </span>
                  </div>
                ))}

                {PERIODS.map((period, periodIndex) =>
                  WEEKDAY_DAYS.map((day) => {
                    const cellClasses = grid.get(`${day.value}-${period.value}`) ?? [];

                    return (
                      <div
                        key={`${day.value}-${period.value}`}
                        style={{
                          gridColumn: day.value + 1,
                          gridRow: periodIndex + 1,
                        }}
                        className="min-h-0 border-b border-l border-[var(--line)] p-1.5"
                      >
                        <div className="h-full space-y-1 overflow-y-auto pr-1">
                          {cellClasses.map((klass) => (
                            <ClassTile key={klass.id} klass={klass} />
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}

                <div
                  style={{ gridColumn: 8, gridRow: "1 / span 7" }}
                  className="min-h-0 border-b border-l border-[var(--line)] p-1.5"
                >
                  <div className="h-full space-y-1 overflow-y-auto pr-1">
                    {onlineClasses.map((klass) => (
                      <ClassTile key={klass.id} klass={klass} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
          <h2 className="mb-4 text-sm font-bold text-[var(--text)]">履修候補</h2>
          {classes.length === 0 ? (
            <div className="rounded-md border border-[var(--line)] bg-[var(--control)] p-6 text-center text-sm text-[var(--text-muted)]">
              まだ候補はありません。
            </div>
          ) : (
            <ul className="space-y-2">
              {classes.map((klass) => (
                <li
                  key={klass.id}
                  className="rounded-md border border-[var(--line)] bg-[var(--control)] p-3"
                >
                  <Link
                    href={`/classes/${encodeURIComponent(klass.id)}`}
                    className="font-semibold text-[var(--text)] hover:underline"
                  >
                    {klass.name}
                  </Link>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">
                    {klass.teacher ?? "教員未定"} / {klass.faculty}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeClass(klass.id)}
                    className="mt-3 text-xs font-semibold text-[var(--text-faint)] transition-colors hover:text-[var(--text)]"
                  >
                    候補から外す
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function buildGrid(classes: ClassWithSlots[]) {
  const grid = new Map<string, ClassWithSlots[]>();
  const onlineClasses: ClassWithSlots[] = [];

  for (const klass of classes) {
    const slots = klass.class_slots ?? [];
    const isOnlineClass = isOnlineOnlyClass(klass);

    if (isOnlineClass) {
      onlineClasses.push(klass);
      continue;
    }

    for (const slot of slots) {
      const key = `${slot.day_of_week}-${slot.period}`;
      grid.set(key, [...(grid.get(key) ?? []), klass]);
    }
  }

  return { grid, onlineClasses };
}

function buildPlannerStats(
  classes: ClassWithSlots[],
  grid: Map<string, ClassWithSlots[]>,
  onlineClasses: ClassWithSlots[]
) {
  const campusDays = new Set<number>();
  let firstPeriodCount = 0;
  let conflictCount = 0;

  for (const [key, cellClasses] of grid.entries()) {
    if (cellClasses.length === 0) continue;
    const [day, period] = key.split("-").map(Number);
    campusDays.add(day);
    if (period === 1) firstPeriodCount += cellClasses.length;
    if (cellClasses.length > 1) conflictCount += 1;
  }

  return {
    totalCredits: sumCredits(classes),
    campusDays: campusDays.size,
    firstPeriodCount,
    onlineCredits: sumCredits(onlineClasses),
    conflictCount,
  };
}

function isOnlineOnlyClass(klass: ClassWithSlots) {
  const method = klass.method_type ?? klass.class_format ?? "";
  return method.includes("フルオンデマンド") || method.includes("リアルタイム配信");
}

function ClassTile({ klass }: { klass: ClassWithSlots }) {
  return (
    <Link
      href={`/classes/${encodeURIComponent(klass.id)}`}
      className="block rounded border border-[var(--line)] bg-[var(--control)] p-2 text-[11px] leading-snug transition-colors hover:border-[var(--line-strong)]"
    >
      <div className="line-clamp-2 font-semibold text-[var(--text)]">
        {klass.name}
      </div>
      <div className="mt-1 text-[var(--text-faint)]">
        {klass.teacher ?? "教員未定"}
      </div>
    </Link>
  );
}

function MobilePlannerView({
  classes,
  grid,
  onlineClasses,
  stats,
  selectedDay,
  onSelectDay,
  onRemoveClass,
}: {
  classes: ClassWithSlots[];
  grid: Map<string, ClassWithSlots[]>;
  onlineClasses: ClassWithSlots[];
  stats: ReturnType<typeof buildPlannerStats>;
  selectedDay: PlannerDayValue;
  onSelectDay: (day: PlannerDayValue) => void;
  onRemoveClass: (classId: string) => void;
}) {
  return (
    <div className="space-y-4 md:hidden">
      <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[var(--text)]">履修の概要</h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              今の候補をスマホ用に整理しています。
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-[var(--text)]">
              {formatCredits(stats.totalCredits)}
            </div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-faint)]">
              credits
            </div>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <MobileMetric label="合計" value={`${formatCredits(stats.totalCredits)}単位`} />
          <MobileMetric label="登校" value={`${stats.campusDays}日`} />
          <MobileMetric label="1限" value={`${stats.firstPeriodCount}コマ`} />
          <MobileMetric label="オンデマンド" value={`${formatCredits(stats.onlineCredits)}単位`} />
          <MobileMetric
            label="重複"
            value={stats.conflictCount === 0 ? "なし" : `${stats.conflictCount}件`}
            tone={stats.conflictCount === 0 ? "good" : "warn"}
          />
        </div>
      </section>

      <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {DAYS.map((day) => {
            const count =
              typeof day.value === "number"
                ? countClassesForDay(grid, day.value)
                : onlineClasses.length;
            const active = selectedDay === day.value;

            return (
              <button
                key={day.value}
                type="button"
                onClick={() => onSelectDay(day.value)}
                className={`relative min-w-12 rounded-full border px-3 py-2 text-sm font-bold transition-colors ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : "border-[var(--line)] bg-[var(--control)] text-[var(--text-muted)]"
                }`}
              >
                {day.label}
                {count > 0 && (
                  <span
                    className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ${
                      active ? "bg-white" : "bg-[var(--accent)]"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {selectedDay === ONLINE_DAY ? (
          <MobileOnlineList
            classes={onlineClasses}
            onRemoveClass={onRemoveClass}
          />
        ) : (
          <MobileDayTimeline
            day={selectedDay}
            grid={grid}
            onRemoveClass={onRemoveClass}
          />
        )}
      </section>

      <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--text)]">履修候補</h2>
          <span className="text-xs text-[var(--text-faint)]">{classes.length}件</span>
        </div>
        {classes.length === 0 ? (
          <div className="rounded-md border border-[var(--line)] bg-[var(--control)] p-5 text-center text-sm text-[var(--text-muted)]">
            まだ候補はありません。
          </div>
        ) : (
          <ul className="space-y-2">
            {classes.map((klass) => (
              <li
                key={klass.id}
                className="rounded-md border border-[var(--line)] bg-[var(--control)] p-3"
              >
                <MobileClassHeader klass={klass} />
                <button
                  type="button"
                  onClick={() => onRemoveClass(klass.id)}
                  className="mt-3 text-xs font-semibold text-[var(--text-faint)] transition-colors hover:text-[var(--text)]"
                >
                  候補から外す
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function MobileMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "good" | "warn";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-300"
      : tone === "warn"
        ? "text-rose-300"
        : "text-[var(--text)]";

  return (
    <div className="min-w-[7.25rem] rounded-md border border-[var(--line)] bg-[var(--control)] px-3 py-2">
      <div className="text-[10px] font-semibold text-[var(--text-faint)]">
        {label}
      </div>
      <div className={`mt-1 text-sm font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}

function MobileDayTimeline({
  day,
  grid,
  onRemoveClass,
}: {
  day: number;
  grid: Map<string, ClassWithSlots[]>;
  onRemoveClass: (classId: string) => void;
}) {
  const occupiedPeriods = PERIODS.map((period) => ({
    ...period,
    classes: grid.get(`${day}-${period.value}`) ?? [],
  })).filter((period) => period.classes.length > 0);
  const freePeriods = PERIODS.filter(
    (period) => (grid.get(`${day}-${period.value}`) ?? []).length === 0
  );

  if (occupiedPeriods.length === 0) {
    return (
      <div className="rounded-md border border-[var(--line)] bg-[var(--control)] p-6 text-center">
        <div className="text-lg font-bold text-[var(--text)]">
          {getDayLabel(day)}曜は空いています
        </div>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          全休候補としてかなりきれいです。
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-lg font-bold text-[var(--text)]">{getDayLabel(day)}曜</h3>
        <div className="text-xs text-[var(--text-faint)]">
          空き {freePeriods.map((period) => `${period.value}限`).join("・") || "なし"}
        </div>
      </div>
      <div className="space-y-3">
        {occupiedPeriods.map((period) => (
          <div key={period.value} className="grid grid-cols-[4.25rem_1fr] gap-3">
            <div className="pt-1 text-right">
              <div className="text-sm font-bold text-[var(--text)]">
                {period.value}限
              </div>
              <div className="mt-1 text-[10px] leading-tight text-[var(--text-faint)]">
                {period.time}
              </div>
            </div>
            <div className="space-y-2 border-l border-[var(--line)] pl-3">
              {period.classes.map((klass) => (
                <MobileTimelineCard
                  key={klass.id}
                  klass={klass}
                  onRemoveClass={onRemoveClass}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MobileOnlineList({
  classes,
  onRemoveClass,
}: {
  classes: ClassWithSlots[];
  onRemoveClass: (classId: string) => void;
}) {
  if (classes.length === 0) {
    return (
      <div className="rounded-md border border-[var(--line)] bg-[var(--control)] p-6 text-center">
        <div className="text-lg font-bold text-[var(--text)]">オンライン授業なし</div>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          曜日時限のある授業だけで組まれています。
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-lg font-bold text-[var(--text)]">フルオンデマンド</h3>
        <div className="text-xs text-[var(--text-faint)]">
          {formatCredits(sumCredits(classes))}単位
        </div>
      </div>
      <div className="space-y-2">
        {classes.map((klass) => (
          <MobileTimelineCard
            key={klass.id}
            klass={klass}
            onRemoveClass={onRemoveClass}
            compact
          />
        ))}
      </div>
    </div>
  );
}

function MobileTimelineCard({
  klass,
  onRemoveClass,
  compact = false,
}: {
  klass: ClassWithSlots;
  onRemoveClass: (classId: string) => void;
  compact?: boolean;
}) {
  return (
    <div className="rounded-md border border-[var(--line)] bg-[var(--control)] p-3">
      <div className="border-l-2 border-[var(--accent)] pl-3">
        <MobileClassHeader klass={klass} compact={compact} />
      </div>
      <button
        type="button"
        onClick={() => onRemoveClass(klass.id)}
        className="mt-3 text-xs font-semibold text-[var(--text-faint)] transition-colors hover:text-[var(--text)]"
      >
        候補から外す
      </button>
    </div>
  );
}

function MobileClassHeader({
  klass,
  compact = false,
}: {
  klass: ClassWithSlots;
  compact?: boolean;
}) {
  return (
    <>
      <Link
        href={`/classes/${encodeURIComponent(klass.id)}`}
        className={`block font-bold leading-snug text-[var(--text)] hover:underline ${
          compact ? "text-sm" : "text-base"
        }`}
      >
        {klass.name}
      </Link>
      <div className="mt-1 text-xs text-[var(--text-muted)]">
        {klass.teacher ?? "教員未定"}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-semibold text-[var(--text-muted)]">
        <span className="rounded border border-[var(--line)] px-1.5 py-0.5">
          {klass.faculty}
        </span>
        {klass.credits != null && (
          <span className="rounded border border-[var(--line)] px-1.5 py-0.5">
            {formatCredits(klass.credits)}単位
          </span>
        )}
        {(klass.method_type ?? klass.class_format) && (
          <span className="rounded border border-[var(--line)] px-1.5 py-0.5">
            {klass.method_type ?? klass.class_format}
          </span>
        )}
      </div>
    </>
  );
}

function countClassesForDay(grid: Map<string, ClassWithSlots[]>, day: number) {
  return PERIODS.reduce(
    (sum, period) => sum + (grid.get(`${day}-${period.value}`)?.length ?? 0),
    0
  );
}

function getDayLabel(day: number) {
  return WEEKDAY_DAYS.find((item) => item.value === day)?.label ?? "";
}

function sumCredits(classes: Pick<ClassWithSlots, "credits">[]) {
  return classes.reduce((sum, klass) => sum + Number(klass.credits ?? 0), 0);
}

function formatCredits(value: number | string | null) {
  const numeric = Number(value ?? 0);
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--text-muted)]">
      {children}
    </div>
  );
}
