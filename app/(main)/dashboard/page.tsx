import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import DashboardCard from "@/components/DashboardCard";
import {
  Camera,
  NotebookPen,
  Users,
  GraduationCap,
} from "lucide-react";

type TeamInfo = {
  team_number: string | null;
  team_name: string | null;
} | null;

function teamLabel(team: TeamInfo | TeamInfo[] | null | undefined): string | null {
  const resolved = Array.isArray(team) ? team[0] : team;
  if (!resolved?.team_number) return null;
  return resolved.team_name
    ? `${resolved.team_number} - ${resolved.team_name}`
    : resolved.team_number;
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("team_id, role")
    .eq("id", user.id)
    .single();

  const activeTeamId = profile?.team_id ?? null;
  const isAdmin = (profile?.role ?? "").toLowerCase() === "admin";
  const viewingAllTeams = isAdmin && !activeTeamId;

  let imageCount = 0;
  let meetingCount = 0;
  let memberCount = 0;
  let learningProgress = "0/0";

  let recentMeetings: any[] = [];
  let recentImages: any[] = [];

  if (activeTeamId || viewingAllTeams) {
    let imageCountQuery = supabase
      .from("image_entries")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null);

    let meetingCountQuery = supabase
      .from("meeting_notes")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null);

    let memberCountQuery = supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });

    let recentMeetingsQuery = supabase
      .from("meeting_notes")
      .select(
        viewingAllTeams
          ? "id,title,meeting_date,teams(team_number,team_name)"
          : "id,title,meeting_date"
      )
      .is("deleted_at", null)
      .order("meeting_date", { ascending: false })
      .limit(5);

    let recentImagesQuery = supabase
      .from("image_entries")
      .select(
        viewingAllTeams
          ? "id,description,created_at,teams(team_number,team_name)"
          : "id,description,created_at"
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(5);

    if (!viewingAllTeams) {
      imageCountQuery = imageCountQuery.eq("team_id", activeTeamId);
      meetingCountQuery = meetingCountQuery.eq("team_id", activeTeamId);
      memberCountQuery = memberCountQuery.eq("team_id", activeTeamId);
      recentMeetingsQuery = recentMeetingsQuery.eq("team_id", activeTeamId);
      recentImagesQuery = recentImagesQuery.eq("team_id", activeTeamId);
    }

    const [
      { count: images },
      { count: meetings },
      { count: members },
      { data: meetingsData },
      { data: imagesData },
    ] = await Promise.all([
      imageCountQuery,
      meetingCountQuery,
      memberCountQuery,
      recentMeetingsQuery,
      recentImagesQuery,
    ]);

    imageCount = images ?? 0;
    meetingCount = meetings ?? 0;
    memberCount = members ?? 0;

    recentMeetings = meetingsData ?? [];
    recentImages = imagesData ?? [];

    const { data: learningModules } = await supabase
      .from("learning_modules")
      .select("id")
      .eq("published", true);

    if (learningModules) {
      const learningModuleIds = learningModules.map((module) => module.id);
      const { data: passedAttempts } = learningModuleIds.length
        ? await supabase
            .from("learning_quiz_attempts")
            .select("module_id")
            .eq("user_id", user.id)
            .eq("passed", true)
            .in("module_id", learningModuleIds)
        : { data: [] };

      const passedCount = new Set((passedAttempts ?? []).map((attempt) => attempt.module_id)).size;
      learningProgress = `${passedCount}/${learningModuleIds.length}`;
    }
  }

  return (
    <main className="min-h-dvh bg-[#F5F7FA] p-8">
      <div className="mx-auto max-w-7xl">

        <div className="mb-10">
          <h1 className="text-5xl font-bold text-[#1C1F23]">
            Dashboard
          </h1>

          <p className="mt-2 text-lg text-slate-500">
            Welcome back,{" "}
            {user.user_metadata?.full_name ?? user.email}
            {viewingAllTeams && (
              <span className="ml-2 text-slate-400">· Viewing All Teams</span>
            )}
          </p>
        </div>

        {/* Summary Cards */}

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">

          <DashboardCard
            title="Images"
            value={imageCount}
            icon={Camera}
            href="/images"
          />

          <DashboardCard
            title="Meeting Notes"
            value={meetingCount}
            icon={NotebookPen}
            href="/meeting-notes"
          />

          <DashboardCard
            title="Team Members"
            value={memberCount}
            icon={Users}
            href="/teams"
          />

          <DashboardCard
            title="Learning"
            value={learningProgress}
            icon={GraduationCap}
            href="/learning"
          />

        </div>

        {/* Quick Actions */}

        <div className="mt-10 rounded-2xl bg-white p-8 shadow">

          <h2 className="mb-6 text-2xl font-bold">
            Quick Actions
          </h2>

          <div className="flex flex-wrap gap-4">

            <Link
              href="/images/new"
              className="rounded-xl bg-[#8ED4FF] px-6 py-3 font-semibold text-[#1C1F23] transition hover:scale-105"
            >
              + Add Image
            </Link>

            <Link
              href="/meeting-notes/new"
              className="rounded-xl bg-[#8ED4FF] px-6 py-3 font-semibold text-[#1C1F23] transition hover:scale-105"
            >
              + Meeting Note
            </Link>

            <Link
              href="/teams"
              className="rounded-xl bg-[#8ED4FF] px-6 py-3 font-semibold text-[#1C1F23] transition hover:scale-105"
            >
              Team
            </Link>

          </div>

        </div>

        {/* Bottom Section */}

        <div className="mt-10 grid gap-6 lg:grid-cols-2">

          <div className="rounded-2xl bg-white p-6 shadow">

            <h2 className="mb-5 text-2xl font-bold">
              Recent Meeting Notes
            </h2>

            <div className="space-y-3">

              {recentMeetings.length === 0 ? (
                <p className="text-slate-500">
                  No meeting notes yet.
                </p>
              ) : (
                recentMeetings.map((note) => (
                  <Link
                    key={note.id}
                    href={`/meeting-notes/manage?id=${note.id}`}
                    className="block rounded-xl border p-4 transition hover:bg-slate-50"
                  >
                    <div className="font-semibold">
                      {note.title}
                    </div>

                    <div className="text-sm text-slate-500">
                      {note.meeting_date}
                      {viewingAllTeams && teamLabel(note.teams) && (
                        <span> · {teamLabel(note.teams)}</span>
                      )}
                    </div>
                  </Link>
                ))
              )}

            </div>

          </div>

          <div className="rounded-2xl bg-white p-6 shadow">

            <h2 className="mb-5 text-2xl font-bold">
              Recent Images
            </h2>

            <div className="space-y-3">

              {recentImages.length === 0 ? (
                <p className="text-slate-500">
                  No images uploaded yet.
                </p>
              ) : (
                recentImages.map((image) => (
                  <Link
                    key={image.id}
                    href={`/images#image-${image.id}`}
                    className="block rounded-xl border p-4 transition hover:bg-slate-50"
                  >
                    <div className="font-semibold">
                      {image.description || "No Description"}
                    </div>

                    <div className="text-sm text-slate-500">
                      {new Date(image.created_at).toLocaleDateString()}
                      {viewingAllTeams && teamLabel(image.teams) && (
                        <span> · {teamLabel(image.teams)}</span>
                      )}
                    </div>
                  </Link>
                ))
              )}

            </div>

          </div>

        </div>

      </div>
    </main>
  );
}