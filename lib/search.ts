import { supabase } from "./supabase";
import type { ClassWithSlots, SearchParams, SortKey } from "./types";

const PAGE_SIZE = 20;

const SORT_KEYS = new Set<SortKey>([
  "name",
  "teacher",
  "faculty",
  "credits-desc",
  "credits-asc",
]);

function normalizeSort(sort: string | undefined): SortKey {
  return SORT_KEYS.has(sort as SortKey) ? (sort as SortKey) : "name";
}

export async function searchClasses(params: SearchParams) {
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const sort = normalizeSort(params.sort);

  const hasSlotFilter = Boolean(params.day || params.period);
  const slotsSelect = hasSlotFilter
    ? "class_slots!inner ( term, day_of_week, period )"
    : "class_slots ( term, day_of_week, period )";

  let query = supabase
    .from("classes")
    .select(
      `
      id, course_codes, name, teacher, faculty, term, campus,
      credits, class_format, method_type, language, syllabus_url, summary,
      classroom, year,
      ${slotsSelect}
      `,
      { count: "exact" }
    );

  if (params.day) {
    query = query.eq("class_slots.day_of_week", parseInt(params.day, 10));
  }
  if (params.period) {
    query = query.eq("class_slots.period", parseInt(params.period, 10));
  }
  if (params.faculty) {
    query = query.eq("faculty", params.faculty);
  }
  if (params.term) {
    query = query.eq("term", params.term);
  }
  if (params.methodType) {
    query = query.eq("method_type", params.methodType);
  }
  if (params.q && params.q.trim()) {
    const q = params.q.trim();
    query = query.or(`name.ilike.%${q}%,teacher.ilike.%${q}%`);
  }

  switch (sort) {
    case "teacher":
      query = query
        .order("teacher", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true });
      break;
    case "faculty":
      query = query
        .order("faculty", { ascending: true })
        .order("name", { ascending: true });
      break;
    case "credits-desc":
      query = query
        .order("credits", { ascending: false, nullsFirst: false })
        .order("name", { ascending: true });
      break;
    case "credits-asc":
      query = query
        .order("credits", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true });
      break;
    case "name":
    default:
      query = query.order("name", { ascending: true });
      break;
  }

  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    rows: (data ?? []) as ClassWithSlots[],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  };
}

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
