"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  TimetableProposalCard,
  type Proposal,
  type ProposedClass,
} from "@/components/TimetableProposalCard";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Mode = "chat" | "propose";

const CHAT_SUGGESTIONS = [
  "月曜日を空けて履修を組みたい",
  "楽に単位が取れる授業はある？",
  "今の時間割に重複はある？",
  "おすすめの一般教養を教えて",
];

export function AiChatPanel({
  savedClassIds,
  isOpen,
  onClose,
  onClassesAdded,
}: {
  savedClassIds: string[];
  isOpen: boolean;
  onClose: () => void;
  onClassesAdded?: () => void;
}) {
  const [mode, setMode] = useState<Mode>("chat");

  // チャットモード
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 提案モード
  const [proposeText, setProposeText] = useState("");
  const [targetCredits, setTargetCredits] = useState(20);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [proposeLoading, setProposeLoading] = useState(false);
  const [proposeError, setProposeError] = useState<string | null>(null);
  const [adoptingIndex, setAdoptingIndex] = useState<number | null>(null);
  const [forbiddenSlots, setForbiddenSlots] = useState<
    { day: number; period: number }[]
  >([]);

  const DAY_LABELS: Record<number, string> = {
    1: "月", 2: "火", 3: "水", 4: "木", 5: "金",
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // チャット送信
  const sendChat = async (text: string) => {
    if (!text.trim() || chatLoading) return;

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages,
          savedClassIds,
        }),
      });
      const data = await res.json();
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: res.ok
            ? data.reply
            : `エラー: ${data.error ?? "通信に失敗しました"}`,
        },
      ]);
    } catch {
      setMessages([
        ...newMessages,
        { role: "assistant", content: "通信エラーが発生しました。" },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // 時間割提案
  const handlePropose = async () => {
    if (!proposeText.trim() || proposeLoading) return;

    setProposeLoading(true);
    setProposeError(null);
    setProposals([]);
    setForbiddenSlots([]);

    try {
      const res = await fetch("/api/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userText: proposeText,
          savedClassIds,
          targetCredits,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setProposeError(data.error ?? "エラーが発生しました");
        return;
      }
      const nextProposals = data.proposals ?? [];
      setProposals(nextProposals);
      setForbiddenSlots(data.forbidden_slots ?? []);
      if (nextProposals.length === 0) {
        setProposeError(
          data.message ??
            "条件に合う時間割を作れませんでした。条件を少し変えてもう一度試してください。"
        );
      }
    } catch {
      setProposeError("通信エラーが発生しました。");
    } finally {
      setProposeLoading(false);
    }
  };

  // 提案を採用（saved_classesに追加）
  const handleAdopt = async (proposalIndex: number, classes: ProposedClass[]) => {
    setAdoptingIndex(proposalIndex);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        alert("ログインが必要です");
        return;
      }

      const rows = classes.map((c) => ({
        user_id: userData.user!.id,
        class_id: c.class_id,
      }));

      // 既に登録済みのものを除いて追加
      const newRows = rows.filter(
        (r) => !savedClassIds.includes(r.class_id)
      );

      if (newRows.length > 0) {
        const { error } = await supabase
          .from("saved_classes")
          .upsert(newRows, { onConflict: "user_id,class_id" });

        if (error) {
          alert(`追加エラー: ${error.message}`);
          return;
        }
      }

      onClassesAdded?.();
      alert(`${newRows.length}件の授業を履修候補に追加しました！`);
    } finally {
      setAdoptingIndex(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-0 right-0 top-0 z-40 flex w-full max-w-sm flex-col border-l border-[var(--line)] bg-[var(--bg)] shadow-2xl">
      {/* ヘッダー */}
      <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
        <div className="text-sm font-bold text-[var(--text)]">AI 履修相談</div>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--control)] hover:text-[var(--text)]"
        >
          ✕
        </button>
      </div>

      {/* モード切り替えタブ */}
      <div className="flex border-b border-[var(--line)]">
        {(["chat", "propose"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              mode === m
                ? "border-b-2 border-[var(--text)] text-[var(--text)]"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            {m === "chat" ? "💬 チャット" : "✦ 時間割を提案"}
          </button>
        ))}
      </div>

      {/* チャットモード */}
      {mode === "chat" && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-xs text-[var(--text-muted)] text-center">
                  履修の相談に乗ります。何でも聞いてください。
                </p>
                <div className="space-y-2">
                  {CHAT_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendChat(s)}
                      className="w-full rounded-md border border-[var(--line)] bg-[var(--control)] px-3 py-2 text-left text-xs text-[var(--text)] transition-colors hover:border-[var(--line-strong)]"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-[var(--text)] text-[var(--bg)]"
                      : "border border-[var(--line)] bg-[var(--surface)] text-[var(--text)]"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="flex justify-start">
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-muted)]">
                  考え中...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-[var(--line)] p-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendChat(chatInput);
                  }
                }}
                placeholder="履修について相談する..."
                className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--control)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none"
                disabled={chatLoading}
              />
              <button
                onClick={() => sendChat(chatInput)}
                disabled={chatLoading || !chatInput.trim()}
                className="rounded-lg bg-[var(--text)] px-3 py-2 text-sm font-medium text-[var(--bg)] disabled:opacity-40"
              >
                送信
              </button>
            </div>
            <div className="mt-1.5 text-center text-[10px] text-[var(--text-faint)]">
              AIの回答は参考情報です。正確な情報は公式シラバスをご確認ください
            </div>
          </div>
        </>
      )}

      {/* 時間割提案モード */}
      {mode === "propose" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {proposals.length === 0 && (
            <>
              <div className="space-y-3">
                <p className="text-xs text-[var(--text-muted)]">
                  バイト・部活・サークルなどの都合を自由に書いてください。AIが自動で時間割を組みます。
                </p>
                <textarea
                  value={proposeText}
                  onChange={(e) => setProposeText(e.target.value)}
                  rows={5}
                  placeholder={`例：\n月曜11時からバイトがあります。\n火曜は18時まで部活があります。\n楽な授業を多めに、20単位くらい取りたいです。`}
                  className="w-full rounded-lg border border-[var(--line)] bg-[var(--control)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] resize-none focus:outline-none"
                />

                <div className="flex items-center gap-3">
                  <label className="text-xs text-[var(--text-muted)] whitespace-nowrap">
                    目標単位数
                  </label>
                  <input
                    type="number"
                    value={targetCredits}
                    onChange={(e) => setTargetCredits(parseInt(e.target.value) || 20)}
                    min={4}
                    max={48}
                    className="w-20 rounded-lg border border-[var(--line)] bg-[var(--control)] px-2 py-1 text-sm text-[var(--text)] text-center focus:outline-none"
                  />
                  <span className="text-xs text-[var(--text-muted)]">単位</span>
                </div>

                {proposeError && (
                  <div className="rounded-lg bg-red-900/30 border border-red-700 px-3 py-2 text-xs text-red-300">
                    {proposeError}
                  </div>
                )}

                <button
                  onClick={handlePropose}
                  disabled={proposeLoading || !proposeText.trim()}
                  className="w-full rounded-lg bg-[var(--text)] px-4 py-2.5 text-sm font-medium text-[var(--bg)] disabled:opacity-40 transition-opacity hover:opacity-80"
                >
                  {proposeLoading ? "時間割を作成中..." : "✦ 時間割を提案してもらう"}
                </button>

                {proposeLoading && (
                  <div className="text-center space-y-1">
                    <div className="text-xs text-[var(--text-muted)]">
                      制約を解析中 → 授業を検索中 → 最適な組み合わせを考え中...
                    </div>
                    <div className="text-xs text-[var(--text-faint)]">
                      少し時間がかかります（10〜20秒）
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* 制約の確認表示 */}
          {proposals.length > 0 && forbiddenSlots.length > 0 && (
            <div className="rounded-lg border border-[var(--line)] bg-[var(--control)] p-3">
              <div className="text-xs font-medium text-[var(--text)] mb-1">
                認識した制約
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                以下の時間はNGとして除外しました：
                {forbiddenSlots.map((s, i) => (
                  <span key={i} className="ml-1 text-[var(--text)]">
                    {DAY_LABELS[s.day]}{s.period}限
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 提案カード */}
          {proposals.map((proposal, i) => (
            <TimetableProposalCard
              key={i}
              proposal={proposal}
              onAdopt={(classes) => handleAdopt(i, classes)}
              isAdopting={adoptingIndex === i}
            />
          ))}

          {/* やり直しボタン */}
          {proposals.length > 0 && (
            <button
              onClick={() => {
                setProposals([]);
                setForbiddenSlots([]);
                setProposeError(null);
              }}
              className="w-full rounded-lg border border-[var(--line)] px-4 py-2 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              条件を変えてやり直す
            </button>
          )}
        </div>
      )}
    </div>
  );
}
