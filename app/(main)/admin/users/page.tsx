import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  ClipboardCheck,
  GraduationCap,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { createClient } from "@/utils/supabase/server";

const PAGE_SIZE = 20;

type Role = "Student" | "Mentor" | "Admin";

type Team = {
  id: string;
  team_number: string;
  team_name: string | null;
};

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role | null;
  team_id: string | null;
  created_at: string | null;
  teams?:
  | {
      team_number: string | null;
      team_name: string | null;
    }
  | {
      team_number: string | null;
      team_name: string | null;
    }[]
  | null;
};

const roles: Role[] = ["Student", "Mentor", "Admin"];

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
    .select("id, role, email")
    .eq("id", user.id)
    .single();

  if ((profile?.role ?? "").toLowerCase() !== "admin") {
  redirect("/dashboard");
}

  return { supabase, user };
}

function formatTeam(profile: Profile) {
  const team = Array.isArray(profile.teams)
    ? profile.teams[0]
    : profile.teams;

  if (!team?.team_number) return "Not assigned";

  return `${team.team_number}${team.team_name ? ` - ${team.team_name}` : ""}`;
}

function formatDate(value: string | null) {
  if (!value) return "Unknown";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

async function updateUser(formData: FormData) {
  "use server";

  const { supabase, user } = await getCurrentAdmin();

  const userId = String(formData.get("user_id") ?? "");
  const role = String(formData.get("role") ?? "Student") as Role;
  const teamValue = String(formData.get("team_id") ?? "none");
  const teamId = teamValue === "none" ? null : teamValue;

  if (!userId || !roles.includes(role)) return;

  if (userId === user.id && role !== "Admin") return;

  await supabase
    .from("profiles")
    .update({
      role,
      team_id: teamId,
    })
    .eq("id", userId);

  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

async function removeUserFromTeam(formData: FormData) {
  "use server";

  const { supabase } = await getCurrentAdmin();
  const userId = String(formData.get("user_id") ?? "");

  if (!userId) return;

  await supabase.from("profiles").update({ team_id: null }).eq("id", userId);

  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

async function deleteUser(formData: FormData) {
  "use server";

  const { supabase, user } = await getCurrentAdmin();
  const userId = String(formData.get("user_id") ?? "");

  if (!userId) return;

  // Do not allow an admin to delete themselves
  if (userId === user.id) return;

  await supabase.from("profiles").delete().eq("id", userId);

  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string;
    role?: string;
    team?: string;
    page?: string;
  }>;
}) {
  const { supabase } = await getCurrentAdmin();
  const params = await searchParams;

  const search = String(params?.q ?? "").trim();
  const roleFilter = String(params?.role ?? "all");
  const teamFilter = String(params?.team ?? "all");
  const currentPage = Math.max(1, parseInt(params?.page ?? "1", 10) || 1);

  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let profilesQuery = supabase
    .from("profiles")
    .select(
      `
        id,
        email,
        full_name,
        role,
        team_id,
        created_at,
        teams (
          team_number,
          team_name
        )
      `,
      { count: "exact" }
    )
    .order("full_name", { ascending: true })
    .range(from, to);

  if (search) {
    profilesQuery = profilesQuery.or(
      `full_name.ilike.%${search}%,email.ilike.%${search}%`
    );
  }

  if (roleFilter !== "all") {
    profilesQuery = profilesQuery.eq("role", roleFilter);
  }

  if (teamFilter === "none") {
    profilesQuery = profilesQuery.is("team_id", null);
  } else if (teamFilter !== "all") {
    profilesQuery = profilesQuery.eq("team_id", teamFilter);
  }

  const [
    { data: profiles, count: filteredCount },
    { data: teams },
    { count: totalUsersCount },
    { count: studentCount },
    { count: mentorCount },
    { count: adminCount },
  ] = await Promise.all([
    profilesQuery,
    supabase
      .from("teams")
      .select("id, team_number, team_name")
      .order("team_number", { ascending: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .or("role.is.null,role.eq.Student"),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "Mentor"),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "Admin"),
  ]);

  const teamList = (teams ?? []) as Team[];
  const userList = (profiles ?? []) as unknown as Profile[];

  const totalUsers = totalUsersCount ?? 0;
  const matchingCount = filteredCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(matchingCount / PAGE_SIZE));

  function buildPageHref(page: number) {
    const qs = new URLSearchParams();
    if (search) qs.set("q", search);
    if (roleFilter !== "all") qs.set("role", roleFilter);
    if (teamFilter !== "all") qs.set("team", teamFilter);
    qs.set("page", String(page));
    return `/admin/users?${qs.toString()}`;
  }

  return (
    <main className="min-h-screen bg-[#F5F7FA] p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#1C1F23] px-4 py-2 text-sm font-semibold text-white">
              <ShieldCheck size={18} /> Admin Only
            </div>

            <h1 className="text-5xl font-bold text-[#1C1F23]">
              User Management
            </h1>
            <p className="mt-2 text-lg text-slate-600">
              Assign users to teams and promote users to Student, Mentor, or Admin.
            </p>
          </div>

          <Link
            href="/admin"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-[#1C1F23] shadow-sm hover:bg-slate-50"
          >
            <ArrowLeft size={18} /> Back to Admin
          </Link>
        </div>

        <div className="mb-8 grid gap-6 md:grid-cols-4">
          <StatCard icon={<Users size={22} />} label="Total Users" value={totalUsers} />
          <StatCard icon={<GraduationCap size={22} />} label="Students" value={studentCount ?? 0} />
          <StatCard icon={<ClipboardCheck size={22} />} label="Mentors" value={mentorCount ?? 0} />
          <StatCard icon={<ShieldCheck size={22} />} label="Admins" value={adminCount ?? 0} />
        </div>

        <section className="mb-8 rounded-2xl bg-white p-6 shadow">
          <form className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr_auto]">
            <div>
              <label className="mb-1 block font-semibold text-slate-700">
                Search Users
              </label>
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  name="q"
                  defaultValue={params?.q ?? ""}
                  placeholder="Search by name or email"
                  className="w-full rounded-lg border border-slate-300 p-3 pl-10"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block font-semibold text-slate-700">
                Role
              </label>
              <select
                name="role"
                defaultValue={roleFilter}
                className="w-full rounded-lg border border-slate-300 bg-white p-3"
              >
                <option value="all">All Roles</option>
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block font-semibold text-slate-700">
                Team
              </label>
              <select
                name="team"
                defaultValue={teamFilter}
                className="w-full rounded-lg border border-slate-300 bg-white p-3"
              >
                <option value="all">All Teams</option>
                <option value="none">No Team</option>
                {teamList.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.team_number}
                    {team.team_name ? ` - ${team.team_name}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="rounded-xl bg-[#1C1F23] px-5 py-3 font-semibold text-white hover:bg-black"
              >
                Filter
              </button>

              <Link
                href="/admin/users"
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-[#1C1F23] hover:bg-slate-50"
              >
                Reset
              </Link>
            </div>
          </form>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-1 text-2xl font-bold text-[#1C1F23]">Users</h2>
          <p className="mb-5 text-slate-600">
            Showing {userList.length} of {matchingCount} matching user
            {matchingCount === 1 ? "" : "s"} (page {currentPage} of{" "}
            {totalPages}).
          </p>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] border-collapse text-left">
              <thead>
                <tr className="border-b bg-slate-50 text-sm uppercase tracking-wide text-slate-500">
                  <th className="p-3">Name</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Current Team</th>
                  <th className="p-3">Joined</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Assign Team</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>

              <tbody>
                {userList.map((profile) => (
                  <tr key={profile.id} className="border-b align-top">
                    <td className="p-3 font-semibold text-[#1C1F23]">
                      {profile.full_name || "No name"}
                    </td>

                    <td className="p-3 text-slate-600">
                      {profile.email || "No email"}
                    </td>

                    <td className="p-3 text-slate-600">{formatTeam(profile)}</td>

                    <td className="p-3 text-slate-600">
                      {formatDate(profile.created_at)}
                    </td>

                    <td className="p-3" colSpan={3}>
                      <form action={updateUser} className="grid gap-3 lg:grid-cols-[160px_260px_auto]">
                        <input type="hidden" name="user_id" value={profile.id} />

                        <select
                          name="role"
                          defaultValue={profile.role ?? "Student"}
                          className="rounded-lg border border-slate-300 bg-white p-2"
                        >
                          {roles.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>

                        <select
                          name="team_id"
                          defaultValue={profile.team_id ?? "none"}
                          className="rounded-lg border border-slate-300 bg-white p-2"
                        >
                          <option value="none">No Team</option>
                          {teamList.map((team) => (
                            <option key={team.id} value={team.id}>
                              {team.team_number}
                              {team.team_name ? ` - ${team.team_name}` : ""}
                            </option>
                          ))}
                        </select>

                        <div className="flex gap-2">
                          <button
                            type="submit"
                            className="rounded-lg bg-[#1C1F23] px-4 py-2 font-semibold text-white hover:bg-black"
                          >
                            Save
                          </button>
                        </div>
                      </form>

                      {profile.team_id && (
                        <form action={removeUserFromTeam} className="mt-2">
                          <input type="hidden" name="user_id" value={profile.id} />
                          <button
                            type="submit"
                            className="text-sm font-semibold text-red-600 hover:underline"
                          >
                            Remove from team
                          </button>
                        </form>
                      )}
                      {profile.id !== undefined && (
                        <form action={deleteUser} className="mt-2">
                          <input type="hidden" name="user_id" value={profile.id} />
                          <button
                            type="submit"
                            className="text-sm font-semibold text-red-700 hover:underline"
                          >
                            Delete user
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <Link
                href={buildPageHref(currentPage - 1)}
                aria-disabled={currentPage <= 1}
                className={`rounded border px-4 py-2 text-sm font-semibold ${
                  currentPage <= 1
                    ? "pointer-events-none opacity-40"
                    : "hover:bg-slate-50"
                }`}
              >
                ← Previous
              </Link>

              <p className="text-sm text-slate-600">
                Page {currentPage} of {totalPages}
              </p>

              <Link
                href={buildPageHref(currentPage + 1)}
                aria-disabled={currentPage >= totalPages}
                className={`rounded border px-4 py-2 text-sm font-semibold ${
                  currentPage >= totalPages
                    ? "pointer-events-none opacity-40"
                    : "hover:bg-slate-50"
                }`}
              >
                Next →
              </Link>
            </div>
          )}
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