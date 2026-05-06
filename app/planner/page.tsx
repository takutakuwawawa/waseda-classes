import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { PlannerClient } from "@/components/PlannerClient";

export default function PlannerPage() {
  return (
    <main className="min-h-dvh bg-[var(--bg)] text-[var(--text)]">
      <AppHeader />

      <div className="mx-auto max-w-6xl px-4 pb-24 pt-20 sm:px-5 md:pb-10 md:pt-24">
        <Link
          href="/"
          className="text-sm font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
        >
          ← 検索に戻る
        </Link>

        <header className="mb-5 mt-5 md:mb-6">
          <h1 className="text-3xl font-bold tracking-tight md:text-2xl">履修プラン</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            追加した授業候補を時間割として確認できます。
          </p>
        </header>

        <PlannerClient />
      </div>
    </main>
  );
}
