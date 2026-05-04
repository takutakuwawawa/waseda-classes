export const MINERVA_AUTH_DOMAIN = "minerva-users.example.com";

export type Profile = {
  id: string;
  display_id: string;
  faculty: string | null;
  school_year: number | null;
  created_at: string;
  updated_at: string;
};

export function normalizeDisplayId(displayId: string) {
  return displayId.trim().toLowerCase();
}

export function validateDisplayId(displayId: string) {
  if (!/^[a-z0-9_]{3,24}$/.test(displayId)) {
    return "IDは3〜24文字の半角英数字とアンダースコアで入力してください";
  }

  return null;
}

export function validatePassword(password: string) {
  if (password.length < 8) {
    return "パスワードは8文字以上で入力してください";
  }

  return null;
}

export function displayIdToEmail(displayId: string) {
  return `${normalizeDisplayId(displayId)}@${MINERVA_AUTH_DOMAIN}`;
}
