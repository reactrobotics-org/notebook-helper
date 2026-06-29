import Link from "next/link";
import Image from "next/image";
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
      profiles (
        full_name,
        email
      )
    `);

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
          </div>

          <Link
            href="/images/new"
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Add Image
          </Link>
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

        {!error && (!images || images.length === 0) && (
          <div className="rounded bg-white p-8 text-center shadow">
            <p className="text-gray-600">No images match those filters.</p>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {images?.map((entry) => {
            const submittedBy =
              entry.profiles?.full_name ??
              entry.profiles?.email ??
              "Unknown user";

            return (
              <div
                key={entry.id}
                className="overflow-hidden rounded-lg bg-white shadow"
              >
                <Image
                  src={entry.image_url}
                  alt={entry.title}
                  width={600}
                  height={400}
                  className="h-56 w-full object-cover"
                />

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
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}