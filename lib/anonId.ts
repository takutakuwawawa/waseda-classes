const STORAGE_KEY = "waseda_classes_browser_seed";

// ブラウザIDを取得（なければ生成して保存）
function getBrowserSeed(): string {
  if (typeof window === "undefined") return "ssr";

  let seed = localStorage.getItem(STORAGE_KEY);
  if (!seed) {
    seed = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, seed);
  }
  return seed;
}

// 文字列をハッシュ化（簡易版）
async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ハッシュを3文字の英数字に変換
function hashToAnonId(hash: string): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "";
  // ハッシュの先頭3バイトをそれぞれ62文字に変換
  for (let i = 0; i < 3; i++) {
    const byte = parseInt(hash.substring(i * 2, i * 2 + 2), 16);
    id += chars[byte % chars.length];
  }
  return id;
}

// 今日の日付（YYYY-MM-DD形式）
function getToday(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// 匿名IDを生成（ブラウザ × 授業 × 日付の組み合わせで一意）
export async function generateAnonId(classId: string): Promise<string> {
  const seed = getBrowserSeed();
  const today = getToday();
  const combined = `${seed}|${classId}|${today}`;
  const hash = await hashString(combined);
  return hashToAnonId(hash);
}