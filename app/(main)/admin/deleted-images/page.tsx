import Image from "next/image";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Trash2, RotateCcw, ShieldCheck, AlertTriangle } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";

type PersonInfo = {
  full_name: string | null;
  email: string | null;
} | null;

type TeamInfo = {
  team_number: string | null;
  team_name: string | null;
} | null;

type DeletedImage = {
  id: string;
  title: string | null;
  description: string | null;
  image_url: string;
  created_at: string;
  deleted_at: string;
  profiles: PersonInfo | PersonInfo[] | null;
  teams: TeamInfo | TeamInfo[] | null;
};

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function extractStoragePath(imageUrl: string): string | null {
  const marker = "/storage/v1/object/public/images/";
  const index = imageUrl.indexOf(marker);
  if (index === -1) return null;
  return imageUrl.slice(index + marker.length);
}

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

async function restoreImage(formData: FormData) {
  "use server";

  const supabase = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  if (!id) return;

  const { data } = await supabase
    .from("image_entries")
    .update({ deleted_at: null })
    .eq("id", id)
    .select();

  if (!data || data.length === 0) {
    redirect("/admin/deleted-images?error=restore_failed");
  }

  revalidatePath("/admin/deleted-images");
  revalidatePath("/images");
  revalidatePath("/dashboard");
  revalidatePath("/teams");
  revalidatePath("/admin/activity");
}

async function permanentlyDeleteImage(formData: FormData) {
  "use server";

  const supabase = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const imageUrl = String(formData.get("image_url") ?? "");

  if (!id) return;

  const { data } = await supabase
    .from("image_entries")
    .delete()
    .eq("id", id)
    .select();

  if (!data || data.length === 0) {
    redirect("/admin/deleted-images?error=delete_failed");
  }

  const storagePath = extractStoragePath(imageUrl);

  if (storagePath) {
    await supabase.storage.from("images").remove([storagePath]);
  }

  revalidatePath("/admin/deleted-images");
}

export default async function AdminDeletedImagesPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const supabase = await requireAdmin();
  const params = await searchParams;

  const { data: deletedImages, error } = await supabase
    .from("image_entries")
    .select(
      `
      id,
      title,
      description,
      image_url,
      created_at,
      deleted_at,
      profiles ( full_name, email ),
      teams ( team_number, team_name )
    `
    )
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  const images = (deletedImages ?? []) as DeletedImage[];

  return (
    <>
      <div className="mb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#1C1F23] px-4 py-2 text-sm font-semibold text-white">
          <ShieldCheck size={18} /> Admin Only
        </div>

        <h2 className="text-3xl font-bold text-[#1C1F23]">Deleted Images</h2>
        <p className="mt-2 text-slate-600">
          Images students or mentors deleted, across every team. Restore them
          back to the team's gallery, or permanently remove them.
        </p>
      </div>

      {params?.error === "restore_failed" && (
        <div className="mb-6 flex items-center gap-3 rounded-xl bg-amber-50 p-4 text-amber-900">
          <AlertTriangle size={20} className="shrink-0" />
          <p>
            Nothing was restored. This usually means a Supabase Row Level
            Security policy is blocking the update — check the UPDATE policy
            on image_entries covers Admins for rows they didn't create.
          </p>
        </div>
      )}

      {params?.error === "delete_failed" && (
        <div className="mb-6 flex items-center gap-3 rounded-xl bg-amber-50 p-4 text-amber-900">
          <AlertTriangle size={20} className="shrink-0" />
          <p>
            Nothing was permanently deleted. This usually means a Supabase
            Row Level Security policy is blocking the delete — check that a
            DELETE policy exists on image_entries for Admins.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-xl bg-red-100 p-4 text-red-700">
          Error loading deleted images: {error.message}
        </div>
      )}

      {images.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          No deleted images right now.
        </div>
      ) : (
        <div className="space-y-4">
          {images.map((entry) => {
            const submitter = one(entry.profiles);
            const team = one(entry.teams);

            const teamLabel = team?.team_number
              ? `${team.team_number}${
                  team.team_name ? ` - ${team.team_name}` : ""
                }`
              : "No team";

            return (
              <div
                key={entry.id}
                className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center"
              >
                <Image
                  src={entry.image_url}
                  alt={entry.title || "Deleted image"}
                  width={160}
                  height={120}
                  className="h-24 w-32 shrink-0 rounded border object-cover"
                />

                <div className="flex-1">
                  <p className="font-semibold text-[#1C1F23]">
                    {entry.title || "Untitled"}
                  </p>
                  <p className="text-sm text-slate-600">{teamLabel}</p>
                  <p className="text-xs text-slate-500">
                    Uploaded by{" "}
                    {submitter?.full_name ||
                      submitter?.email ||
                      "Unknown user"}
                  </p>
                  <p className="text-xs text-slate-500">
                    Deleted {new Date(entry.deleted_at).toLocaleString()}
                  </p>
                </div>

                <div className="flex gap-2">
                  <form action={restoreImage}>
                    <input type="hidden" name="id" value={entry.id} />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                    >
                      <RotateCcw size={16} /> Restore
                    </button>
                  </form>

                  <form action={permanentlyDeleteImage}>
                    <input type="hidden" name="id" value={entry.id} />
                    <input
                      type="hidden"
                      name="image_url"
                      value={entry.image_url}
                    />
                    <ConfirmSubmitButton
                      confirmMessage="Permanently delete this image? This cannot be undone."
                      className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={16} /> Delete Forever
                    </ConfirmSubmitButton>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}