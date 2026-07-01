import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";

export default async function AppNav() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let teamNumber = "Not Assigned";
  let isAdmin = false;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("team_id, role")
      .eq("id", user.id)
      .single();

    isAdmin = (profile?.role ?? "").toLowerCase() === "admin";

    if (profile?.team_id) {
      const { data: team } = await supabase
        .from("teams")
        .select("team_number")
        .eq("id", profile.team_id)
        .single();

      if (team?.team_number) {
        teamNumber = team.team_number;
      }
    }
  }

  const displayName =
    user?.user_metadata?.full_name ?? user?.email ?? "Not signed in";

  return (
    <header className="border-b border-slate-300 bg-white shadow-sm">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-8">
        <div className="flex items-center gap-10">
          <Link href="/dashboard">
            <Image
              src="/react-logo.png"
              alt="REACT"
              width={150}
              height={60}
              className="h-14 w-auto"
              priority
            />
          </Link>

          <nav className="flex items-center gap-8 text-base font-medium">
            <Link
              href="/dashboard"
              className="text-black transition hover:text-[#8ED4FF]"
            >
              Dashboard
            </Link>

            <Link
              href="/images"
              className="text-black transition hover:text-[#8ED4FF]"
            >
              Images
            </Link>

            <Link
              href="/meeting-notes"
              className="text-black transition hover:text-[#8ED4FF]"
            >
              Meeting Notes
            </Link>

            <Link
              href="/teams"
              className="text-black transition hover:text-[#8ED4FF]"
            >
              Team
            </Link>

            {isAdmin && (
              <Link
                href="/admin"
                className="rounded-lg bg-[#1C1F23] px-4 py-2 text-white transition hover:bg-black"
              >
                Admin
              </Link>
            )}
          </nav>
        </div>

        <div className="text-right text-sm text-slate-600">
          <div>
            <strong>User:</strong> {displayName}
          </div>

          <div>
            <strong>Team:</strong> {teamNumber}
          </div>
        </div>
      </div>
    </header>
  );
}