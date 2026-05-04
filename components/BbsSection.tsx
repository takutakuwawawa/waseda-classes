"use client";

import { useCallback, useEffect, useState } from "react";
import { generateAnonId } from "@/lib/anonId";

type Post = {
  id: string;
  class_id: string;
  anon_id: string;
  body: string;
  like_count: number;
  created_at: string;
};

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return "たった今";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}分前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}時間前`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}日前`;
  return new Date(iso).toLocaleDateString("ja-JP");
}

export function BbsSection({ classId }: { classId: string }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch(`/api/posts?class_id=${classId}`);
      const data = await res.json();
      setPosts(data.posts ?? []);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPosts();
  }, [fetchPosts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (body.trim().length < 1) return;
    if (body.length > 500) {
      setMessage("500文字以内で入力してください");
      return;
    }

    setSubmitting(true);
    try {
      const anonId = await generateAnonId(classId);
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_id: classId,
          body: body.trim(),
          anon_id: anonId,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error ?? "投稿に失敗しました");
        return;
      }

      if (data.message) setMessage(data.message);
      setBody("");
      await fetchPosts();
    } catch {
      setMessage("ネットワークエラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4"
      >
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="この授業について書き込む..."
          className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
          maxLength={500}
        />
        <div className="mt-2 flex items-center justify-between">
          <div className="text-xs text-zinc-500">
            匿名で投稿されます ({body.length}/500)
          </div>
          <button
            type="submit"
            disabled={submitting || body.trim().length === 0}
            className="rounded-lg bg-zinc-100 px-4 py-1.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "送信中..." : "送信"}
          </button>
        </div>
        {message && (
          <div className="mt-2 rounded-lg bg-zinc-800 p-3 text-sm text-zinc-300">
            {message}
          </div>
        )}
      </form>

      {loading ? (
        <EmptyState>読み込み中...</EmptyState>
      ) : posts.length === 0 ? (
        <EmptyState>まだ投稿はありません。</EmptyState>
      ) : (
        <ul className="space-y-2">
          {posts.map((post) => (
            <li
              key={post.id}
              className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
            >
              <div className="mb-1 flex items-center justify-between">
                <div className="text-xs font-medium text-zinc-400">
                  受講生 {post.anon_id}
                </div>
                <div className="text-xs text-zinc-500">
                  {formatRelativeTime(post.created_at)}
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                {post.body}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-8 text-center text-sm text-zinc-500">
      {children}
    </div>
  );
}
