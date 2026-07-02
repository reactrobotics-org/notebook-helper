import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { createClient } from "@/utils/supabase/server";

type Team = {
  id: string;
  team_number: string;
  team_name: string | null;
  created_at: string | null;
};

type Profile = {
  id: string;
  team_id: string | null;
};

async function getCurrentAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if ((profile?.role ?? "").toLowerCase() !== "admin") {
    redirect("/dashboard");
  }

  return supabase;
}

async function createTeam(formData: FormData) {
  "use server";

  const supabase = await getCurrentAdmin();

  const teamNumber = String(formData.get("team_number") ?? "").trim();
  const teamName = String(formData.get("team_name") ?? "").trim();

  if (!teamNumber) return;

  await supabase.from("teams").insert({
    team_number: teamNumber,
    team_name: teamName || null,
  });

  revalidatePath("/admin/teams");
  revalidatePath("/admin");
}

async function updateTeam(formData: FormData) {
  "use server";

  const supabase = await getCurrentAdmin();

  const teamId = String(formData.get("team_id") ?? "");
  const teamNumber = String(formData.get("team_number") ?? "").trim();
  const teamName = String(formData.get("team_name") ?? "").trim();

  if (!teamId || !teamNumber) return;

  await supabase
    .from("teams")
    .update({
      team_number: teamNumber,
      team_name: teamName || null,
    })
    .eq("id", teamId);

  revalidatePath("/admin/teams");
  revalidatePath("/admin/users");
  revalidatePath("/teams");
  revalidatePath("/admin");
}

async function deleteTeam(formData: FormData) {
  "use server";

  const supabase = await getCurrentAdmin();

  const teamId = String(formData.get("team_id") ?? "");

  if (!teamId) return;

  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId);

  if ((count ?? 0) > 0) {
    return;
  }

  await supabase.from("teams").delete().eq("id", teamId);

  revalidatePath("/admin/teams");
  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

function formatDate(value: string | null) {
  if (!value) return "Unknown";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default async function AdminTeamsPage() {
  const supabase = await getCurrentAdmin();

  const [{ data: teams }, { data: profiles }] = await Promise.all([
    supabase
      .from("teams")
      .select("id, team_number, team_name, created_at")
      .order("team_number", { ascending: true }),

    supabase.from("profiles").select("id, team_id"),
  ]);

  const teamList = (teams ?? []) as Team[];
  const profileList = (profiles ?? []) as Profile[];

  function getMemberCount(teamId: string) {
    return profileList.filter((profile) => profile.team_id === teamId).length;
  }

  return (
    <>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-[#1C1F23]">
          Team Management
        </h2>
        <p className="mt-2 text-slate-600">
          Create, edit, and delete robotics teams.
        </p>
      </div>

      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#8ED4FF] text-[#1C1F23]">
            <Plus size={24} />
          </div>

          <div>
            <h3 className="text-2xl font-bold text-[#1C1F23]">
              Create New Team
            </h3>
            <p className="text-slate-600">
              Add a team number and optional team name.
            </p>
          </div>
        </div>

        <form
          action={createTeam}
          className="grid gap-4 md:grid-cols-[1fr_2fr_auto]"
        >
          <div>
            <label className="mb-1 block font-semibold text-slate-700">
              Team Number
            </label>
            <input
              name="team_number"
              required
              placeholder="3440A"
              className="w-full rounded-lg border border-slate-300 p-3"
            />
          </div>

          <div>
            <label className="mb-1 block font-semibold text-slate-700">
              Team Name
            </label>
            <input
              name="team_name"
              placeholder="Cheeseburgers"
              className="w-full rounded-lg border border-slate-300 p-3"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-xl bg-[#1C1F23] px-5 py-3 font-semibold text-white hover:bg-black"
            >
              Create Team
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-1 text-2xl font-bold text-[#1C1F23]">
          Existing Teams
        </h3>

        <p className="mb-5 text-slate-600">{teamList.length} total teams.</p>

        <div className="space-y-4">
          {teamList.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
              No teams have been created yet.
            </div>
          ) : (
            teamList.map((team) => {
              const memberCount = getMemberCount(team.id);
              const canDelete = memberCount === 0;

              return (
                <div
                  key={team.id}
                  className="rounded-2xl border border-slate-200 p-5"
                >
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h4 className="text-2xl font-bold text-[#1C1F23]">
                        {team.team_number}
                        {team.team_name ? ` - ${team.team_name}` : ""}
                      </h4>

                      <div className="mt-1 flex flex-wrap gap-3 text-sm text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Users size={16} />
                          {memberCount} member
                          {memberCount === 1 ? "" : "s"}
                        </span>

                        <span>Created {formatDate(team.created_at)}</span>
                      </div>
                    </div>

                    {!canDelete && (
                      <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-semibold text-yellow-800">
                        Cannot delete while users are assigned
                      </span>
                    )}
                  </div>

                  <form
                    action={updateTeam}
                    className="grid gap-4 md:grid-cols-[1fr_2fr_auto]"
                  >
                    <input type="hidden" name="team_id" value={team.id} />

                    <div>
                      <label className="mb-1 block font-semibold text-slate-700">
                        Team Number
                      </label>
                      <input
                        name="team_number"
                        defaultValue={team.team_number}
                        required
                        className="w-full rounded-lg border border-slate-300 p-3"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block font-semibold text-slate-700">
                        Team Name
                      </label>
                      <input
                        name="team_name"
                        defaultValue={team.team_name ?? ""}
                        className="w-full rounded-lg border border-slate-300 p-3"
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        type="submit"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1C1F23] px-5 py-3 font-semibold text-white hover:bg-black"
                      >
                        <Pencil size={18} />
                        Save
                      </button>
                    </div>
                  </form>

                  <form action={deleteTeam} className="mt-4">
                    <input type="hidden" name="team_id" value={team.id} />

                    <button
                      type="submit"
                      disabled={!canDelete}
                      className="inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-red-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
                    >
                      <Trash2 size={16} />
                      Delete Team
                    </button>
                  </form>
                </div>
              );
            })
          )}
        </div>
      </section>
    </>
  );
}