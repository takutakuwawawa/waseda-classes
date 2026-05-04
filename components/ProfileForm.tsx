"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/auth";
import { FACULTIES } from "@/lib/types";

const SCHOOL_YEARS = [1, 2, 3, 4, 5, 6];

export function ProfileForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [faculty, setFaculty] = useState("");
  const [schoolYear, setSchoolYear] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;

    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push("/login");
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userData.user.id)
        .maybeSingle();

      if (!alive) return;

      const nextProfile = (data as Profile | null) ?? null;
      setProfile(nextProfile);
      setFaculty(nextProfile?.faculty ?? "");
      setSchoolYear(nextProfile?.school_year ? String(nextProfile.school_year) : "");
      setLoading(false);
    }

    load();

    return () => {
      alive = false;
    };
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;

    setSaving(true);
    setMessage(null);

    const { error } = await supabase
      .from("profiles")
      .update({
        faculty: faculty || null,
        school_year: schoolYear ? Number(schoolYear) : null,
      })
      .eq("id", profile.id);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("保存しました");
      router.refresh();
    }

    setSaving(false);
  }

  if (loading) {
    return <Panel>読み込み中...</Panel>;
  }

  if (!profile) {
    return <Panel>プロフィールが見つかりません。</Panel>;
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto w-full max-w-md rounded-md border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
    >
      <div className="mb-5">
        <div className="text-xs font-semibold text-[var(--text-faint)]">ID</div>
        <div className="mt-1 text-lg font-bold text-[var(--text)]">
          {profile.display_id}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-[var(--text-muted)]">
            学部
          </span>
          <select
            value={faculty}
            onChange={(event) => setFaculty(event.target.value)}
            className="auth-input"
          >
            <option value="">未設定</option>
            {FACULTIES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-[var(--text-muted)]">
            学年
          </span>
          <select
            value={schoolYear}
            onChange={(event) => setSchoolYear(event.target.value)}
            className="auth-input"
          >
            <option value="">未設定</option>
            {SCHOOL_YEARS.map((year) => (
              <option key={year} value={year}>
                {year}年
              </option>
            ))}
          </select>
        </label>
      </div>

      {message && (
        <div className="mt-4 rounded-md border border-[var(--line)] bg-[var(--control)] p-3 text-sm text-[var(--text)]">
          {message}
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="mt-5 w-full rounded-md bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "保存中..." : "保存する"}
      </button>
    </form>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md rounded-md border border-[var(--line)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--text-muted)]">
      {children}
    </div>
  );
}
