import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const classId = searchParams.get("class_id");

  if (!classId) {
    return NextResponse.json({ error: "class_id is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("class_id", classId)
    .eq("status", "approved")
    .eq("hidden", false)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ posts: data });
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const { class_id, body: text, anon_id } = payload;

    if (!class_id || !text || !anon_id) {
      return NextResponse.json(
        { error: "必須項目が入力されていません" },
        { status: 400 }
      );
    }

    if (typeof text !== "string" || text.length < 1 || text.length > 500) {
      return NextResponse.json(
        { error: "本文は1〜500文字で入力してください" },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9]{3}$/.test(anon_id)) {
      return NextResponse.json({ error: "不正な形式です" }, { status: 400 });
    }

    const { data: ngWords } = await supabase.from("ng_words").select("word");
    const hasNgWord = ngWords?.some((ng) =>
      text.toLowerCase().includes(ng.word.toLowerCase())
    );
    const status = hasNgWord ? "pending" : "approved";

    const { data, error } = await supabase
      .from("posts")
      .insert({
        class_id,
        anon_id,
        body: text,
        status,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      post: data,
      message: hasNgWord
        ? "投稿を受け付けました。内容確認後に表示されます。"
        : null,
    });
  } catch {
    return NextResponse.json(
      { error: "予期しないエラーが発生しました" },
      { status: 500 }
    );
  }
}
