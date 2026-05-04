import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type VotePatchPayload = {
  post_id?: unknown;
  like_delta?: unknown;
  dislike_delta?: unknown;
};

type VoteResult = {
  id: string;
  like_count: number;
  dislike_count: number;
};

type Database = {
  public: {
    Tables: {
      ng_words: {
        Row: { word: string };
        Insert: { word: string };
        Update: { word?: string };
        Relationships: [];
      };
      posts: {
        Row: {
          id: string;
          class_id: string;
          anon_id: string;
          body: string;
          status: string;
          like_count: number | null;
          dislike_count: number | null;
          hidden: boolean;
          created_at: string;
        };
        Insert: {
          class_id: string;
          anon_id: string;
          body: string;
          status: string;
        };
        Update: {
          like_count?: number;
          dislike_count?: number;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      vote_post: {
        Args: {
          p_post_id: string;
          p_like_delta: number;
          p_dislike_delta: number;
        };
        Returns: VoteResult[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

let supabaseClient: SupabaseClient<Database> | null = null;

function getSupabase(): SupabaseClient<Database> {
  if (!supabaseClient) {
    supabaseClient = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  return supabaseClient;
}

function isValidVoteTransition(likeDelta: number, dislikeDelta: number) {
  return (
    (likeDelta === 1 && dislikeDelta === 0) ||
    (likeDelta === -1 && dislikeDelta === 0) ||
    (likeDelta === 0 && dislikeDelta === 1) ||
    (likeDelta === 0 && dislikeDelta === -1) ||
    (likeDelta === 1 && dislikeDelta === -1) ||
    (likeDelta === -1 && dislikeDelta === 1)
  );
}

function missingVoteStorageMessage(errorMessage: string) {
  if (!errorMessage.includes("dislike_count")) return null;

  return "BBS投票用のDB列が未追加です。supabase/migrations/20260504_add_bbs_dislike_votes.sql をSupabase SQL Editorで実行してください。";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const classId = searchParams.get("class_id");

  if (!classId) {
    return NextResponse.json({ error: "class_id is required" }, { status: 400 });
  }

  const supabase = getSupabase();
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

    const supabase = getSupabase();
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

export async function PATCH(request: NextRequest) {
  try {
    const payload = (await request.json()) as VotePatchPayload;
    const postId = payload.post_id;
    const likeDelta = Number(payload.like_delta);
    const dislikeDelta = Number(payload.dislike_delta);

    if (
      typeof postId !== "string" ||
      !Number.isInteger(likeDelta) ||
      !Number.isInteger(dislikeDelta) ||
      !isValidVoteTransition(likeDelta, dislikeDelta)
    ) {
      return NextResponse.json({ error: "不正な投票です" }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data: rpcData, error: rpcError } = await supabase.rpc("vote_post", {
      p_post_id: postId,
      p_like_delta: likeDelta,
      p_dislike_delta: dislikeDelta,
    });

    if (!rpcError) {
      const post = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      if (!post) {
        return NextResponse.json(
          { error: "対象の投稿が見つかりません" },
          { status: 404 }
        );
      }

      return NextResponse.json({ post });
    }

    const isMissingRpc =
      rpcError.code === "PGRST202" ||
      rpcError.code === "42883" ||
      rpcError.message.includes("Could not find the function");

    if (!isMissingRpc) {
      const setupMessage = missingVoteStorageMessage(rpcError.message);
      return NextResponse.json(
        { error: setupMessage ?? rpcError.message },
        { status: 500 }
      );
    }

    const { data: current, error: readError } = await supabase
      .from("posts")
      .select("like_count, dislike_count")
      .eq("id", postId)
      .eq("status", "approved")
      .eq("hidden", false)
      .single();

    if (readError) {
      const setupMessage = missingVoteStorageMessage(readError.message);
      return NextResponse.json(
        { error: setupMessage ?? readError.message },
        { status: 500 }
      );
    }

    const currentPost = current as VoteResult;
    const nextLikeCount = Math.max(0, (currentPost.like_count ?? 0) + likeDelta);
    const nextDislikeCount = Math.max(
      0,
      (currentPost.dislike_count ?? 0) + dislikeDelta
    );

    const { data, error } = await supabase
      .from("posts")
      .update({
        like_count: nextLikeCount,
        dislike_count: nextDislikeCount,
      })
      .eq("id", postId)
      .select("id, like_count, dislike_count")
      .single();

    if (error) {
      const setupMessage = missingVoteStorageMessage(error.message);
      return NextResponse.json(
        { error: setupMessage ?? error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ post: data });
  } catch {
    return NextResponse.json(
      { error: "予期しないエラーが発生しました" },
      { status: 500 }
    );
  }
}
