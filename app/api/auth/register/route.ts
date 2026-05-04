import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  displayIdToEmail,
  normalizeDisplayId,
  validateDisplayId,
  validatePassword,
} from "@/lib/auth";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const displayId = normalizeDisplayId(String(payload.display_id ?? ""));
    const password = String(payload.password ?? "");
    const faculty = payload.faculty ? String(payload.faculty) : null;
    const schoolYear = payload.school_year ? Number(payload.school_year) : null;

    const idError = validateDisplayId(displayId);
    if (idError) {
      return NextResponse.json({ error: idError }, { status: 400 });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    if (
      schoolYear != null &&
      (!Number.isInteger(schoolYear) || schoolYear < 1 || schoolYear > 6)
    ) {
      return NextResponse.json({ error: "学年が不正です" }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json(
        {
          error:
            "登録APIにSUPABASE_SERVICE_ROLE_KEYが設定されていません。Next.js/Vercelの環境変数に追加してください。",
        },
        { status: 500 }
      );
    }

    const email = displayIdToEmail(displayId);
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_id: displayId,
        faculty,
        school_year: schoolYear,
      },
    });

    if (error) {
      const message = error.message.toLowerCase().includes("already")
        ? "このIDはすでに使われています"
        : error.message;
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (data.user) {
      await supabaseAdmin.from("profiles").upsert({
        id: data.user.id,
        display_id: displayId,
        faculty,
        school_year: schoolYear,
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "予期しないエラーが発生しました" },
      { status: 500 }
    );
  }
}
