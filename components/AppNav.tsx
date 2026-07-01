import Image from "next/image";
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
    <header className="border-b border-slate-300 bg-white shadow-sm">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-8">

        {/* Left Side */}

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

            <div className="group relative">

              <Link
                href="/images"
                className="text-black transition hover:text-[#8ED4FF]"
              >
                Images ▾
              </Link>

              <div className="absolute left-0 z-50 hidden w-52 rounded-xl border border-slate-200 bg-white py-2 shadow-xl group-hover:block">

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

          </nav>

        </div>

        {/* Right Side */}

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