import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(new URL("/login?error=expired_link", request.url));
    }

    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // No code at all — not a valid callback hit, same outcome as a bad link.
  return NextResponse.redirect(new URL("/login?error=expired_link", request.url));
}
