// classes テーブルの行型
export type ClassRow = {
  id: string;
  course_codes: string[];
  name: string;
  teacher: string | null;
  faculty: string;
  faculty_slug: string | null;
  term: string | null;
  campus: string | null;
  credits: number | null;
  class_format: string | null;
  language: string | null;
  syllabus_url: string | null;
  summary: string | null;
  classroom: string | null;
  year: number | null;
  // シラバス詳細
  subtitle: string | null;
  goal: string | null;
  study_outside: string | null;
  schedule_plan: string | null;
  textbook: string | null;
  reference: string | null;
  grading_method: string | null;
  notes_url: string | null;
  course_code_full: string | null;
  major_field: string | null;
  middle_field: string | null;
  minor_field: string | null;
  level: string | null;
  subject_category: string | null;
  year_assignment: string | null;
  method_type: string | null;
};

// class_slots テーブルの行型
export type ClassSlot = {
  id: number;
  class_id: string;
  term: string;
  day_of_week: number; // 1=月, 2=火, ..., 7=日
  period: number;      // 1〜7
};

// classes に slots をネストさせた型（検索結果用）
export type ClassWithSlots = ClassRow & {
  class_slots: Pick<ClassSlot, "term" | "day_of_week" | "period">[];
};

// 検索パラメータ
export type SearchParams = {
  q?: string;
  faculty?: string;
  term?: string;
  day?: string;
  period?: string;
  page?: string;
};

// UI用の選択肢
export const FACULTIES = [
  "政経",
  "法学",
  "教育",
  "商",
  "社学",
  "人科",
  "スポーツ",
  "国際教養",
  "文構",
  "文",
  "人通",
  "基幹",
  "創造",
  "先進",
] as const;

export const TERMS = ["春学期", "秋学期", "通年"] as const;

export const DAYS = [
  { value: 1, label: "月" },
  { value: 2, label: "火" },
  { value: 3, label: "水" },
  { value: 4, label: "木" },
  { value: 5, label: "金" },
  { value: 6, label: "土" },
  { value: 7, label: "日" },
] as const;

export const PERIODS = [1, 2, 3, 4, 5, 6, 7] as const;