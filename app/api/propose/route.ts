import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
let anthropicClient: Anthropic | null = null;

const ALL_DAYS = [1, 2, 3, 4, 5];
const ALL_PERIODS = [1, 2, 3, 4, 5, 6];
const CLASS_FETCH_CHUNK_SIZE = 80;
const COURSES_PER_SLOT = 8;
const FALLBACK_PROPOSAL_COUNT = 3;
const ONLINE_DAY = 0;
const ONLINE_PERIOD = 0;

const DAY_LABELS: Record<number, string> = {
  1: "月", 2: "火", 3: "水", 4: "木", 5: "金",
};

const FACULTY_KEYWORDS: { keyword: string; faculty: string }[] = [
  { keyword: "政治経済", faculty: "政経" },
  { keyword: "政経", faculty: "政経" },
  { keyword: "法学", faculty: "法学" },
  { keyword: "教育", faculty: "教育" },
  { keyword: "商学", faculty: "商" },
  { keyword: "商", faculty: "商" },
  { keyword: "社会科学", faculty: "社学" },
  { keyword: "社学", faculty: "社学" },
  { keyword: "人間科学", faculty: "人科" },
  { keyword: "人科", faculty: "人科" },
  { keyword: "スポーツ科学", faculty: "スポーツ" },
  { keyword: "スポ科", faculty: "スポーツ" },
  { keyword: "スポーツ", faculty: "スポーツ" },
  { keyword: "国際教養", faculty: "国際教養" },
  { keyword: "国教", faculty: "国際教養" },
  { keyword: "文化構想", faculty: "文構" },
  { keyword: "文構", faculty: "文構" },
  { keyword: "文学", faculty: "文" },
  { keyword: "基幹", faculty: "基幹" },
  { keyword: "創造", faculty: "創造" },
  { keyword: "先進", faculty: "先進" },
  { keyword: "グローバルエデュケーションセンター", faculty: "GEC" },
  { keyword: "グローバル教育センター", faculty: "GEC" },
  { keyword: "グローバル", faculty: "GEC" },
  { keyword: "GEC", faculty: "GEC" },
  { keyword: "gec", faculty: "GEC" },
];

type Slot = { day: number; period: number };

type ClassSlotRow = {
  class_id: string;
  day_of_week: number;
  period: number;
};

type CourseCandidate = {
  id: string;
  name: string;
  teacher: string | null;
  faculty?: string | null;
  term?: string | null;
  credits: number | string | null;
  method_type?: string | null;
  class_format?: string | null;
  grading_method?: string | null;
  summary?: string | null;
  class_slots?: Pick<ClassSlotRow, "day_of_week" | "period">[] | null;
};

type SavedClassSummary = {
  id: string;
  name: string;
  credits: number | string | null;
};

type ProposedClass = {
  class_id: string;
  name: string;
  teacher: string;
  credits: number;
  day: number;
  period: number;
  grading: string;
};

type Proposal = {
  title: string;
  description: string;
  total_credits: number;
  classes: ProposedClass[];
};

type ProposeRequest = {
  userText?: string;
  savedClassIds?: string[];
  targetCredits?: number;
  faculties?: string[];
  term?: string;
};

type CoursePreferences = {
  excludeEnglishTitle: boolean;
};

function getAnthropic() {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.CLAUDE_API_KEY;
  if (!apiKey) return null;
  anthropicClient ??= new Anthropic({ apiKey });
  return anthropicClient;
}

function normalizeText(text: string) {
  return text.replace(/[０-９．]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0)
  );
}

