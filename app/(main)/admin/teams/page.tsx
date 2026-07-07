import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardList,
  Plus,
  ShieldCheck,
  Trash2,
  UserX,
  Users,
} from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";

type Team = {
  id: string;
  team_number: string;
  team_name: string | null;
  created_at: string | null;
};

type Member = {
  id: string;
  full_name: string | null;
  email: string | null;
  team_id: string | null;
  role: string | null;
};

type MentorProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type TeamMentorRow = {
  team_id: string;
  mentor_id: string;
  profiles: MentorProfile | MentorProfile[] | null;
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
    .select("id, role")
    .eq("id", user.id)
    .single();

  if ((profile?.role ?? "").toLowerCase() !== "admin") {
    redirect("/dashboard");
  }

  return { supabase, user };
}

async function createTeam(formData: FormData) {
  "use server";

  const { supabase } = await getCurrentAdmin();

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

  const { supabase } = await getCurrentAdmin();

  const teamId = String(formData.get("team_id") ?? "");
  const teamNumber = String(formData.get("team_number") ?? "").trim();
  const teamName = String(formData.get("team_name") ?? "").trim();

  if (!teamId || !teamNumber) return;

  const { data } = await supabase
    .from("teams")
    .update({
      team_number: teamNumber,
      team_name: teamName || null,
    })
    .eq("id", teamId)
    .select();

  if (!data || data.length === 0) {
    redirect("/admin/teams?error=update_failed");
  }

  revalidatePath("/admin/teams");
  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

async function deleteTeam(formData: FormData) {
  "use server";

  const { supabase } = await getCurrentAdmin();

  const teamId = String(formData.get("team_id") ?? "");

  if (!teamId) return;

  // Unassign any members first so no profile is left pointing at a
  // team that no longer exists. Not every team has members, so a zero-row
  // result here isn't itself an error — only the team delete below is
  // checked.
  await supabase.from("profiles").update({ team_id: null }).eq("team_id", teamId);

  const { data } = await supabase.from("teams").delete().eq("id", teamId).select();

  if (!data || data.length === 0) {
    redirect("/admin/teams?error=delete_failed");
  }

  revalidatePath("/admin/teams");
  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

async function assignMentor(formData: FormData) {
  "use server";

  const { supabase } = await getCurrentAdmin();

  const teamId = String(formData.get("team_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");

  if (!teamId || !userId) return;

  // Only ever assign users who are actually Mentors or Admins,
  // regardless of what the form submitted.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, team_id")
    .eq("id", userId)
    .single();

  const role = (profile?.role ?? "").toLowerCase();

  if (role !== "mentor" && role !== "admin") return;

  const { data: insertedRows } = await supabase
    .from("team_mentors")
    .insert({
      team_id: teamId,
      mentor_id: userId,
    })
    .select();

  if (!insertedRows || insertedRows.length === 0) {
    redirect("/admin/teams?error=assign_failed");
  }

  // If this is the mentor's first team, make it their active team too,
  // so their dashboard/images/notes have something to show right away.
  if (!profile?.team_id) {
    const { data } = await supabase
      .from("profiles")
      .update({ team_id: teamId })
      .eq("id", userId)
      .select();

    if (!data || data.length === 0) {
      redirect("/admin/teams?error=assign_failed");
    }
  }

  revalidatePath("/admin/teams");
  revalidatePath("/admin/users");
}

async function unassignMentor(formData: FormData) {
  "use server";

  const { supabase } = await getCurrentAdmin();

  const teamId = String(formData.get("team_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");

  if (!teamId || !userId) return;

  const { data: deletedRows } = await supabase
    .from("team_mentors")
    .delete()
    .eq("team_id", teamId)
    .eq("mentor_id", userId)
    .select();

  if (!deletedRows || deletedRows.length === 0) {
    redirect("/admin/teams?error=unassign_failed");
  }

  // If that team was their active team, clear it so they're not left
  // pointing at a team they no longer mentor.
  const { data: profile } = await supabase
    .from("profiles")
    .select("team_id")
    .eq("id", userId)
    .single();

  if (profile?.team_id === teamId) {
    await supabase.from("profiles").update({ team_id: null }).eq("id", userId);
  }

  revalidatePath("/admin/teams");
  revalidatePath("/admin/users");
}

function formatDate(value: string | null) {
  if (!value) return "Unknown";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default async function AdminTeamsPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const { supabase } = await getCurrentAdmin();
  const params = await searchParams;

  const [{ data: teams }, { data: profiles }, { data: teamMentorRows }] =
    await Promise.all([
      supabase
        .from("teams")
        .select("id, team_number, team_name, created_at")
        .order("team_number", { ascending: true }),
      supabase
        .from("profiles")
        .select("id, full_name, email, team_id, role")
        .order("full_name", { ascending: true }),
      supabase
        .from("team_mentors")
        .select(
          `
          team_id,
          mentor_id,
          profiles (
            id,
            full_name,
            email
          )
        `
        ),
    ]);

  const teamList = (teams ?? []) as Team[];
  const memberList = (profiles ?? []) as Member[];
  const mentorList = memberList.filter((member) => {
    const role = (member.role ?? "").toLowerCase();
    return role === "mentor" || role === "admin";
  });

  const unassignedCount = memberList.filter((member) => !member.team_id).length;

  const mentorsByTeam = new Map<string, MentorProfile[]>();
  ((teamMentorRows ?? []) as TeamMentorRow[]).forEach((row) => {
    const mentorProfile = Array.isArray(row.profiles)
      ? row.profiles[0]
      : row.profiles;

    if (!mentorProfile) return;

    const existing = mentorsByTeam.get(row.team_id) ?? [];
    existing.push(mentorProfile);
    mentorsByTeam.set(row.team_id, existing);
  });

  return (
    <main className="min-h-screen bg-[#F5F7FA] p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#1C1F23] px-4 py-2 text-sm font-semibold text-white">
              <ShieldCheck size={18} /> Admin Only
            </div>

            <h1 className="text-5xl font-bold text-[#1C1F23]">
              Team Management
            </h1>
            <p className="mt-2 text-lg text-slate-600">
              Create teams and assign mentors. Student and general
              user assignment happens on the User Management page.
            </p>
          </div>

          <Link
            href="/admin"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-[#1C1F23] shadow-sm hover:bg-slate-50"
          >
            <ArrowLeft size={18} /> Back to Admin
          </Link>
        </div>

        {params?.error === "update_failed" && (
          <div className="mb-6 flex items-center gap-3 rounded-xl bg-amber-50 p-4 text-amber-900">
            <AlertTriangle size={20} className="shrink-0" />
            <p>
              Nothing was updated. This usually means a Supabase Row Level
              Security policy is blocking the update — check the UPDATE
              policy on teams covers Admins for rows they didn&apos;t
              create.
            </p>
          </div>
        )}

        {params?.error === "delete_failed" && (
          <div className="mb-6 flex items-center gap-3 rounded-xl bg-amber-50 p-4 text-amber-900">
            <AlertTriangle size={20} className="shrink-0" />
            <p>
              Nothing was deleted. This usually means a Supabase Row Level
              Security policy is blocking the delete — check that a DELETE
              policy exists on teams for Admins.
            </p>
          </div>
        )}

        {params?.error === "assign_failed" && (
          <div className="mb-6 flex items-center gap-3 rounded-xl bg-amber-50 p-4 text-amber-900">
            <AlertTriangle size={20} className="shrink-0" />
            <p>
              The mentor wasn&apos;t assigned. This usually means a Supabase
              Row Level Security policy is blocking the insert/update — check
              the policies on team_mentors and profiles cover Admins for
              rows they didn&apos;t create.
            </p>
          </div>
        )}

        {params?.error === "unassign_failed" && (
          <div className="mb-6 flex items-center gap-3 rounded-xl bg-amber-50 p-4 text-amber-900">
            <AlertTriangle size={20} className="shrink-0" />
            <p>
              The mentor wasn&apos;t removed. This usually means a Supabase
              Row Level Security policy is blocking the delete — check that
              a DELETE policy exists on team_mentors for Admins.
            </p>
          </div>
        )}

        <div className="mb-8 grid gap-6 md:grid-cols-3">
          <StatCard
            icon={<ClipboardList size={22} />}
            label="Total Teams"
            value={teamList.length}
          />
          <StatCard
            icon={<Users size={22} />}
            label="Assigned Users"
            value={memberList.length - unassignedCount}
          />
          <StatCard
            icon={<UserX size={22} />}
            label="Unassigned Users"
            value={unassignedCount}
          />
        </div>

        <section className="mb-8 rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-2xl font-bold text-[#1C1F23]">
            Add a Team
          </h2>

          <form
            action={createTeam}
            className="grid gap-4 lg:grid-cols-[1fr_2fr_auto]"
          >
            <div>
              <label className="mb-1 block font-semibold text-slate-700">
                Team Number
              </label>
              <input
                name="team_number"
                required
                placeholder="Example: 90210A"
                className="w-full rounded-lg border border-slate-300 p-3"
              />
            </div>

            <div>
              <label className="mb-1 block font-semibold text-slate-700">
                Team Name
              </label>
              <input
                name="team_name"
                placeholder="Optional"
                className="w-full rounded-lg border border-slate-300 p-3"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-[#1C1F23] px-5 py-3 font-semibold text-white hover:bg-black"
              >
                <Plus size={18} /> Add Team
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-1 text-2xl font-bold text-[#1C1F23]">Teams</h2>
          <p className="mb-5 text-slate-600">
            Showing {teamList.length} team{teamList.length === 1 ? "" : "s"}.
          </p>

          {teamList.length === 0 && (
            <p className="text-slate-500">No teams have been created yet.</p>
          )}

          <div className="space-y-6">
            {teamList.map((team) => {
              const mentors = mentorsByTeam.get(team.id) ?? [];
              const assignedMentorIds = new Set(mentors.map((m) => m.id));
              const availableMentors = mentorList.filter(
                (mentor) => !assignedMentorIds.has(mentor.id)
              );

              return (
                <div
                  key={team.id}
                  className="rounded-xl border border-slate-200 p-5"
                >
                  <div className="grid gap-4 lg:grid-cols-[1fr_2fr_auto_auto] lg:items-end">
                    <form
                      id={`team-form-${team.id}`}
                      action={updateTeam}
                      className="contents"
                    >
                      <input type="hidden" name="team_id" value={team.id} />

                      <div>
                        <label className="mb-1 block text-sm font-semibold text-slate-700">
                          Team Number
                        </label>
                        <input
                          name="team_number"
                          defaultValue={team.team_number}
                          required
                          className="w-full rounded-lg border border-slate-300 p-2"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-semibold text-slate-700">
                          Team Name
                        </label>
                        <input
                          name="team_name"
                          defaultValue={team.team_name ?? ""}
                          className="w-full rounded-lg border border-slate-300 p-2"
                        />
                      </div>

                      <button
                        type="submit"
                        className="rounded-lg bg-[#1C1F23] px-4 py-2 font-semibold text-white hover:bg-black"
                      >
                        Save
                      </button>
                    </form>

                    <form action={deleteTeam}>
                      <input type="hidden" name="team_id" value={team.id} />
                      <ConfirmSubmitButton
                        confirmMessage={`Permanently delete team ${team.team_number}${
                          team.team_name ? ` - ${team.team_name}` : ""
                        }? Members will be unassigned. This cannot be undone.`}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 font-semibold text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={16} /> Delete
                      </ConfirmSubmitButton>
                    </form>
                  </div>

                  <div className="mt-4 border-t pt-3 text-xs text-slate-500">
                    Created {formatDate(team.created_at)}
                  </div>

                  <div className="mt-4">
                    <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                      Mentors ({mentors.length})
                    </p>

                    {mentors.length === 0 ? (
                      <p className="mb-3 text-sm text-slate-500">
                        No mentors assigned to this team yet.
                      </p>
                    ) : (
                      <ul className="mb-3 space-y-2">
                        {mentors.map((mentor) => (
                          <li
                            key={mentor.id}
                            className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2"
                          >
                            <span className="text-sm text-slate-700">
                              {mentor.full_name || mentor.email || "Unnamed mentor"}
                            </span>

                            <form action={unassignMentor}>
                              <input
                                type="hidden"
                                name="team_id"
                                value={team.id}
                              />
                              <input
                                type="hidden"
                                name="user_id"
                                value={mentor.id}
                              />
                              <ConfirmSubmitButton
                                confirmMessage={`Remove ${
                                  mentor.full_name || mentor.email || "this mentor"
                                } from team ${team.team_number}?`}
                                className="text-sm font-semibold text-red-600 hover:underline"
                              >
                                Remove
                              </ConfirmSubmitButton>
                            </form>
                          </li>
                        ))}
                      </ul>
                    )}

                    {availableMentors.length > 0 && (
                      <form
                        action={assignMentor}
                        className="flex flex-wrap items-end gap-3"
                      >
                        <input type="hidden" name="team_id" value={team.id} />

                        <div>
                          <label className="mb-1 block text-sm font-semibold text-slate-700">
                            Assign a Mentor
                          </label>
                          <select
                            name="user_id"
                            defaultValue=""
                            required
                            className="rounded-lg border border-slate-300 bg-white p-2"
                          >
                            <option value="" disabled>
                              Choose a mentor
                            </option>
                            {availableMentors.map((mentor) => (
                              <option key={mentor.id} value={mentor.id}>
                                {mentor.full_name || mentor.email}
                              </option>
                            ))}
                          </select>
                        </div>

                        <button
                          type="submit"
                          className="rounded-lg bg-[#1C1F23] px-4 py-2 font-semibold text-white hover:bg-black"
                        >
                          Assign
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#E8F6FF] text-[#1C1F23]">
        {icon}
      </div>
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-4xl font-bold text-[#1C1F23]">{value}</p>
    </div>
  );
}