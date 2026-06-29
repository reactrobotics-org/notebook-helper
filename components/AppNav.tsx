import Link from "next/link";
import { createClient } from "@/utils/supabase/server";

export default async function AppNav() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let teamNumber = "Not Assigned";

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("team_id")
      .eq("id", user.id)
      .single();

    if (profile?.team_id) {
      const { data: team } = await supabase
        .from("teams")
        .select("team_number")
        .eq("id", profile.team_id)
        .single();

      if (team) {
        teamNumber = team.team_number;
      }
    }
  }

  const displayName =
    user?.user_metadata?.full_name ?? user?.email ?? "Not signed in";

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="text-xl font-bold">
            Notebook Helper
          </Link>

          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="hover:underline">
              Dashboard
            </Link>

            <div className="group relative">
              <Link href="/images" className="hover:underline">
                Images ▾
              </Link>

              <div className="absolute left-0 z-50 hidden min-w-44 rounded border bg-white py-2 shadow-lg group-hover:block">
                <Link
                  href="/images"
                  className="block px-4 py-2 hover:bg-slate-100"
                >
                  View Images
                </Link>

                <Link
                  href="/images/new"
                  className="block px-4 py-2 hover:bg-slate-100"
                >
                  Add Image
                </Link>

                <Link
                  href="/images/manage"
                  className="block px-4 py-2 hover:bg-slate-100"
                >
                  Manage Images
                </Link>
              </div>
            </div>

            <Link href="/meeting-notes" className="hover:underline">
              Meeting Notes
            </Link>

            <Link href="/teams" className="hover:underline">
              Team
            </Link>
          </nav>
        </div>

        <div className="text-right text-sm text-gray-600">
          <div>
            You are: <strong>{displayName}</strong>
          </div>
          <div>
            Team Number: <strong>{teamNumber}</strong>
          </div>
        </div>
      </div>
    </header>
  );
}