function uniqueSlots(slots: Slot[]) {
  const seen = new Set<string>();
  return slots.filter((slot) => {
    const key = `${slot.day}-${slot.period}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function allPeriodsForDay(day: number) {
  return ALL_PERIODS.map((period) => ({ day, period }));
}

function extractDeterministicForbiddenSlots(userText: string): Slot[] {
  const text = normalizeText(userText);
  const slots: Slot[] = [];
  const dayPatterns: { day: number; pattern: RegExp }[] = [
    { day: 1, pattern: /月(?:曜|曜日)?/g },
    { day: 2, pattern: /火(?:曜|曜日)?/g },
    { day: 3, pattern: /水(?:曜|曜日)?/g },
    { day: 4, pattern: /木(?:曜|曜日)?/g },
    { day: 5, pattern: /金(?:曜|曜日)?/g },
  ];
  const fullDayWords =
    /(全休|空け|あけ|休み|終日|一日|ずっと|バイト|部活|サークル|無理|入れたくない|入れるな|避けたい)/;
  const negativeWords =
    /(入れたくない|入れるな|入れない|なし|無理|避けたい|空け|あけ|全休|バイト|部活|サークル)/;

  for (const { day, pattern } of dayPatterns) {
    for (const match of text.matchAll(pattern)) {
      const index = match.index ?? 0;
      const context = text.slice(Math.max(0, index - 8), index + 32);
      if (fullDayWords.test(context)) {
        slots.push(...allPeriodsForDay(day));
      }

      const periodMatches = [...context.matchAll(/([1-6])\s*限/g)];
      for (const periodMatch of periodMatches) {
        if (!negativeWords.test(context)) continue;
        slots.push({ day, period: Number(periodMatch[1]) });
      }
    }
  }

  for (const periodMatch of text.matchAll(/([1-6])\s*限/g)) {
    const index = periodMatch.index ?? 0;
    const context = text.slice(Math.max(0, index - 10), index + 24);
    if (!negativeWords.test(context)) continue;
    const period = Number(periodMatch[1]);
    for (const day of ALL_DAYS) slots.push({ day, period });
  }

  return uniqueSlots(slots);
}

function extractCoursePreferences(userText: string): CoursePreferences {
  const text = normalizeText(userText);
  return {
    excludeEnglishTitle:
      /科目名.{0,12}英語.{0,12}(選びたくない|避けたい|なし|除外)/.test(text) ||
      /英語.{0,12}科目.{0,12}(選びたくない|避けたい|なし|除外)/.test(text),
  };
}

function matchesCoursePreferences(
  course: CourseCandidate,
  preferences: CoursePreferences
) {
  if (preferences.excludeEnglishTitle && /[A-Za-z]/.test(course.name)) {
    return false;
  }

  return true;
}

// Step1: 制約を抽出
async function extractForbiddenSlots(
  userText: string
): Promise<Slot[]> {
  const deterministicSlots = extractDeterministicForbiddenSlots(userText);
  const anthropic = getAnthropic();
  if (!anthropic) return deterministicSlots;

  const prompt = `以下のテキストから、授業に出られない曜日・時限を全て抽出してください。

テキスト: "${userText}"

時限の時間帯（開始時刻〜終了時刻）:
1限: 8:50〜10:30
2限: 10:40〜12:20
3限: 13:10〜14:50
4限: 15:05〜16:45
5限: 17:00〜18:40
6限: 18:55〜20:35

判断ルール:
- 「月曜11時からバイト」→ 11時前に開始しても11時までに終わらない時限はNG。2限(10:40-12:20)は11時をまたぐのでNG。1限(8:50-10:30)はOK。
- 「火曜は18時まで部活」→ 18時前に終わらない時限はNG。5限(17:00-18:40)は18時を超えるのでNG。4限まではOK。
- 「水曜は終日無理」→ 水曜の1-6限全てNG。
- 「木曜の昼は無理」→ 3限(13:10-14:50)前後がNG。

JSONのみ返してください:
{"forbidden": [{"day": 1, "period": 2}, ...]}

day: 1=月, 2=火, 3=水, 4=木, 5=金
period: 1〜6の整数`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });
    const text =
      response.content[0].type === "text" ? response.content[0].text : "{}";
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    return uniqueSlots([...deterministicSlots, ...(parsed.forbidden ?? [])]);
  } catch {
    return deterministicSlots;
  }
}

// Step2&3: 使えるコマの授業を取得
async function getCoursesForAvailableSlots(
  availableSlots: Slot[],
  savedClassIds: string[],
  faculties: string[],
  term: string,
  preferences: CoursePreferences
): Promise<Map<string, CourseCandidate[]>> {
  const slotCourseMap = new Map<string, CourseCandidate[]>();
  if (availableSlots.length === 0) return slotCourseMap;

  const { data: slotData } = await supabase
    .from("class_slots")
    .select("class_id, day_of_week, period")
    .in("day_of_week", [...new Set(availableSlots.map((s) => s.day))])
    .in("period", [...new Set(availableSlots.map((s) => s.period))])
    .range(0, 4999);

  if (!slotData) return slotCourseMap;
  const slotRows = slotData as ClassSlotRow[];

  // 正確なマッチのみ
  const exactMatches = slotRows.filter((s) =>
    availableSlots.some(
      (as) => as.day === s.day_of_week && as.period === s.period
    )
  );

  const classIds = [
    ...new Set(exactMatches.map((s) => s.class_id)),
  ].filter((id) => !savedClassIds.includes(id));

  if (classIds.length === 0) return slotCourseMap;
  console.log(
    `slot rows: ${slotRows.length}, exact matches: ${exactMatches.length}, class ids: ${classIds.length}`
  );

  const classes: CourseCandidate[] = [];
  for (let i = 0; i < classIds.length; i += CLASS_FETCH_CHUNK_SIZE) {
    const chunk = classIds.slice(i, i + CLASS_FETCH_CHUNK_SIZE);
    let query = supabase
      .from("classes")
      .select(
        `id, name, teacher, faculty, term, credits,
         method_type, class_format, grading_method, summary,
         class_slots(day_of_week, period)`
      )
      .in("id", chunk);

    if (faculties.length > 0) query = query.in("faculty", faculties);
    if (term) query = query.eq("term", term);

    const { data, error } = await query;
    if (error) {
      console.error("classes fetch error:", error.message);
      continue;
    }

    classes.push(
      ...((data ?? []) as CourseCandidate[]).filter((course) =>
        matchesCoursePreferences(course, preferences)
      )
    );
  }

  if (classes.length === 0) return slotCourseMap;
  console.log(`fetched classes: ${classes.length}`);

  for (const slot of availableSlots) {
    const key = `${slot.day}-${slot.period}`;
    const forSlot = classes
      .filter((c) =>
        c.class_slots?.some(
          (s) => s.day_of_week === slot.day && s.period === slot.period
        )
      )
      .slice(0, COURSES_PER_SLOT);
    if (forSlot.length > 0) slotCourseMap.set(key, forSlot);
  }

  return slotCourseMap;
}

async function getOnDemandCourses(
  savedClassIds: string[],
  faculties: string[],
  term: string,
  preferences: CoursePreferences
) {
  let query = supabase
    .from("classes")
    .select(
      `id, name, teacher, faculty, term, credits,
       method_type, class_format, grading_method, summary,
       class_slots(day_of_week, period)`
    )
    .ilike("method_type", "%フルオンデマンド%")
    .limit(80);

  if (savedClassIds.length > 0) {
    query = query.not("id", "in", `(${savedClassIds.join(",")})`);
  }
  if (faculties.length > 0) query = query.in("faculty", faculties);
  if (term) query = query.eq("term", term);

  const { data, error } = await query;
  if (error) {
    console.error("on-demand classes fetch error:", error.message);
    return [];
  }

  return ((data ?? []) as CourseCandidate[]).filter((course) =>
    matchesCoursePreferences(course, preferences)
  );
}

// Step4: Claudeで3パターンの時間割を構築
async function buildProposals(
  userText: string,
  slotCourseMap: Map<string, CourseCandidate[]>,
  onDemandCourses: CourseCandidate[],
  savedClasses: SavedClassSummary[],
  targetCredits: number,
  onDemandCreditTarget: number | null
): Promise<Proposal[]> {
  const candidateById = new Map<string, CourseCandidate>();
  for (const courses of slotCourseMap.values()) {
    for (const course of courses) {
      candidateById.set(course.id, course);
    }
  }
  for (const course of onDemandCourses) {
    candidateById.set(course.id, course);
  }

  if (candidateById.size === 0) {
    return [];
  }
  const allowedSlotKeys = new Set(slotCourseMap.keys());

  const coursesBySlot: string[] = [];
  for (const [key, courses] of slotCourseMap.entries()) {
    const [day, period] = key.split("-").map(Number);
    const label = `${DAY_LABELS[day]}${period}限`;
    const list = courses
      .map(
        (c) =>
          `  ID:${c.id} 「${c.name}」${c.teacher ?? "未定"} ${c.credits ?? "?"}単位 評価:${c.grading_method ?? "不明"}`
      )
      .join("\n");
    coursesBySlot.push(`【${label}に取れる授業】\n${list}`);
  }
  if (onDemandCourses.length > 0) {
    coursesBySlot.push(
      "【曜日時限なし・フルオンデマンド授業】\n" +
        onDemandCourses
          .slice(0, 40)
          .map(
            (c) =>
              `  ID:${c.id} 「${c.name}」${c.teacher ?? "未定"} ${c.credits ?? "?"}単位 評価:${c.grading_method ?? "不明"}`
          )
          .join("\n")
    );
  }

  const savedInfo =
    savedClasses.length > 0
      ? `既に登録済みの授業（重複不可）:\n${savedClasses.map((c) => `- ${c.name}`).join("\n")}`
      : "既存の履修候補: なし";
  const onDemandRule =
    onDemandCreditTarget != null
      ? `フルオンデマンド授業は合計${onDemandCreditTarget}単位前後までにしてください。残りは曜日時限のある授業から選んでください。`
      : "フルオンデマンド授業は希望に合う場合だけ補助的に使い、曜日時限のある授業も必ず検討してください。";

  const prompt = `早稲田大学の履修アドバイザーとして、以下の条件で最適な時間割を3パターン提案してください。

ユーザーの希望・制約: "${userText}"
目標単位数: 約${targetCredits}単位
${savedInfo}

選択可能な授業（使えるコマ別）:
${coursesBySlot.join("\n\n")}

以下のJSON形式のみで返してください（説明文なし）:
{
  "proposals": [
    {
      "title": "提案1：楽単重視型",
      "description": "レポートや出席点が中心で単位が取りやすい構成",
      "total_credits": 20,
      "classes": [
        {
          "class_id": "授業ID（必ずリストから選ぶ）",
          "name": "授業名",
          "teacher": "教員名",
          "credits": 2,
          "day": 1,
          "period": 2,
          "grading": "評価方法"
        }
      ]
    },
    {
      "title": "提案2：バランス型",
      ...
    },
    {
      "title": "提案3：充実型",
      ...
    }
  ]
}

必須ルール:
- 同じ曜日・時限に複数の授業を入れない
- フルオンデマンド授業を選ぶ場合は day を 0、period を 0 にする
- ${onDemandRule}
- class_idは必ず提供されたリストのIDを使う
- 3パターンは互いに異なる組み合わせにする
- 目標単位数に近くなるよう選ぶ`;

  try {
    const anthropic = getAnthropic();
    if (!anthropic) {
      return buildFallbackProposals(
        slotCourseMap,
        onDemandCourses,
        targetCredits,
        onDemandCreditTarget
      );
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });
    const text =
      response.content[0].type === "text" ? response.content[0].text : "{}";
    const parsed = parseJsonObject(text);
    const sanitizedProposals = sanitizeProposals(
      parsed?.proposals ?? [],
      candidateById,
      onDemandCreditTarget,
      allowedSlotKeys
    );
    const proposals =
      onDemandCreditTarget != null &&
      slotCourseMap.size > 0 &&
      !wantsOnlyOnDemandCourses(userText)
        ? sanitizedProposals.filter((proposal) =>
            proposal.classes.some((klass) => !isOnlineSlot(klass))
          )
        : sanitizedProposals;
    return proposals.length > 0
      ? proposals
      : buildFallbackProposals(
          slotCourseMap,
          onDemandCourses,
          targetCredits,
          onDemandCreditTarget
        );
  } catch (e) {
    console.error("buildProposals error:", e);
    return buildFallbackProposals(
      slotCourseMap,
      onDemandCourses,
      targetCredits,
      onDemandCreditTarget
    );
  }
}

function parseJsonObject(text: string): { proposals?: Proposal[] } | null {
  const withoutFences = text.replace(/```json|```/g, "").trim();
  const start = withoutFences.indexOf("{");
  const end = withoutFences.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return JSON.parse(withoutFences.slice(start, end + 1)) as {
      proposals?: Proposal[];
    };
  } catch (error) {
    console.error("proposal JSON parse error:", error);
    return null;
  }
}

function buildFallbackProposals(
  slotCourseMap: Map<string, CourseCandidate[]>,
  onDemandCourses: CourseCandidate[],
  targetCredits: number,
  onDemandCreditTarget: number | null
): Proposal[] {
  const slotEntries = [...slotCourseMap.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  );
  const onlineLimit = onDemandCreditTarget ?? Math.min(targetCredits, 6);

  return Array.from({ length: FALLBACK_PROPOSAL_COUNT }, (_, proposalIndex) => {
    const usedSlots = new Set<string>();
    const usedClassIds = new Set<string>();
    const classes: ProposedClass[] = [];
    let totalCredits = 0;
    let onlineCredits = 0;

    for (let i = proposalIndex; i < onDemandCourses.length; i += FALLBACK_PROPOSAL_COUNT) {
      if (totalCredits >= targetCredits) break;

      const candidate = onDemandCourses[i];
      if (!candidate || usedClassIds.has(candidate.id)) continue;

      const credits = normalizeCredits(candidate.credits);
      if (onlineCredits + credits > onlineLimit) continue;
      classes.push({
        class_id: candidate.id,
        name: candidate.name,
        teacher: candidate.teacher ?? "未定",
        credits,
        day: ONLINE_DAY,
        period: ONLINE_PERIOD,
        grading: candidate.grading_method ?? "不明",
      });
      usedClassIds.add(candidate.id);
      onlineCredits += credits;
      totalCredits += credits;
    }

    for (const [slotKey, courses] of slotEntries) {
      if (usedSlots.has(slotKey) || totalCredits >= targetCredits) continue;

      const candidate = courses[proposalIndex % courses.length] ?? courses[0];
      if (!candidate || usedClassIds.has(candidate.id)) continue;

      const [day, period] = slotKey.split("-").map(Number);
      const credits = normalizeCredits(candidate.credits);
      classes.push({
        class_id: candidate.id,
        name: candidate.name,
        teacher: candidate.teacher ?? "未定",
        credits,
        day,
        period,
        grading: candidate.grading_method ?? "不明",
      });
      usedSlots.add(slotKey);
      usedClassIds.add(candidate.id);
      totalCredits += credits;
    }

    return {
      title: `提案${proposalIndex + 1}`,
      description: "条件に合う授業候補から自動で組み合わせました",
      total_credits: sumCredits(classes),
      classes,
    };
  }).filter((proposal) => proposal.classes.length > 0);
}

function extractFacultiesFromText(text: string) {
  const faculties = new Set<string>();
  for (const { keyword, faculty } of FACULTY_KEYWORDS) {
    if (text.includes(keyword)) faculties.add(faculty);
  }
  return [...faculties];
}

function wantsOnDemandCourses(text: string) {
  return text.includes("オンデマンド") || text.includes("フルオンデマンド");
}

function wantsOnlyOnDemandCourses(text: string) {
  return (
    /(?:フル)?オンデマンド.{0,12}(だけ|のみ)/.test(text) ||
    /(だけ|のみ).{0,12}(?:フル)?オンデマンド/.test(text)
  );
}

function extractOnDemandCreditTarget(text: string) {
  if (!wantsOnDemandCourses(text)) return null;

  const normalized = text.replace(/[０-９．]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0)
  );
  const patterns = [
    /(?:フル)?オンデマンド[^0-9]{0,30}(\d+(?:\.\d+)?)\s*単位/,
    /(\d+(?:\.\d+)?)\s*単位[^。、「」\n]{0,30}(?:フル)?オンデマンド/,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const value = Number.parseFloat(match[1]);
    if (Number.isFinite(value) && value > 0) return value;
  }

  return null;
}

function sanitizeProposals(
  proposals: Proposal[],
  candidateById: Map<string, CourseCandidate>,
  onDemandCreditTarget: number | null,
  allowedSlotKeys: Set<string>
) {
  return proposals
    .map((proposal) => {
      const usedSlots = new Set<string>();
      const usedClassIds = new Set<string>();
      let onlineCredits = 0;
      const classes = proposal.classes
        .map((proposed) => {
          const candidate = candidateById.get(proposed.class_id);
          if (!candidate) return null;
          if (usedClassIds.has(candidate.id)) return null;

          const slots = candidate.class_slots ?? [];
          const isOnDemand = isOnDemandCourse(candidate);
          if (isOnDemand) {
            const credits = normalizeCredits(candidate.credits);
            if (
              onDemandCreditTarget != null &&
              onlineCredits + credits > onDemandCreditTarget
            ) {
              return null;
            }
            usedClassIds.add(candidate.id);
            onlineCredits += credits;
            return {
              class_id: candidate.id,
              name: candidate.name,
              teacher: candidate.teacher ?? "未定",
              credits,
              day: ONLINE_DAY,
              period: ONLINE_PERIOD,
              grading: candidate.grading_method ?? "不明",
            };
          }

          const matchingSlot =
            slots.find(
              (slot) =>
                slot.day_of_week === proposed.day &&
                slot.period === proposed.period &&
                allowedSlotKeys.has(`${slot.day_of_week}-${slot.period}`)
            ) ??
            slots.find((slot) =>
              allowedSlotKeys.has(`${slot.day_of_week}-${slot.period}`)
            );

          if (!matchingSlot) return null;

          const slotKey = `${matchingSlot.day_of_week}-${matchingSlot.period}`;
          if (usedSlots.has(slotKey)) return null;
          usedSlots.add(slotKey);
          usedClassIds.add(candidate.id);
          const credits = normalizeCredits(candidate.credits);

          return {
            class_id: candidate.id,
            name: candidate.name,
            teacher: candidate.teacher ?? "未定",
            credits,
            day: matchingSlot.day_of_week,
            period: matchingSlot.period,
            grading: candidate.grading_method ?? "不明",
          };
        })
        .filter((klass): klass is ProposedClass => klass !== null);

      if (classes.length === 0) return null;

      return {
        title: proposal.title || "履修提案",
        description: proposal.description || "条件に合う授業を組み合わせました",
        total_credits: sumCredits(classes),
        classes,
      };
    })
    .filter((proposal): proposal is Proposal => proposal !== null)
    .slice(0, 3);
}

function isOnDemandCourse(course: CourseCandidate) {
  const method = course.method_type ?? course.class_format ?? "";
  return method.includes("フルオンデマンド");
}

function isOnlineSlot(klass: Pick<ProposedClass, "day" | "period">) {
  return klass.day === ONLINE_DAY && klass.period === ONLINE_PERIOD;
}

function normalizeCredits(value: number | string | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;

  const normalized = value
    .replace(/[０-９．]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0xfee0)
    )
    .replace(/[^\d.]/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sumCredits(classes: Pick<ProposedClass, "credits">[]) {
  return classes.reduce((sum, klass) => sum + normalizeCredits(klass.credits), 0);
}

export async function POST(request: NextRequest) {
  try {
    const {
      userText,
      savedClassIds = [],
      targetCredits = 20,
      faculties = [],
      term = "",
    } = (await request.json()) as ProposeRequest;

    if (!userText?.trim()) {
      return NextResponse.json({ error: "テキストが空です" }, { status: 400 });
    }

    // Step1: 制約抽出
    const forbiddenSlots = await extractForbiddenSlots(userText);
    console.log("制約:", forbiddenSlots);
    const preferences = extractCoursePreferences(userText);
    console.log("授業選択条件:", preferences);

    // Step2: 使えるコマを計算
    const availableSlots = ALL_DAYS.flatMap((day) =>
      ALL_PERIODS.filter(
        (period) =>
          !forbiddenSlots.some((fs) => fs.day === day && fs.period === period)
      ).map((period) => ({ day, period }))
    );
    console.log(`使えるコマ: ${availableSlots.length}個`);

    const requestedFaculties =
      faculties.length > 0 ? faculties : extractFacultiesFromText(userText);
    if (requestedFaculties.length > 0) {
      console.log("対象学部:", requestedFaculties);
    }
    const shouldIncludeOnDemand = wantsOnDemandCourses(userText);
    const onDemandCreditTarget = extractOnDemandCreditTarget(userText);
    if (shouldIncludeOnDemand) {
      console.log(
        "オンデマンド希望単位:",
        onDemandCreditTarget ?? "指定なし"
      );
    }

    // Step3: 授業を検索
    const slotCourseMap = await getCoursesForAvailableSlots(
      availableSlots,
      savedClassIds,
      requestedFaculties,
      term,
      preferences
    );
    console.log(`授業が入るコマ: ${slotCourseMap.size}個`);

    const onDemandCourses = shouldIncludeOnDemand
      ? await getOnDemandCourses(
          savedClassIds,
          requestedFaculties,
          term,
          preferences
        )
      : [];
    if (shouldIncludeOnDemand) {
      console.log(`オンデマンド候補: ${onDemandCourses.length}件`);
    }

    if (slotCourseMap.size === 0 && onDemandCourses.length === 0) {
      return NextResponse.json({
        proposals: [],
        forbidden_slots: forbiddenSlots,
        message:
          "条件に合う授業候補が見つかりませんでした。条件を少し広げてもう一度試してください。",
      });
    }

    // 既存の履修候補を取得
    let savedClasses: SavedClassSummary[] = [];
    if (savedClassIds.length > 0) {
      const { data } = await supabase
        .from("classes")
        .select("id, name, credits")
        .in("id", savedClassIds);
      savedClasses = (data ?? []) as SavedClassSummary[];
    }

    // Step4: 提案を構築
    const proposals = await buildProposals(
      userText,
      slotCourseMap,
      onDemandCourses,
      savedClasses,
      targetCredits,
      onDemandCreditTarget
    );

    if (proposals.length === 0) {
      return NextResponse.json({
        proposals: [],
        forbidden_slots: forbiddenSlots,
        message:
          "条件に合う授業候補から有効な時間割を作れませんでした。条件を少し変えてもう一度試してください。",
      });
    }

    return NextResponse.json({ proposals, forbidden_slots: forbiddenSlots });
  } catch (error) {
    console.error("Propose API error:", error);
    const message = error instanceof Error ? error.message : "エラーが発生しました";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
