import { Camera, NotebookPen, Trophy } from "lucide-react";
import { createAdminClient } from "@/utils/supabase/admin";

const RECENT_WINDOW_DAYS = 10;
const TOP_N = 5;

type Team = {
  id: string;
  team_number: string;
  team_name: string | null;
};

type RankedTeam = {
  team: Team;
  count: number;
};

function rankTeams(
  rows: { team_id: string | null }[],
  teamsById: Map<string, Team>
): RankedTeam[] {
  const counts = new Map<string, number>();

  for (const row of rows) {
    if (!row.team_id) continue;
    counts.set(row.team_id, (counts.get(row.team_id) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([teamId, count]) => {
      const team = teamsById.get(teamId);
      return team ? { team, count } : null;
    })
    .filter((entry): entry is RankedTeam => entry !== null)
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_N);
}

export default async function ScoreboardPage() {
  // The scoreboard is intentionally public and shows every team's counts
  // to anyone with the URL — broader than the normal team-scoped RLS
  // policies allow, so this reads through the service-role client. It
  // only ever touches team_id/created_at, never note or image content.
  const admin = createAdminClient();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RECENT_WINDOW_DAYS);
  const cutoffIso = cutoff.toISOString();

  const [
    { data: teams },
    { data: allNotes },
    { data: recentNotes },
    { data: allImages },
    { data: recentImages },
  ] = await Promise.all([
    admin.from("teams").select("id, team_number, team_name"),
    admin.from("meeting_notes").select("team_id").is("deleted_at", null),
    admin
      .from("meeting_notes")
      .select("team_id")
      .is("deleted_at", null)
      .gte("created_at", cutoffIso),
    admin.from("image_entries").select("team_id").is("deleted_at", null),
    admin
      .from("image_entries")
      .select("team_id")
      .is("deleted_at", null)
      .gte("created_at", cutoffIso),
  ]);

  const teamsById = new Map<string, Team>(
    (teams ?? []).map((team) => [team.id, team as Team])
  );

  const notesAllTime = rankTeams(
    (allNotes ?? []) as { team_id: string | null }[],
    teamsById
  );
  const notesRecent = rankTeams(
    (recentNotes ?? []) as { team_id: string | null }[],
    teamsById
  );
  const imagesAllTime = rankTeams(
    (allImages ?? []) as { team_id: string | null }[],
    teamsById
  );
  const imagesRecent = rankTeams(
    (recentImages ?? []) as { team_id: string | null }[],
    teamsById
  );

  return (
    <main className="min-h-dvh bg-[#F5F7FA] p-8">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-10">
          <h1 className="text-7xl font-bold text-[#1C1F23]">Scoreboard</h1>
          <p className="mt-3 text-2xl text-slate-600">
            Top teams by meeting notes and images submitted.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <Leaderboard
            title={`Meeting Notes — Last ${RECENT_WINDOW_DAYS} Days`}
            icon={<NotebookPen size={20} />}
            entries={notesRecent}
          />
          <Leaderboard
            title="Meeting Notes — All-Time"
            icon={<NotebookPen size={20} />}
            entries={notesAllTime}
          />
          <Leaderboard
            title={`Images — Last ${RECENT_WINDOW_DAYS} Days`}
            icon={<Camera size={20} />}
            entries={imagesRecent}
          />
          <Leaderboard
            title="Images — All-Time"
            icon={<Camera size={20} />}
            entries={imagesAllTime}
          />
        </div>
      </div>
    </main>
  );
}

function Leaderboard({
  title,
  icon,
  entries,
}: {
  title: string;
  icon: React.ReactNode;
  entries: RankedTeam[];
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#8ED4FF] text-[#1C1F23]">
          {icon}
        </div>
        <h2 className="text-2xl font-bold text-[#1C1F23]">{title}</h2>
      </div> 

      {entries.length === 0 ? (
        <p className="text-sm text-slate-500">No submissions yet.</p>
      ) : (
        <ol className="space-y-2">
          {entries.map((entry, index) => (
            <li
              key={entry.team.id}
              className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3"
            >
              <div className="flex items-center gap-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-xl font-bold text-slate-700">
                  {index === 0 ? <Trophy size={22} /> : index + 1}
                </span>
                <div>
                  <p className="text-2xl font-semibold text-[#1C1F23]">
                    {entry.team.team_number}
                  </p>
                  {entry.team.team_name && (
                    <p className="text-base text-slate-500">
                      {entry.team.team_name}
                    </p>
                  )}
                </div>
              </div>
              <span className="text-3xl font-bold text-[#1C1F23]">
                {entry.count}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}