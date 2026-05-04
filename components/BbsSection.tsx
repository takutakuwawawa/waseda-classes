"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { generateAnonId } from "@/lib/anonId";

type Post = {
  id: string;
  class_id: string;
  anon_id: string;
  body: string;
  like_count: number | null;
  dislike_count?: number | null;
  created_at: string;
};

type VoteChoice = "up" | "down";

const VOTE_STORAGE_KEY = "minerva-bbs-votes-v1";

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

function readStoredVotes(): Record<string, VoteChoice> {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(VOTE_STORAGE_KEY);
    if (!raw) return {};

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        ([, value]) => value === "up" || value === "down"
      )
    ) as Record<string, VoteChoice>;
  } catch {
    return {};
  }
}

function persistVotes(votes: Record<string, VoteChoice>) {
  try {
    window.localStorage.setItem(VOTE_STORAGE_KEY, JSON.stringify(votes));
  } catch {
    // 投票の保存に失敗しても、投稿閲覧自体は続けられるようにする。
  }
}

function normalizePost(post: Post): Post {
  return {
    ...post,
    like_count: post.like_count ?? 0,
    dislike_count: post.dislike_count ?? 0,
  };
}

function applyVoteDelta(post: Post, likeDelta: number, dislikeDelta: number): Post {
  return {
    ...post,
    like_count: Math.max(0, (post.like_count ?? 0) + likeDelta),
    dislike_count: Math.max(0, (post.dislike_count ?? 0) + dislikeDelta),
  };
}

export function BbsSection({ classId }: { classId: string }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [votes, setVotes] = useState<Record<string, VoteChoice>>({});
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [votingPostId, setVotingPostId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch(`/api/posts?class_id=${classId}`);
      const data = await res.json();
      const nextPosts = Array.isArray(data.posts)
        ? (data.posts as Post[]).map(normalizePost)
        : [];
      setPosts(nextPosts);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVotes(readStoredVotes());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPosts();
  }, [fetchPosts]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);

    const trimmedBody = body.trim();
    if (trimmedBody.length < 1) return;
    if (trimmedBody.length > 500) {
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
          body: trimmedBody,
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

  const handleVote = async (postId: string, choice: VoteChoice) => {
    if (votingPostId) return;

    const previousVote = votes[postId] ?? null;
    const nextVote = previousVote === choice ? null : choice;
    const likeDelta =
      (previousVote === "up" ? -1 : 0) + (nextVote === "up" ? 1 : 0);
    const dislikeDelta =
      (previousVote === "down" ? -1 : 0) + (nextVote === "down" ? 1 : 0);

    if (likeDelta === 0 && dislikeDelta === 0) return;

    const nextVotes = { ...votes };
    if (nextVote) {
      nextVotes[postId] = nextVote;
    } else {
      delete nextVotes[postId];
    }

    setMessage(null);
    setVotes(nextVotes);
    persistVotes(nextVotes);
    setPosts((currentPosts) =>
      currentPosts.map((post) =>
        post.id === postId ? applyVoteDelta(post, likeDelta, dislikeDelta) : post
      )
    );
    setVotingPostId(postId);

    try {
      const res = await fetch("/api/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post_id: postId,
          like_delta: likeDelta,
          dislike_delta: dislikeDelta,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "投票に失敗しました");
      }

      if (data.post) {
        setPosts((currentPosts) =>
          currentPosts.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  like_count: data.post.like_count ?? 0,
                  dislike_count: data.post.dislike_count ?? 0,
                }
              : post
          )
        );
      }
    } catch (error) {
      setVotes(votes);
      persistVotes(votes);
      setPosts((currentPosts) =>
        currentPosts.map((post) =>
          post.id === postId
            ? applyVoteDelta(post, -likeDelta, -dislikeDelta)
            : post
        )
      );
      setMessage(
        error instanceof Error
          ? error.message
          : "投票の保存に失敗しました。少し時間を置いて再試行してください。"
      );
    } finally {
      setVotingPostId(null);
    }
  };

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit}
        className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4"
      >
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="この授業について書き込む..."
          className="w-full resize-none rounded-md border border-[var(--line)] bg-[var(--control)] px-3 py-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-faint)] focus:border-[var(--line-strong)]"
          maxLength={500}
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="text-xs text-[var(--text-faint)]">
            匿名で投稿されます ({body.length}/500)
          </div>
          <button
            type="submit"
            disabled={submitting || body.trim().length === 0}
            className="rounded-md bg-[var(--accent)] px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "送信中..." : "送信"}
          </button>
        </div>
        {message && (
          <div className="mt-3 rounded-md border border-[var(--line)] bg-[var(--control)] p-3 text-sm text-[var(--text)]">
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
          {posts.map((post) => {
            const currentVote = votes[post.id] ?? null;

            return (
              <li
                key={post.id}
                className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold text-[var(--text-muted)]">
                    受講生 {post.anon_id}
                  </div>
                  <div className="text-xs text-[var(--text-faint)]">
                    {formatRelativeTime(post.created_at)}
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text)]">
                  {post.body}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <VoteButton
                    label="この投稿に賛成"
                    active={currentVote === "up"}
                    count={post.like_count ?? 0}
                    icon="👍"
                    disabled={votingPostId === post.id}
                    onClick={() => handleVote(post.id, "up")}
                  />
                  <VoteButton
                    label="この投稿に反対"
                    active={currentVote === "down"}
                    count={post.dislike_count ?? 0}
                    icon="👎"
                    disabled={votingPostId === post.id}
                    onClick={() => handleVote(post.id, "down")}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function VoteButton({
  label,
  active,
  count,
  icon,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  count: number;
  icon: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-w-16 items-center justify-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors disabled:cursor-wait disabled:opacity-70 ${
        active
          ? "border-[var(--line-strong)] bg-[var(--accent-soft)] text-[var(--text)]"
          : "border-[var(--line)] bg-[var(--control)] text-[var(--text-muted)] hover:border-[var(--line-strong)] hover:text-[var(--text)]"
      }`}
    >
      <span aria-hidden="true">{icon}</span>
      <span>{count}</span>
    </button>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--text-faint)]">
      {children}
    </div>
  );
}
