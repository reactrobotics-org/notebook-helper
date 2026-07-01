import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { createClient } from "@/utils/supabase/server";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  team_id: string | null;
};

type Team = {
  id: string;
  team_number: string;
  team_name: string | null;
};

export default async function TeamPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, team_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/dashboard");
  }

  let team: Team | null = null;
  let teammates: Profile[] = [];

  if (profile.team_id) {
    const [{ data: teamData }, { data: teammateData }] = await Promise.all([
      supabase
        .from("teams")
        .select("id, team_number, team_name")
        .eq("id", profile.team_id)
        .single(),

      supabase
        .from("profiles")
        .select("id, full_name, email, role, team_id")
        .eq("team_id", profile.team_id)
        .order("full_name", { ascending: true }),
    ]);

    team = teamData as Team | null;
    teammates = (teammateData ?? []) as Profile[];
  }

  return (
    <main className="min-h-screen bg-[#F5F7FA] p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-[#1C1F23]">My Team</h1>
          <p className="mt-2 text-lg text-slate-600">
            View your team assignment and teammates.
          </p>
        </div>

        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-2xl font-bold text-[#1C1F23]">
            Your Information
          </h2>

          <div className="grid gap-4 md:grid-cols-3">
            <InfoCard label="Name" value={profile.full_name || "No name"} />
            <InfoCard label="Email" value={profile.email || user.email || "No email"} />
            <InfoCard label="Role" value={profile.role || "student"} />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#8ED4FF] text-[#1C1F23]">
              <Users size={24} />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-[#1C1F23]">
                Team Assignment
              </h2>
              <p className="text-slate-600">
                This information can only be changed by an admin.
              </p>
            </div>
          </div>

          {!team ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <h3 className="text-xl font-bold text-[#1C1F23]">
                You are not assigned to a team yet.
              </h3>
              <p className="mt-2 text-slate-600">
                Ask a mentor or admin to assign you to a team.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6 rounded-2xl bg-[#E8F6FF] p-6">
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                  Current Team
                </p>

                <h3 className="mt-2 text-4xl font-bold text-[#1C1F23]">
                  {team.team_number}
                </h3>

                {team.team_name && (
                  <p className="mt-1 text-xl text-slate-700">
                    {team.team_name}
                  </p>
                )}
              </div>

              <h3 className="mb-4 text-xl font-bold text-[#1C1F23]">
                Teammates
              </h3>

              <div className="grid gap-4 md:grid-cols-2">
                {teammates.map((teammate) => (
                  <div
                    key={teammate.id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <p className="font-bold text-[#1C1F23]">
                      {teammate.full_name || "No name"}
                    </p>

                    <p className="text-sm text-slate-600">
                      {teammate.email || "No email"}
                    </p>

                    <p className="mt-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      {teammate.role || "student"}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 font-bold text-[#1C1F23]">{value}</p>
    </div>
  );
}