import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const DAY_LABELS: Record<number, string> = {
  1: "月", 2: "火", 3: "水", 4: "木", 5: "金", 6: "土", 7: "日",
};

type ClassSlotForAI = {
  term?: string | null;
  day_of_week: number;
  period: number;
};

type ClassForAI = {
  id: string;
  name: string;
  teacher: string | null;
  faculty: string | null;
  term: string | null;
  credits: number | null;
  campus?: string | null;
  class_format: string | null;
  method_type: string | null;
  grading_method?: string | null;
  goal?: string | null;
  summary?: string | null;
  class_slots?: ClassSlotForAI[] | null;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

// 自然言語から検索条件を抽出
function extractConditions(query: string): {
  days: number[];
  periods: number[];
  faculties: string[];
  keywords: string[];
} {
  const days: number[] = [];
  const periods: number[] = [];
  const faculties: string[] = [];
  const keywords: string[] = [];

  // 曜日
  const dayMap: Record<string, number> = {
    月: 1, 火: 2, 水: 3, 木: 4, 金: 5, 土: 6, 日: 7,
    月曜: 1, 火曜: 2, 水曜: 3, 木曜: 4, 金曜: 5, 土曜: 6, 日曜: 7,
  };
  for (const [label, val] of Object.entries(dayMap)) {
    if (query.includes(label)) {
      if (!days.includes(val)) days.push(val);
    }
  }

  // 時限（1限〜7限、1時限目 等）
  const periodMatches = query.match(/([1-7])\s*[限時]/g);
  if (periodMatches) {
    for (const m of periodMatches) {
      const p = parseInt(m);
      if (!periods.includes(p)) periods.push(p);
    }
  }

  // 学部
  const facultyMap: Record<string, string> = {
    政経: "政経",
    政治経済: "政経",
    法: "法学",
    法学: "法学",
    教育: "教育",
    商: "商",
    商学: "商",
    社学: "社学",
    社会科学: "社学",
    人科: "人科",
    人間科学: "人科",
    スポーツ: "スポーツ",
    スポ科: "スポーツ",
    国教: "国際教養",
    国際教養: "国際教養",
    文構: "文構",
    文化構想: "文構",
    文学: "文",
    基幹: "基幹",
    創造: "創造",
    先進: "先進",
  };
  for (const [label, slug] of Object.entries(facultyMap)) {
    if (query.includes(label)) {
      if (!faculties.includes(slug)) faculties.push(slug);
    }
  }

  // キーワード（楽単・レポート等の特徴的なワード）
  const keywordPatterns = [
    "楽単", "楽", "レポート", "テストなし", "出席", "グループワーク",
    "英語", "オンライン", "対面", "少人数", "大人数",
  ];
  for (const kw of keywordPatterns) {
    if (query.includes(kw)) keywords.push(kw);
  }

  return { days, periods, faculties, keywords };
}

// 条件に基づいて授業を検索
async function searchByConditions(
  conditions: ReturnType<typeof extractConditions>,
  generalQuery: string
) {
  const results: ClassForAI[] = [];

  // 曜限指定がある場合
  if (conditions.days.length > 0 || conditions.periods.length > 0) {
    let slotQuery = supabase
      .from("class_slots")
      .select("class_id");

    if (conditions.days.length > 0) {
      slotQuery = slotQuery.in("day_of_week", conditions.days);
    }
    if (conditions.periods.length > 0) {
      slotQuery = slotQuery.in("period", conditions.periods);
    }

    const { data: slots } = await slotQuery.limit(100);
    const slotRows = (slots ?? []) as { class_id: string }[];
    const classIds = [...new Set(slotRows.map((s) => s.class_id))];

    if (classIds.length > 0) {
      let classQuery = supabase
        .from("classes")
        .select(`
          id, name, teacher, faculty, term, credits, campus,
          class_format, method_type, grading_method, goal, summary,
          class_slots ( term, day_of_week, period )
        `)
        .in("id", classIds);

      if (conditions.faculties.length > 0) {
        classQuery = classQuery.in("faculty", conditions.faculties);
      }

      const { data } = await classQuery.limit(15);
      results.push(...((data ?? []) as ClassForAI[]));
    }
  }

  // 学部指定のみの場合
  if (conditions.days.length === 0 && conditions.periods.length === 0 && conditions.faculties.length > 0) {
    const { data } = await supabase
      .from("classes")
      .select(`
        id, name, teacher, faculty, term, credits, campus,
        class_format, method_type, grading_method, goal, summary,
        class_slots ( term, day_of_week, period )
      `)
      .in("faculty", conditions.faculties)
      .limit(15);
    results.push(...((data ?? []) as ClassForAI[]));
  }

  // 条件に関わらずキーワード検索も追加
  if (generalQuery.trim().length >= 2) {
    const { data } = await supabase
      .from("classes")
      .select(`
        id, name, teacher, faculty, term, credits, campus,
        class_format, method_type, grading_method, goal, summary,
        class_slots ( term, day_of_week, period )
      `)
      .or(
        `name.ilike.%${generalQuery}%,teacher.ilike.%${generalQuery}%,summary.ilike.%${generalQuery}%`
      )
      .limit(10);
    results.push(...((data ?? []) as ClassForAI[]));
  }

  // 重複除去
  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}

// 履修候補の取得
async function getSavedClasses(savedClassIds: string[]) {
  if (savedClassIds.length === 0) return [];
  const { data } = await supabase
    .from("classes")
    .select(`
      id, name, teacher, faculty, term, credits, campus,
      class_format, method_type, grading_method, goal,
      class_slots ( term, day_of_week, period )
    `)
    .in("id", savedClassIds);
  return (data ?? []) as ClassForAI[];
}

function formatClassForAI(c: ClassForAI): string {
  const slots = (c.class_slots ?? [])
    .map((s) => `${DAY_LABELS[s.day_of_week] ?? "?"}${s.period}限`)
    .join("・");

  return [
    `【${c.name}】`,
    `教員: ${c.teacher ?? "未定"}`,
    `学部: ${c.faculty}`,
    `学期: ${c.term ?? "不明"}`,
    `曜限: ${slots || "不明"}`,
    `単位: ${c.credits ?? "?"}単位`,
    `形式: ${c.method_type ?? c.class_format ?? "不明"}`,
    `評価: ${c.grading_method ?? "不明"}`,
    c.goal ? `目標: ${c.goal.slice(0, 80)}` : null,
    c.summary ? `概要: ${c.summary.slice(0, 80)}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      message,
      history = [],
      savedClassIds = [],
    }: {
      message: string;
      history: ChatMessage[];
      savedClassIds: string[];
    } = body;

    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { error: "メッセージが空です" },
        { status: 400 }
      );
    }

    // 条件抽出 + 検索
    const conditions = extractConditions(message);
    const [searchResults, savedClasses] = await Promise.all([
      searchByConditions(conditions, message),
      getSavedClasses(savedClassIds),
    ]);

    // 抽出した条件をログ（デバッグ用）
    console.log("抽出条件:", conditions);
    console.log("検索結果:", searchResults.length, "件");

    // コンテキスト組み立て
    const savedContext =
      savedClasses.length > 0
        ? `【現在の履修候補（${savedClasses.length}件）】\n` +
          savedClasses.map(formatClassForAI).join("\n\n")
        : "【現在の履修候補】なし";

    const searchContext =
      searchResults.length > 0
        ? `【検索でヒットした授業（${searchResults.length}件）】\n` +
          searchResults.map(formatClassForAI).join("\n\n")
        : "【検索結果】条件に一致する授業が見つかりませんでした";

    // 抽出条件の説明
    const conditionSummary = [
      conditions.days.length > 0
        ? `曜日: ${conditions.days.map((d) => DAY_LABELS[d]).join("・")}`
        : null,
      conditions.periods.length > 0
        ? `時限: ${conditions.periods.join("・")}限`
        : null,
      conditions.faculties.length > 0
        ? `学部: ${conditions.faculties.join("・")}`
        : null,
    ]
      .filter(Boolean)
      .join("、");

    const systemPrompt = `あなたは早稲田大学の履修相談AIアシスタントです。
学生が履修計画を立てるのを手伝ってください。

以下の情報を参考にして回答してください：

${savedContext}

${searchContext}

${conditionSummary ? `【今回の検索条件】${conditionSummary}` : ""}

回答のルール：
- 日本語で親切・簡潔に回答してください
- 授業名は【】で囲んで表示してください
- 曜限・単位数・評価方法など、判断に必要な情報を具体的に伝えてください
- 時間割の重複や単位数の過不足などに気づいたら指摘してください
- 授業データにない情報は「不明」と答えてください（推測しない）
- 回答は400文字以内に収めてください`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        ...history.map((h) => ({
          role: h.role,
          content: h.content,
        })),
        { role: "user", content: message },
      ],
    });

    const reply =
      response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Chat API error:", error);
    const message = error instanceof Error ? error.message : "エラーが発生しました";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
