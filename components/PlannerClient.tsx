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

const DAYS = [
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
        className="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full bg-[var(--text)] px-4 py-3 text-sm font-medium text-[var(--bg)] shadow-lg transition-opacity hover:opacity-80"
      >
        ✦ AI 履修相談
      </button>

      {/* AIチャットパネル */}
      <AiChatPanel
        savedClassIds={classes.map((c) => c.id)}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />

      <div className="grid gap-5 lg:grid-cols-[1.4fr_0.9fr]">
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

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--text-muted)]">
      {children}
    </div>
  );
}