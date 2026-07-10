import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Pencil } from "lucide-react";
import { createClient } from "@/utils/supabase/server";

export default async function ImagesPage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    subsystem?: string;
    sort?: string;
  }>;
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

  const selectedCategory = params.category ?? "All";
  const selectedSubsystem = params.subsystem ?? "All";
  const selectedSort = params.sort ?? "newest";

  let query = supabase
    .from("image_entries")
    .select(`
      id,
      title,
      description,
      image_url,
      category,
      subsystem,
      created_at,
      created_by,
      profiles (
        full_name,
        email
      )
    `)
    .is("deleted_at", null);

  if (!viewingAllTeams) {
    query = query.eq("team_id", activeTeamId ?? "");
  }

  if (selectedCategory !== "All") {
    query = query.eq("category", selectedCategory);
  }

  if (selectedSubsystem !== "All") {
    query = query.eq("subsystem", selectedSubsystem);
  }

  query = query.order("created_at", {
    ascending: selectedSort === "oldest",
  });

  const { data: images, error } = await query;

  const categories = [
    "All",
    "Brainstorm",
    "Design",
    "Prototype",
    "Build",
    "Programming",
    "Testing",
    "Other",
  ];

  const subsystems = [
    "All",
    "Drivetrain",
    "Intake",
    "Conveyor",
    "Lift",
    "Claw",
    "Electrical",
    "Pneumatics",
    "Sensors",
    "Other",
  ];

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Images</h1>
            <p className="mt-1 text-sm text-slate-600">
              Upload photos to document your robot&apos;s progress — tag
              them by category and subsystem so your team can find them
              again later.
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/images/manage"
              className="rounded border bg-white px-4 py-2 hover:bg-slate-50"
            >
              Manage My Images
            </Link>

            <Link
              href="/images/new"
              className="rounded bg-[#8ED4FF] text-[#1C1F23] px-4 py-2 text-white hover:bg-[#74C7FA]"
            >
              Add Image
            </Link>
          </div>
        </div>

        <form className="mb-6 grid gap-4 rounded bg-white p-4 shadow md:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Category</label>
            <select
              name="category"
              defaultValue={selectedCategory}
              className="w-full rounded border p-2"
            >
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Subsystem</label>
            <select
              name="subsystem"
              defaultValue={selectedSubsystem}
              className="w-full rounded border p-2"
            >
              {subsystems.map((subsystem) => (
                <option key={subsystem}>{subsystem}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Sort</label>
            <select
              name="sort"
              defaultValue={selectedSort}
              className="w-full rounded border p-2"
            >
              <option value="newest">Newest to Oldest</option>
              <option value="oldest">Oldest to Newest</option>
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="rounded bg-slate-900 px-4 py-2 text-white hover:bg-slate-700"
            >
              Apply
            </button>

            <Link
              href="/images"
              className="rounded border px-4 py-2 hover:bg-slate-100"
            >
              Reset
            </Link>
          </div>
        </form>

        {error && (
          <div className="rounded bg-red-100 p-4 text-red-700">
            Error loading images: {error.message}
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
          (!images || images.length === 0) && (
            <div className="rounded bg-white p-8 text-center shadow">
              <p className="text-gray-600">No images match those filters.</p>
            </div>
          )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {images?.map((entry) => {
            const profile = Array.isArray(entry.profiles)
              ? entry.profiles[0]
              : entry.profiles;

            const submittedBy =
              profile?.full_name ?? profile?.email ?? "Unknown user";

            const isOwnImage = entry.created_by === user.id;

            const cardBody = (
              <>
                <div className="relative">
                  <Image
                    src={entry.image_url}
                    alt={entry.title}
                    width={600}
                    height={400}
                    className="h-56 w-full object-cover"
                  />

                  {isOwnImage && (
                    <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-[#1C1F23] shadow">
                      <Pencil size={12} />
                      Edit
                    </span>
                  )}
                </div>

                <div className="p-4">
                  <h2 className="text-xl font-semibold">{entry.title}</h2>

                  {entry.description && (
                    <p className="mt-3 text-sm text-gray-700">
                      {entry.description}
                    </p>
                  )}

                  <div className="mt-4 border-t pt-3 text-xs text-gray-500">
                    <p>Submitted by: {submittedBy}</p>
                    <p>{new Date(entry.created_at).toLocaleString()}</p>
                  </div>
                </div>
              </>
            );

            return isOwnImage ? (
              <Link
                key={entry.id}
                id={`image-${entry.id}`}
                href={`/images/manage?id=${entry.id}`}
                className="scroll-mt-8 block overflow-hidden rounded-lg bg-white shadow transition hover:shadow-lg target:ring-4 target:ring-[#8ED4FF] target:ring-offset-2"
              >
                {cardBody}
              </Link>
            ) : (
              <div
                key={entry.id}
                id={`image-${entry.id}`}
                className="scroll-mt-8 overflow-hidden rounded-lg bg-white shadow target:ring-4 target:ring-[#8ED4FF] target:ring-offset-2"
              >
                {cardBody}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}