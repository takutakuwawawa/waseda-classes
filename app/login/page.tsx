import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <main className="min-h-dvh bg-[var(--bg)] text-[var(--text)]">
      <AppHeader />

      <div className="mx-auto max-w-5xl px-5 pb-10 pt-24">
        <Link
          href="/"
          className="text-sm font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
        >
          ← 検索に戻る
        </Link>

        <header className="mb-6 mt-5 text-center">
          <h1 className="text-2xl font-bold">Minervaにログイン</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            メールアドレスは使わず、このサイト用のIDで入れます。
          </p>
        </header>

        <AuthForm />
      </div>
    </main>
  );
}
