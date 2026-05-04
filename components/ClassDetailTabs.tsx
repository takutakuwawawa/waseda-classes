"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { BbsSection } from "@/components/BbsSection";
import { ReviewSection } from "@/components/ReviewSection";
import type { ClassWithSlots } from "@/lib/types";

type Tab = "reviews" | "bbs" | "overview";

const TABS: { id: Tab; label: string }[] = [
  { id: "reviews", label: "口コミ" },
  { id: "bbs", label: "BBS" },
  { id: "overview", label: "授業概要" },
];

export function ClassDetailTabs({
  row,
  overview,
}: {
  row: ClassWithSlots;
  overview: ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("reviews");

  return (
    <div>
      <div className="mb-4 border-b border-[var(--line)]">
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-[var(--accent)] text-[var(--text)]"
                  : "border-transparent text-[var(--text-faint)] hover:text-[var(--text-muted)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "reviews" && <ReviewSection classId={row.id} />}
      {activeTab === "bbs" && <BbsSection classId={row.id} />}
      {activeTab === "overview" && overview}
    </div>
  );
}
