"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { ClassWithSlots } from "@/lib/types";

type SavedClassRow = {
  class_id: string;
  created_at: string;
  classes: ClassWithSlots | null;
};

const DAYS = [
  { value: 1, label: "月" },
  { value: 2, label: "火" },
  { value: 3, label: "水" },
  { value: 4, label: "木" },
  { value: 5, label: "金" },
  { value: 6, label: "土" },
];

const PERIODS = [1, 2, 3, 4, 5, 6, 7];

export function PlannerClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SavedClassRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);

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
  const grid = useMemo(() => buildGrid(classes), [classes]);

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
    <div className="grid gap-5 lg:grid-cols-[1.4fr_0.9fr]">
      <section className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
        <h2 className="mb-4 text-sm font-bold text-[var(--text)]">時間割プレビュー</h2>
        <div className="overflow-x-auto">
          <div className="min-w-[680px]">
            <div className="grid grid-cols-[3rem_repeat(6,1fr)] border-b border-[var(--line)] text-center text-xs font-semibold text-[var(--text-muted)]">
              <div className="p-2" />
              {DAYS.map((day) => (
                <div key={day.value} className="border-l border-[var(--line)] p-2">
                  {day.label}
                </div>
              ))}
            </div>
            {PERIODS.map((period) => (
              <div
                key={period}
                className="grid min-h-24 grid-cols-[3rem_repeat(6,1fr)] border-b border-[var(--line)] last:border-b-0"
              >
                <div className="flex items-center justify-center text-xs font-semibold text-[var(--text-faint)]">
                  {period}
                </div>
                {DAYS.map((day) => {
                  const cellClasses = grid.get(`${day.value}-${period}`) ?? [];

                  return (
                    <div
                      key={day.value}
                      className="border-l border-[var(--line)] p-1.5"
                    >
                      <div className="space-y-1">
                        {cellClasses.map((klass) => (
                          <Link
                            key={klass.id}
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
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
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
  );
}

function buildGrid(classes: ClassWithSlots[]) {
  const grid = new Map<string, ClassWithSlots[]>();

  for (const klass of classes) {
    for (const slot of klass.class_slots ?? []) {
      const key = `${slot.day_of_week}-${slot.period}`;
      grid.set(key, [...(grid.get(key) ?? []), klass]);
    }
  }

  return grid;
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--text-muted)]">
      {children}
    </div>
  );
}
