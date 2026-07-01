import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import DashboardCard from "@/components/DashboardCard";
import {
  Camera,
  NotebookPen,
  Users,
  CheckSquare,
} from "lucide-react";

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
    .select("team_id")
    .eq("id", user.id)
    .single();

  let imageCount = 0;
  let meetingCount = 0;
  let memberCount = 0;
  let actionCount = 0;

  let recentMeetings: any[] = [];
  let recentImages: any[] = [];

  if (profile?.team_id) {
    const [
      { count: images },
      { count: meetings },
      { count: members },
      { data: meetingsData },
      { data: imagesData },
    ] = await Promise.all([
      supabase
        .from("images")
        .select("*", { count: "exact", head: true })
        .eq("team_id", profile.team_id),

      supabase
        .from("meeting_notes")
        .select("*", { count: "exact", head: true })
        .eq("team_id", profile.team_id),

      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("team_id", profile.team_id),

      supabase
        .from("meeting_notes")
        .select("id,title,meeting_date")
        .eq("team_id", profile.team_id)
        .order("meeting_date", { ascending: false })
        .limit(5),

      supabase
        .from("images")
        .select("id,description,created_at")
        .eq("team_id", profile.team_id)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    imageCount = images ?? 0;
    meetingCount = meetings ?? 0;
    memberCount = members ?? 0;

    recentMeetings = meetingsData ?? [];
    recentImages = imagesData ?? [];

    // Placeholder until we build task tracking
    actionCount = 0;
  }

  return (
    <main className="min-h-screen bg-[#F5F7FA] p-8">
      <div className="mx-auto max-w-7xl">

        <div className="mb-10">
          <h1 className="text-5xl font-bold text-[#1C1F23]">
            Dashboard
          </h1>

          <p className="mt-2 text-lg text-slate-500">
            Welcome back,{" "}
            {user.user_metadata?.full_name ?? user.email}
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
            title="Action Items"
            value={actionCount}
            icon={CheckSquare}
            href="/meeting-notes"
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
                  <div
                    key={note.id}
                    className="rounded-xl border p-4 hover:bg-slate-50"
                  >
                    <div className="font-semibold">
                      {note.title}
                    </div>

                    <div className="text-sm text-slate-500">
                      {note.meeting_date}
                    </div>
                  </div>
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
                  <div
                    key={image.id}
                    className="rounded-xl border p-4 hover:bg-slate-50"
                  >
                    <div className="font-semibold">
                      {image.description || "No Description"}
                    </div>

                    <div className="text-sm text-slate-500">
                      {new Date(image.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}

            </div>

          </div>

        </div>

      </div>
    </main>
  );
}