"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/auth";

export function AuthMenu() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;

    async function loadProfile(nextUser: User | null) {
      setUser(nextUser);

      if (!nextUser) {
        setProfile(null);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", nextUser.id)
        .maybeSingle();

      if (alive) {
        setProfile((data as Profile | null) ?? null);
      }
    }

    supabase.auth.getUser().then(({ data }) => loadProfile(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      loadProfile(session?.user ?? null);
    });

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setOpen(false);
    router.refresh();
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="rounded-md border border-[var(--line)] bg-[var(--control)] px-3 py-1.5 text-xs font-semibold text-[var(--text)] transition-colors hover:border-[var(--line-strong)]"
      >
        ログイン
      </Link>
    );
  }

  const displayId =
    profile?.display_id ?? user.user_metadata.display_id ?? "user";
  const initial = displayId.slice(0, 1).toUpperCase();

  return (
    <div className="relative flex items-center gap-2">
      <span className="hidden text-xs font-semibold text-[var(--text-muted)] sm:inline">
        {displayId}
      </span>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-semibold text-white transition-colors hover:bg-[var(--accent-strong)]"
        aria-label="ユーザーメニュー"
        aria-expanded={open}
      >
        {initial}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-20 w-44 rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-1 shadow-xl">
          <MenuLink href="/profile" onClick={() => setOpen(false)}>
            プロフィール
          </MenuLink>
          <MenuLink href="/planner" onClick={() => setOpen(false)}>
            履修プラン
          </MenuLink>
          <button
            type="button"
            onClick={signOut}
            className="block w-full rounded px-3 py-2 text-left text-sm font-semibold text-[var(--text-muted)] transition-colors hover:bg-[var(--control)] hover:text-[var(--text)]"
          >
            ログアウト
          </button>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block rounded px-3 py-2 text-sm font-semibold text-[var(--text-muted)] transition-colors hover:bg-[var(--control)] hover:text-[var(--text)]"
    >
      {children}
    </Link>
  );
}
