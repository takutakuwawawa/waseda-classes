"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export function PlanButton({ classId }: { classId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        if (alive) setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("saved_classes")
        .select("class_id")
        .eq("user_id", userData.user.id)
        .eq("class_id", classId)
        .maybeSingle();

      if (alive) {
        setSaved(Boolean(data));
        setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [classId]);

  async function toggleSaved() {
    setMessage(null);
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      router.push("/login");
      return;
    }

    setBusy(true);

    if (saved) {
      const { error } = await supabase
        .from("saved_classes")
        .delete()
        .eq("user_id", userData.user.id)
        .eq("class_id", classId);

      if (error) {
        setMessage(error.message);
      } else {
        setSaved(false);
      }
    } else {
      const { error } = await supabase.from("saved_classes").insert({
        user_id: userData.user.id,
        class_id: classId,
      });

      if (error) {
        setMessage(error.message);
      } else {
        setSaved(true);
      }
    }

    setBusy(false);
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button
        type="button"
        onClick={toggleSaved}
        disabled={loading || busy}
        className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          saved
            ? "border border-[var(--line)] bg-[var(--control)] text-[var(--text)] hover:border-[var(--line-strong)]"
            : "bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]"
        }`}
      >
        {loading
          ? "確認中..."
          : busy
            ? "処理中..."
            : saved
              ? "候補から外す"
              : "履修候補に追加"}
      </button>
      {message && <div className="text-xs text-[var(--text-muted)]">{message}</div>}
    </div>
  );
}
