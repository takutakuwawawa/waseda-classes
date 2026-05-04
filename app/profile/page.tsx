import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { ProfileForm } from "@/components/ProfileForm";

export default function ProfilePage() {
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
          <h1 className="text-2xl font-bold">プロフィール</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            履修提案で使う基本情報を保存します。
          </p>
        </header>

        <ProfileForm />
      </div>
    </main>
  );
}
