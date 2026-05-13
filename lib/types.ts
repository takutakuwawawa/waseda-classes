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

export type ClassSlot = {
  id: number;
  class_id: string;
  term: string;
  day_of_week: number;
  period: number;
};

export type ClassWithSlots = ClassRow & {
  class_slots: Pick<ClassSlot, "term" | "day_of_week" | "period">[];
};

export type SearchParams = {
  q?: string;
  faculty?: string;
  term?: string;
  day?: string;
  period?: string;
  methodType?: string;
  sort?: string;
  page?: string;
};

export type SortKey =
  | "name"
  | "teacher"
  | "faculty"
  | "credits-desc"
  | "credits-asc";

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
  "GEC",
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

export const CLASS_MODALITIES = [
  { label: "対面", value: "【対面】" },
  {
    label: "対面ハイブリッド",
    value: "【対面】ハイブリッド（対面回数半数以上）",
  },
  {
    label: "オンラインハイブリッド",
    value: "【オンライン】ハイブリッド（対面回数半数未満）",
  },
  { label: "フルオンデマンド", value: "【オンライン】フルオンデマンド" },
  { label: "リアルタイム配信", value: "【オンライン】リアルタイム配信" },
] as const;

export const SORT_OPTIONS: { label: string; value: SortKey }[] = [
  { label: "科目名順", value: "name" },
  { label: "教員名順", value: "teacher" },
  { label: "学部順", value: "faculty" },
  { label: "単位数 多い順", value: "credits-desc" },
  { label: "単位数 少ない順", value: "credits-asc" },
];
