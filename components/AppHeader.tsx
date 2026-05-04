import Image from "next/image";
import Link from "next/link";
import { AuthMenu } from "@/components/AuthMenu";
import { ThemeToggle } from "@/components/ThemeToggle";

export function AppHeader() {
  return (
    <div className="fixed inset-x-0 top-0 z-10 border-b border-[var(--line)] bg-[var(--surface-strong)] backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5">
        <Link
          href="/"
          className="flex items-center gap-6 transition-opacity hover:opacity-85"
          aria-label="Minerva ホームに戻る"
        >
          <Image
            src="/minerva-logo.png"
            alt="Minerva"
            width={360}
            height={104}
            priority
            className="-mt-4 -mb-6 h-24 w-auto object-contain"
          />
          <div className="hidden whitespace-nowrap text-[10px] uppercase tracking-[0.24em] text-[var(--text-faint)] sm:block">
            Waseda course planner
          </div>
        </Link>
        <nav className="flex items-center gap-3 text-sm text-[var(--text-muted)] sm:gap-5">
          <span className="hidden sm:inline">ブックマーク</span>
          <Link
            href="/planner"
            className="hidden font-semibold transition-colors hover:text-[var(--text)] sm:inline"
          >
            履修プラン
          </Link>
          <ThemeToggle />
          <AuthMenu />
        </nav>
      </div>
    </div>
  );
}
