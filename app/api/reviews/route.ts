import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const VALID_EXAM_FORMATS = [
  "筆記",
  "レポート",
  "オンライン",
  "プレゼン",
  "なし",
  "その他",
];
const VALID_BRING_IN = ["不可", "一部可", "全可"];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const classId = searchParams.get("class_id");

  if (!classId) {
    return NextResponse.json({ error: "class_id is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("class_id", classId)
    .eq("status", "approved")
    .order("helpful_count", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reviews: data });
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const {
      class_id,
      rating,
      body: text,
      taken_year,
      taken_term,
      exam_format,
      bring_in,
      exam_minutes,
      difficulty,
      mark_writing_balance,
      time_intensity,
    } = payload;

    if (!class_id || !rating || !text || !taken_year || !taken_term) {
      return NextResponse.json(
        { error: "必須項目が入力されていません" },
        { status: 400 }
      );
    }

    if (typeof rating !== "number" || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "評価は1〜5の範囲で指定してください" },
        { status: 400 }
      );
    }

    if (typeof text !== "string" || text.length < 10 || text.length > 1000) {
      return NextResponse.json(
        { error: "本文は10文字以上1000文字以下で入力してください" },
        { status: 400 }
      );
    }

    if (exam_format != null && !VALID_EXAM_FORMATS.includes(exam_format)) {
      return NextResponse.json({ error: "不正な試験形式です" }, { status: 400 });
    }
    if (bring_in != null && !VALID_BRING_IN.includes(bring_in)) {
      return NextResponse.json({ error: "不正な持込指定です" }, { status: 400 });
    }
    if (
      exam_minutes != null &&
      (typeof exam_minutes !== "number" || exam_minutes < 0 || exam_minutes > 600)
    ) {
      return NextResponse.json({ error: "不正な試験時間です" }, { status: 400 });
    }
    if (
      difficulty != null &&
      (typeof difficulty !== "number" || difficulty < 1 || difficulty > 5)
    ) {
      return NextResponse.json({ error: "不正な難易度です" }, { status: 400 });
    }
    if (
      time_intensity != null &&
      (typeof time_intensity !== "number" || time_intensity < 1 || time_intensity > 5)
    ) {
      return NextResponse.json(
        { error: "不正な時間のキツさです" },
        { status: 400 }
      );
    }
    if (
      mark_writing_balance != null &&
      (typeof mark_writing_balance !== "number" ||
        mark_writing_balance < 0 ||
        mark_writing_balance > 100)
    ) {
      return NextResponse.json({ error: "不正な比率です" }, { status: 400 });
    }

    const { data: ngWords } = await supabase.from("ng_words").select("word");
    const hasNgWord = ngWords?.some((ng) =>
      text.toLowerCase().includes(ng.word.toLowerCase())
    );
    const status = hasNgWord ? "pending" : "approved";

    const { data, error } = await supabase
      .from("reviews")
      .insert({
        class_id,
        rating,
        body: text,
        taken_year,
        taken_term,
        exam_format: exam_format ?? null,
        bring_in: bring_in ?? null,
        exam_minutes: exam_minutes ?? null,
        difficulty: difficulty ?? null,
        time_intensity: time_intensity ?? null,
        mark_writing_balance: mark_writing_balance ?? null,
        status,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      review: data,
      message: hasNgWord
        ? "投稿を受け付けました。内容確認後に表示されます。"
        : "投稿が反映されました。",
    });
  } catch {
    return NextResponse.json(
      { error: "予期しないエラーが発生しました" },
      { status: 500 }
    );
  }
}
