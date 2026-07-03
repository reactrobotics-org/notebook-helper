import { redirect } from "next/navigation";
import { Camera, NotebookPen, ShieldCheck } from "lucide-react";
import { createClient } from "@/utils/supabase/server";

type TeamInfo = {
  team_number: string | null;
  team_name: string | null;
} | null;

type ProfileInfo = {
  full_name: string | null;
  email: string | null;
} | null;

type ImageRow = {
  id: string;
  title: string | null;
  created_at: string;
  profiles: ProfileInfo | ProfileInfo[] | null;
  teams: TeamInfo | TeamInfo[] | null;
};

type NoteRow = {
  id: string;
  title: string | null;
  created_at: string;
  profiles: ProfileInfo | ProfileInfo[] | null;
  teams: TeamInfo | TeamInfo[] | null;
};

type ActivityEntry = {
  id: string;
  kind: "Image" | "Meeting Note";
  title: string;
  submittedBy: string;
  teamLabel: string;
  createdAt: string;
};

function one<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function formatTeamLabel(team: TeamInfo): string {
  if (!team?.team_number) return "No team";
  return team.team_name ? `${team.team_number} - ${team.team_name}` : team.team_number;
}

function formatSubmitter(profile: ProfileInfo): string {
  return profile?.full_name || profile?.email || "Unknown user";
}

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams?: Promise<{ type?: string }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if ((adminProfile?.role ?? "").toLowerCase() !== "admin") {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const typeFilter = params?.type ?? "all";

  const [{ data: images, error: imagesError }, { data: notes, error: notesError }] =
    await Promise.all([
      supabase
        .from("image_entries")
        .select(
          `
          id,
          title,
          created_at,
          profiles ( full_name, email ),
          teams ( team_number, team_name )
        `
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(25),
      supabase
        .from("meeting_notes")
        .select(
          `
          id,
          title,
          created_at,
          profiles ( full_name, email ),
          teams ( team_number, team_name )
        `
        )
        .order("created_at", { ascending: false })
        .limit(25),
    ]);

  const imageEntries: ActivityEntry[] = ((images ?? []) as ImageRow[]).map(
    (row) => ({
      id: `image-${row.id}`,
      kind: "Image",
      title: row.title || "Untitled image",
      submittedBy: formatSubmitter(one(row.profiles)),
      teamLabel: formatTeamLabel(one(row.teams)),
      createdAt: row.created_at,
    })
  );

  const noteEntries: ActivityEntry[] = ((notes ?? []) as NoteRow[]).map(
    (row) => ({
      id: `note-${row.id}`,
      kind: "Meeting Note",
      title: row.title || "Untitled meeting note",
      submittedBy: formatSubmitter(one(row.profiles)),
      teamLabel: formatTeamLabel(one(row.teams)),
      createdAt: row.created_at,
    })
  );

  const combined = [...imageEntries, ...noteEntries]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .filter((entry) => {
      if (typeFilter === "image") return entry.kind === "Image";
      if (typeFilter === "meeting_note") return entry.kind === "Meeting Note";
      return true;
    })
    .slice(0, 40);

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#1C1F23] px-4 py-2 text-sm font-semibold text-white">
            <ShieldCheck size={18} /> Admin Only
          </div>

          <h2 className="text-3xl font-bold text-[#1C1F23]">Activity</h2>
          <p className="mt-2 text-slate-600">
            The most recent images and meeting notes submitted across every
            team, newest first. Use this to confirm student entries are
            actually reaching the database.
          </p>
        </div>

        <form className="flex items-end gap-2">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Type
            </label>
            <select
              name="type"
              defaultValue={typeFilter}
              className="rounded-lg border border-slate-300 bg-white p-2"
            >
              <option value="all">All Entries</option>
              <option value="image">Images Only</option>
              <option value="meeting_note">Meeting Notes Only</option>
            </select>
          </div>

          <button
            type="submit"
            className="rounded-xl bg-[#1C1F23] px-5 py-2 font-semibold text-white hover:bg-black"
          >
            Filter
          </button>
        </form>
      </div>

      {(imagesError || notesError) && (
        <div className="mb-6 rounded-xl bg-red-100 p-4 text-red-700">
          Error loading activity:{" "}
          {imagesError?.message || notesError?.message}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="mb-5 text-slate-600">
          Showing {combined.length} most recent entr
          {combined.length === 1 ? "y" : "ies"}.
        </p>

        {combined.length === 0 ? (
          <p className="text-slate-500">No activity yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] border-collapse text-left">
              <thead>
                <tr className="border-b bg-slate-50 text-sm uppercase tracking-wide text-slate-500">
                  <th className="p-3">Type</th>
                  <th className="p-3">Title</th>
                  <th className="p-3">Team</th>
                  <th className="p-3">Submitted By</th>
                  <th className="p-3">Submitted At</th>
                </tr>
              </thead>

              <tbody>
                {combined.map((entry) => (
                  <tr key={entry.id} className="border-b">
                    <td className="p-3">
                      <span className="inline-flex items-center gap-2 rounded-full bg-[#E8F6FF] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#1C1F23]">
                        {entry.kind === "Image" ? (
                          <Camera size={14} />
                        ) : (
                          <NotebookPen size={14} />
                        )}
                        {entry.kind}
                      </span>
                    </td>

                    <td className="p-3 font-semibold text-[#1C1F23]">
                      {entry.title}
                    </td>

                    <td className="p-3 text-slate-600">{entry.teamLabel}</td>

                    <td className="p-3 text-slate-600">
                      {entry.submittedBy}
                    </td>

                    <td className="p-3 text-slate-600">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}