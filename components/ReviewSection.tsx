"use client";

import { useCallback, useEffect, useState } from "react";

type Review = {
  id: string;
  class_id: string;
  rating: number;
  body: string;
  taken_year: number;
  taken_term: string;
  helpful_count: number;
  created_at: string;
  exam_format: string | null;
  bring_in: string | null;
  exam_minutes: number | null;
  difficulty: number | null;
  mark_writing_balance: number | null;
  time_intensity: number | null;
};

const TERMS = ["春学期", "秋学期", "通年", "夏期", "冬期"];
const EXAM_FORMATS = [
  "筆記",
  "レポート",
  "オンライン",
  "プレゼン",
  "なし",
  "その他",
];
const BRING_IN_OPTIONS = ["不可", "一部可", "全可"];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => CURRENT_YEAR - i);

export function ReviewSection({ classId }: { classId: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [takenYear, setTakenYear] = useState(CURRENT_YEAR);
  const [takenTerm, setTakenTerm] = useState("春学期");

  const [examFormat, setExamFormat] = useState("");
  const [bringIn, setBringIn] = useState("");
  const [examMinutes, setExamMinutes] = useState("");
  const [difficulty, setDifficulty] = useState(0);
  const [timeIntensity, setTimeIntensity] = useState(0);
  const [markWritingBalance, setMarkWritingBalance] = useState(50);
  const [includeBalance, setIncludeBalance] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    try {
      const res = await fetch(`/api/reviews?class_id=${classId}`);
      const data = await res.json();
      setReviews(data.reviews ?? []);
    } catch {
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchReviews();
  }, [fetchReviews]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (rating < 1 || rating > 5) {
      setMessage("評価を選んでください");
      return;
    }
    if (body.length < 10) {
      setMessage("本文は10文字以上で入力してください");
      return;
    }
    if (body.length > 1000) {
      setMessage("本文は1000文字以下で入力してください");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        class_id: classId,
        rating,
        body,
        taken_year: takenYear,
        taken_term: takenTerm,
        exam_format: examFormat || null,
        bring_in: bringIn || null,
        exam_minutes: examMinutes ? parseInt(examMinutes, 10) : null,
        difficulty: difficulty > 0 ? difficulty : null,
        time_intensity: timeIntensity > 0 ? timeIntensity : null,
        mark_writing_balance: includeBalance ? markWritingBalance : null,
      };

      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error ?? "投稿に失敗しました");
        return;
      }

      setMessage(data.message ?? "投稿しました");
      setRating(0);
      setBody("");
      setExamFormat("");
      setBringIn("");
      setExamMinutes("");
      setDifficulty(0);
      setTimeIntensity(0);
      setMarkWritingBalance(50);
      setIncludeBalance(false);
      setShowForm(false);
      await fetchReviews();
    } catch {
      setMessage("ネットワークエラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  };

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-3xl font-bold">
              {reviews.length > 0 ? avgRating.toFixed(1) : "—"}
            </div>
            <div>
              <div className="text-sm text-yellow-400">
                {"★".repeat(Math.round(avgRating))}
                <span className="text-[var(--text-faint)] opacity-45">
                  {"★".repeat(5 - Math.round(avgRating))}
                </span>
              </div>
              <div className="mt-1 text-xs text-[var(--text-faint)]">
                {reviews.length} 件のレビュー
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-strong)]"
          >
            {showForm ? "閉じる" : "レビューを書く"}
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-md border border-[var(--line)] bg-[var(--surface)] p-4"
        >
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--text)]">
              評価 <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className="text-2xl transition-transform hover:scale-110"
                >
                  <span className={n <= rating ? "text-yellow-400" : "text-[var(--text-faint)] opacity-45"}>
                    ★
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium text-[var(--text)]">
                履修年度 <span className="text-red-400">*</span>
              </label>
              <select
                value={takenYear}
                onChange={(e) => setTakenYear(parseInt(e.target.value, 10))}
                className="w-full rounded-md border border-[var(--line)] bg-[var(--control)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--line-strong)]"
              >
                {YEAR_OPTIONS.map((year) => (
                  <option key={year} value={year}>
                    {year}年度
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium text-[var(--text)]">
                学期 <span className="text-red-400">*</span>
              </label>
              <select
                value={takenTerm}
                onChange={(e) => setTakenTerm(e.target.value)}
                className="w-full rounded-md border border-[var(--line)] bg-[var(--control)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--line-strong)]"
              >
                {TERMS.map((term) => (
                  <option key={term} value={term}>
                    {term}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--text)]">
              レビュー本文（{body.length}/1000文字）
              <span className="text-red-400">*</span>
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="授業の感想を10文字以上で書いてください"
              className="w-full resize-none rounded-md border border-[var(--line)] bg-[var(--control)] px-3 py-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-faint)] focus:border-[var(--line-strong)]"
            />
          </div>

          <div className="border-t border-[var(--line)] pt-4">
            <h3 className="mb-3 text-sm font-medium text-[var(--text)]">
              試験情報（任意）
            </h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-[var(--text-muted)]">試験形式</label>
                <select
                  value={examFormat}
                  onChange={(e) => setExamFormat(e.target.value)}
                  className="w-full rounded-md border border-[var(--line)] bg-[var(--control)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--line-strong)]"
                >
                  <option value="">未指定</option>
                  {EXAM_FORMATS.map((format) => (
                    <option key={format} value={format}>
                      {format}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-[var(--text-muted)]">持込</label>
                  <select
                    value={bringIn}
                    onChange={(e) => setBringIn(e.target.value)}
                    className="w-full rounded-md border border-[var(--line)] bg-[var(--control)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--line-strong)]"
                  >
                    <option value="">未指定</option>
                    {BRING_IN_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-[var(--text-muted)]">試験時間(分)</label>
                  <input
                    type="number"
                    value={examMinutes}
                    onChange={(e) => setExamMinutes(e.target.value)}
                    placeholder="例: 90"
                    min="0"
                    max="600"
                    className="w-full rounded-md border border-[var(--line)] bg-[var(--control)] px-3 py-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-faint)] focus:border-[var(--line-strong)]"
                  />
                </div>
              </div>

              <RatingDots
                label="時間のキツさ"
                value={timeIntensity}
                activeClassName="text-rose-600"
                symbol="◆"
                onChange={setTimeIntensity}
              />
              <RatingDots
                label="難易度"
                value={difficulty}
                activeClassName="text-orange-400"
                symbol="◆"
                onChange={setDifficulty}
              />

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs text-[var(--text-muted)]">出題形式の比率</label>
                  <button
                    type="button"
                    onClick={() => setIncludeBalance(!includeBalance)}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
                  >
                    {includeBalance ? "未指定にする" : "指定する"}
                  </button>
                </div>
                {includeBalance && (
                  <>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-blue-400">マーク {markWritingBalance}%</span>
                      <span className="text-orange-400">
                        記述 {100 - markWritingBalance}%
                      </span>
                    </div>
                    <div className="relative h-2">
                      <div className="absolute inset-0 flex overflow-hidden rounded-full">
                        <div
                          className="bg-blue-400"
                          style={{ width: `${markWritingBalance}%` }}
                        />
                        <div
                          className="bg-orange-400"
                          style={{ width: `${100 - markWritingBalance}%` }}
                        />
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={markWritingBalance}
                        onChange={(e) =>
                          setMarkWritingBalance(parseInt(e.target.value, 10))
                        }
                        className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent
                          [&::-moz-range-thumb]:h-4
                          [&::-moz-range-thumb]:w-4
                          [&::-moz-range-thumb]:cursor-pointer
                          [&::-moz-range-thumb]:rounded-full
                          [&::-moz-range-thumb]:border-2
                          [&::-moz-range-thumb]:border-[var(--line)]
                          [&::-moz-range-thumb]:bg-[var(--text)]
                          [&::-webkit-slider-thumb]:h-4
                          [&::-webkit-slider-thumb]:w-4
                          [&::-webkit-slider-thumb]:cursor-pointer
                          [&::-webkit-slider-thumb]:appearance-none
                          [&::-webkit-slider-thumb]:rounded-full
                          [&::-webkit-slider-thumb]:border-2
                          [&::-webkit-slider-thumb]:border-[var(--line)]
                          [&::-webkit-slider-thumb]:bg-[var(--text)]"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

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
            {submitting ? "投稿中..." : "投稿する"}
          </button>
        </form>
      )}

      {loading ? (
        <EmptyState>読み込み中...</EmptyState>
      ) : reviews.length === 0 ? (
        <EmptyState>まだレビューはありません。最初のレビュアーになりましょう。</EmptyState>
      ) : (
        <ul className="space-y-3">
          {reviews.map((review) => (
            <ReviewItem key={review.id} review={review} />
          ))}
        </ul>
      )}
    </div>
  );
}

function RatingDots({
  label,
  value,
  activeClassName,
  symbol,
  onChange,
}: {
  label: string;
  value: number;
  activeClassName: string;
  symbol: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-[var(--text-muted)]">{label}</label>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n === value ? 0 : n)}
            className="text-xl transition-transform hover:scale-110"
          >
            <span className={n <= value ? activeClassName : "text-[var(--text-faint)] opacity-45"}>
              {symbol}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--text-faint)]">
      {children}
    </div>
  );
}

function ReviewItem({ review }: { review: Review }) {
  const hasExamInfo =
    review.exam_format ||
    review.bring_in ||
    review.exam_minutes != null ||
    review.difficulty != null ||
    review.time_intensity != null ||
    review.mark_writing_balance != null;

  return (
    <li className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm text-yellow-400">
          {"★".repeat(review.rating)}
          <span className="text-[var(--text-faint)] opacity-45">{"★".repeat(5 - review.rating)}</span>
        </div>
        <div className="text-xs text-[var(--text-faint)]">
          {review.taken_year}年度 {review.taken_term}
        </div>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text)]">
        {review.body}
      </p>

      {hasExamInfo && (
        <div className="mt-3 space-y-2 border-t border-[var(--line)] pt-3">
          <div className="text-xs font-medium text-[var(--text-faint)]">試験情報</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
            {review.exam_format && <span>形式: {review.exam_format}</span>}
            {review.bring_in && <span>持込: {review.bring_in}</span>}
            {review.exam_minutes != null && <span>時間: {review.exam_minutes}分</span>}
            {review.time_intensity != null && (
              <span>
                時間キツさ:{" "}
                <span className="text-rose-600">
                  {"◆".repeat(review.time_intensity)}
                </span>
                <span className="text-[var(--text-faint)] opacity-45">
                  {"◆".repeat(5 - review.time_intensity)}
                </span>
              </span>
            )}
            {review.difficulty != null && (
              <span>
                難易度:{" "}
                <span className="text-orange-400">
                  {"◆".repeat(review.difficulty)}
                </span>
                <span className="text-[var(--text-faint)] opacity-45">
                  {"◆".repeat(5 - review.difficulty)}
                </span>
              </span>
            )}
          </div>
          {review.mark_writing_balance != null && (
            <div className="text-xs">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-blue-400">
                  マーク {review.mark_writing_balance}%
                </span>
                <span className="text-orange-400">
                  記述 {100 - review.mark_writing_balance}%
                </span>
              </div>
              <div className="flex h-1.5 overflow-hidden rounded-full bg-[var(--control)]">
                <div
                  className="bg-blue-400"
                  style={{ width: `${review.mark_writing_balance}%` }}
                />
                <div
                  className="bg-orange-400"
                  style={{ width: `${100 - review.mark_writing_balance}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {review.helpful_count > 0 && (
        <div className="mt-2 text-xs text-[var(--text-faint)]">
          ♡ {review.helpful_count} 人が参考になったと回答
        </div>
      )}
    </li>
  );
}
