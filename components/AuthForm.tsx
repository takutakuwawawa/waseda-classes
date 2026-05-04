"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { displayIdToEmail, normalizeDisplayId, validateDisplayId, validatePassword } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { FACULTIES } from "@/lib/types";

type Mode = "login" | "register";

const SCHOOL_YEARS = [1, 2, 3, 4, 5, 6];

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [displayId, setDisplayId] = useState("");
  const [password, setPassword] = useState("");
  const [faculty, setFaculty] = useState("");
  const [schoolYear, setSchoolYear] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const normalizedId = normalizeDisplayId(displayId);
    const idError = validateDisplayId(normalizedId);
    if (idError) {
      setMessage(idError);
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setMessage(passwordError);
      return;
    }

    setSubmitting(true);
    const email = displayIdToEmail(normalizedId);

    try {
      if (mode === "register") {
        const registerRes = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            display_id: normalizedId,
            password,
            faculty: faculty || null,
            school_year: schoolYear ? Number(schoolYear) : null,
          }),
        });
        const registerData = await registerRes.json();

        if (!registerRes.ok) {
          setMessage(registerData.error ?? "登録に失敗しました");
          return;
        }

        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setMessage("登録しました。ログイン画面からもう一度ログインしてください。");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setMessage("IDまたはパスワードが違います");
          return;
        }
      }

      startTransition(() => {
        router.push("/");
        router.refresh();
      });
    } catch {
      setMessage("予期しないエラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setMessage(null);
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-md border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="mb-5 grid grid-cols-2 rounded-md border border-[var(--line)] bg-[var(--control)] p-1">
        <button
          type="button"
          onClick={() => switchMode("login")}
          className={`rounded px-3 py-2 text-sm font-semibold transition-colors ${
            mode === "login"
              ? "bg-[var(--accent)] text-white"
              : "text-[var(--text-muted)] hover:text-[var(--text)]"
          }`}
        >
          ログイン
        </button>
        <button
          type="button"
          onClick={() => switchMode("register")}
          className={`rounded px-3 py-2 text-sm font-semibold transition-colors ${
            mode === "register"
              ? "bg-[var(--accent)] text-white"
              : "text-[var(--text-muted)] hover:text-[var(--text)]"
          }`}
        >
          新規登録
        </button>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Field label="ID">
          <input
            value={displayId}
            onChange={(event) => setDisplayId(event.target.value)}
            autoCapitalize="none"
            autoComplete="username"
            placeholder="例: minerva_user"
            className="auth-input"
          />
        </Field>

        <Field label="パスワード">
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder="8文字以上"
            className="auth-input"
          />
        </Field>

        {mode === "register" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="学部">
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
            </Field>

            <Field label="学年">
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
            </Field>
          </div>
        )}

        {message && (
          <div className="rounded-md border border-[var(--line)] bg-[var(--control)] p-3 text-sm text-[var(--text)]">
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "処理中..." : mode === "login" ? "ログイン" : "登録する"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-[var(--text-muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}
