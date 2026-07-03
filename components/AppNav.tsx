import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import TeamSwitcher from "@/components/TeamSwitcher";
import FeedbackButton from "@/components/FeedbackButton";
import MobileNav from "@/components/MobileNav";

type TeamOption = {
  id: string;
  team_number: string;
  team_name: string | null;
};

export default async function AppNav() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let teamNumber = "Not Assigned";
  let isAdmin = false;
  let isMentor = false;
  let activeTeamId: string | null = null;
  let switcherTeams: TeamOption[] = [];

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("team_id, role")
      .eq("id", user.id)
      .single();

    isAdmin = (profile?.role ?? "").toLowerCase() === "admin";
    isMentor = (profile?.role ?? "").toLowerCase() === "mentor";
    activeTeamId = profile?.team_id ?? null;

    if (isAdmin) {
      // Admins can switch to any team in the system, not just ones
      // they're explicitly listed as a mentor for.
      const { data: teamRows } = await supabase
        .from("teams")
        .select("id, team_number, team_name")
        .order("team_number", { ascending: true });

      switcherTeams = (teamRows ?? []) as TeamOption[];
    } else if (isMentor) {
      const { data: mentorTeamRows } = await supabase
        .from("team_mentors")
        .select(
          `
          teams (
            id,
            team_number,
            team_name
          )
        `
        )
        .eq("mentor_id", user.id);

      switcherTeams = (mentorTeamRows ?? [])
        .map((row) => (Array.isArray(row.teams) ? row.teams[0] : row.teams))
        .filter((team): team is TeamOption => Boolean(team));
    }

    if (activeTeamId) {
      const { data: team } = await supabase
        .from("teams")
        .select("team_number")
        .eq("id", activeTeamId)
        .single();

      if (team?.team_number) {
        teamNumber = team.team_number;
      }
    } else if (isAdmin) {
      teamNumber = "All Teams";
    }
  }

  const displayName =
    user?.user_metadata?.full_name ?? user?.email ?? "Not signed in";

  const showTeamSwitcher = isAdmin
    ? switcherTeams.length > 0
    : switcherTeams.length > 1;

  return (
    <header className="border-b border-slate-300 bg-white shadow-sm">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 md:px-8">
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

          <nav className="hidden items-center gap-8 text-base font-medium md:flex">
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

          <div className="relative hidden items-center gap-5 text-right text-sm text-slate-600 md:flex">
            <FeedbackButton />

            <div>
          <div>
            <strong>User:</strong> {displayName}
          </div>

          {showTeamSwitcher ? (
            <div className="mt-1 flex items-center justify-end gap-2">
              <strong>Team:</strong>
              <TeamSwitcher
                teams={switcherTeams}
                activeTeamId={activeTeamId}
                allowAllTeams={isAdmin}
              />
            </div>
          ) : (
            <div>
              <strong>Team:</strong> {teamNumber}
            </div>
          )}
          </div>
        </div>

        <MobileNav
          isAdmin={isAdmin}
          displayName={displayName}
          teamNumber={teamNumber}
          switcherTeams={switcherTeams}
          activeTeamId={activeTeamId}
          showTeamSwitcher={showTeamSwitcher}
        />
      </div>
    </header>
  );
}