import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AlertTriangle, ArrowLeft, UserPlus } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

const USERNAME_DOMAIN = "students.local";
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{1,18}[a-z0-9]$/;

async function requireAdmin() {
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

async function createStudentAccount(formData: FormData) {
  "use server";

  await requireAdmin();

  const rawUsername = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const teamId = String(formData.get("team_id") ?? "");

  if (!USERNAME_PATTERN.test(rawUsername)) {
    redirect("/admin/users/new?error=invalid_username");
  }

  if (password.length < 6) {
    redirect("/admin/users/new?error=weak_password");
  }

  if (!teamId) {
    redirect("/admin/users/new?error=missing_team");
  }

  const email = `${rawUsername}@${USERNAME_DOMAIN}`;
  const admin = createAdminClient();

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName || rawUsername },
    });

  if (createError || !created?.user) {
    const message = (createError?.message ?? "").toLowerCase();

    if (
      message.includes("already been registered") ||
      message.includes("already exists")
    ) {
      redirect("/admin/users/new?error=username_taken");
    }

    console.error("Error creating student account:", createError);
    redirect("/admin/users/new?error=create_failed");
  }

  // A database trigger creates the matching profiles row automatically,
  // the same way it does for Google/magic-link sign-ins — it just doesn't
  // know the username, role, or team, so fill those in now.
  const { error: updateError } = await admin
    .from("profiles")
    .update({
      username: rawUsername,
      full_name: fullName || rawUsername,
      role: "Student",
      team_id: teamId,
    })
    .eq("id", created.user.id);

  if (updateError) {
    console.error("Error finishing student profile setup:", updateError);
    redirect("/admin/users/new?error=profile_failed");
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  redirect(`/admin/users?created=${encodeURIComponent(rawUsername)}`);
}

export default async function NewStudentAccountPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const supabase = await requireAdmin();
  const params = await searchParams;

  const { data: teams } = await supabase
    .from("teams")
    .select("id, team_number, team_name")
    .order("team_number", { ascending: true });

  return (
    <>
      <Link
        href="/admin/users"
        className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft size={16} /> Back to Users
      </Link>

      <div className="mb-8">
        <h2 className="text-3xl font-bold text-[#1C1F23]">
          Create Student Account
        </h2>
        <p className="mt-2 text-slate-600">
          For students who don&apos;t have an email address. They&apos;ll
          sign in with the username and password you set here instead of
          Google or a magic link.
        </p>
      </div>

      {params?.error === "invalid_username" && (
        <ErrorBanner>
          Usernames must be 3–20 characters: lowercase letters and numbers,
          with hyphens or underscores only in the middle.
        </ErrorBanner>
      )}
      {params?.error === "weak_password" && (
        <ErrorBanner>Password must be at least 6 characters.</ErrorBanner>
      )}
      {params?.error === "missing_team" && (
        <ErrorBanner>Choose a team for this student.</ErrorBanner>
      )}
      {params?.error === "username_taken" && (
        <ErrorBanner>
          That username is already taken — try another.
        </ErrorBanner>
      )}
      {params?.error === "create_failed" && (
        <ErrorBanner>
          Something went wrong creating the account. Check the server logs
          for details.
        </ErrorBanner>
      )}
      {params?.error === "profile_failed" && (
        <ErrorBanner>
          The account was created, but setting up their profile failed —
          check /admin/users, you may need to assign their role and team
          manually.
        </ErrorBanner>
      )}

      <form
        action={createStudentAccount}
        className="max-w-lg space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label className="mb-1 block font-semibold text-slate-700">
            Full Name
          </label>
          <input
            name="full_name"
            required
            placeholder="Example: Jamie Doe"
            className="w-full rounded-lg border border-slate-300 p-3"
          />
        </div>

        <div>
          <label className="mb-1 block font-semibold text-slate-700">
            Username
          </label>
          <input
            name="username"
            required
            placeholder="Example: jamied"
            pattern="[A-Za-z0-9][A-Za-z0-9_-]{1,18}[A-Za-z0-9]"
            title="3-20 characters: letters, numbers, hyphens, or underscores"
            className="w-full rounded-lg border border-slate-300 p-3"
          />
          <p className="mt-1 text-xs text-slate-500">
            They&apos;ll log in with just this username — no email needed.
          </p>
        </div>

        <div>
          <label className="mb-1 block font-semibold text-slate-700">
            Password
          </label>
          <input
            type="text"
            name="password"
            required
            minLength={6}
            placeholder="At least 6 characters"
            className="w-full rounded-lg border border-slate-300 p-3"
          />
          <p className="mt-1 text-xs text-slate-500">
            Shown as plain text so you can write it down accurately — it
            won&apos;t be shown again after you submit.
          </p>
        </div>

        <div>
          <label className="mb-1 block font-semibold text-slate-700">
            Team
          </label>
          <select
            name="team_id"
            required
            defaultValue=""
            className="w-full rounded-lg border border-slate-300 p-3"
          >
            <option value="" disabled>
              Select a team...
            </option>
            {(teams ?? []).map((team) => (
              <option key={team.id} value={team.id}>
                {team.team_number}
                {team.team_name ? ` - ${team.team_name}` : ""}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-lg bg-[#8ED4FF] px-4 py-3 font-semibold text-[#1C1F23] hover:bg-[#6CC7FF]"
        >
          <UserPlus size={18} /> Create Account
        </button>
      </form>
    </>
  );
}

function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-center gap-3 rounded-xl bg-amber-50 p-4 text-amber-900">
      <AlertTriangle size={20} className="shrink-0" />
      <p>{children}</p>
    </div>
  );
}