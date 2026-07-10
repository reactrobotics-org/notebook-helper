import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import ScratchpadCard from "@/components/ScratchPadCard";

const PAGE_SIZE = 10;

export default async function ScratchpadPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
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

  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("scratchpad_entries")
    .select(
      `
      id,
      title,
      content,
      created_at,
      profiles (
        full_name,
        email
      )
    `,
      { count: "exact" }
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (!viewingAllTeams) {
    query = query.eq("team_id", activeTeamId ?? "");
  }

  const { data: entries, error, count } = await query;

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Scratchpad</h1>
            <p className="mt-1 text-sm text-slate-600">
              Quick ideas and thoughts to reference later — not a full
              meeting note.
            </p>
          </div>

          <Link
            href="/scratchpad/new"
            className="rounded bg-[#8ED4FF] text-[#1C1F23] px-4 py-2 text-white hover:bg-[#74C7FA]"
          >
            Add Idea
          </Link>
        </div>

        {error && (
          <div className="rounded bg-red-100 p-4 text-red-700">
            Error loading scratchpad entries: {error.message}
          </div>
        )}

        {!activeTeamId && !isAdmin && (
          <div className="rounded bg-white p-8 text-center shadow">
            <p className="text-gray-600">
              Your account is not assigned to a team yet.
            </p>
          </div>
        )}

        {(activeTeamId || isAdmin) &&
          !error &&
          (!entries || entries.length === 0) && (
            <div className="rounded bg-white p-8 text-center shadow">
              <p className="text-gray-600">No ideas have been added yet.</p>
            </div>
          )}

        <div className="space-y-6">
          {entries?.map((entry) => {
            const submitterProfile = Array.isArray(entry.profiles)
              ? entry.profiles[0]
              : entry.profiles;

            const submittedBy =
              submitterProfile?.full_name ??
              submitterProfile?.email ??
              "Unknown user";

            return (
              <ScratchpadCard
                key={entry.id}
                entry={entry}
                submittedBy={submittedBy}
              />
            );
          })}
        </div>

        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-between">
            <Link
              href={`/scratchpad?page=${currentPage - 1}`}
              aria-disabled={currentPage <= 1}
              className={`rounded border px-4 py-2 text-sm font-semibold ${
                currentPage <= 1
                  ? "pointer-events-none opacity-40"
                  : "hover:bg-white"
              }`}
            >
              ← Newer
            </Link>

            <p className="text-sm text-slate-600">
              Page {currentPage} of {totalPages}
            </p>

            <Link
              href={`/scratchpad?page=${currentPage + 1}`}
              aria-disabled={currentPage >= totalPages}
              className={`rounded border px-4 py-2 text-sm font-semibold ${
                currentPage >= totalPages
                  ? "pointer-events-none opacity-40"
                  : "hover:bg-white"
              }`}
            >
              Older →
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}