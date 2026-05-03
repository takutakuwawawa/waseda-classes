import { supabase } from "./supabase";
import type { ClassWithSlots, SearchParams } from "./types";

const PAGE_SIZE = 20;

export async function searchClasses(params: SearchParams) {
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // 曜限フィルタが指定されている場合、先に class_slots から該当 class_id を取得
  let classIds: string[] | null = null;
  if (params.day || params.period) {
    let slotQuery = supabase.from("class_slots").select("class_id");
    if (params.day) {
      slotQuery = slotQuery.eq("day_of_week", parseInt(params.day, 10));
    }
    if (params.period) {
      slotQuery = slotQuery.eq("period", parseInt(params.period, 10));
    }
    const { data: slotData, error: slotErr } = await slotQuery;
    if (slotErr) throw slotErr;
    classIds = Array.from(new Set((slotData ?? []).map((r) => r.class_id)));
    // 何もヒットしないなら早期リターン
    if (classIds.length === 0) {
      return { rows: [] as ClassWithSlots[], total: 0, page, pageSize: PAGE_SIZE };
    }
  }

  // メインクエリ
  let query = supabase
    .from("classes")
    .select(
      `
      id, course_codes, name, teacher, faculty, term, campus,
      credits, class_format, language, syllabus_url, summary,
      classroom, year,
      class_slots ( term, day_of_week, period )
      `,
      { count: "exact" }
    );

  if (classIds) {
    query = query.in("id", classIds);
  }
  if (params.faculty) {
    query = query.eq("faculty", params.faculty);
  }
  if (params.term) {
    query = query.eq("term", params.term);
  }
  if (params.q && params.q.trim()) {
    const q = params.q.trim();
    // 科目名 OR 教員名 で部分一致
    query = query.or(`name.ilike.%${q}%,teacher.ilike.%${q}%`);
  }

  query = query.order("name", { ascending: true }).range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    rows: (data ?? []) as ClassWithSlots[],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  };
}

// 個別の授業を id で取得（詳細ページ用）
export async function getClassById(id: string): Promise<ClassWithSlots | null> {
  const { data, error } = await supabase
    .from("classes")
    .select(
      `
      *,
      class_slots ( term, day_of_week, period )
      `
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("getClassById error:", error);
    return null;
  }
  return (data as ClassWithSlots | null) ?? null;
}