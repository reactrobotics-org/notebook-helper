"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type ImageEntry = {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  category: string | null;
  subsystem: string | null;
  created_by: string;
  created_at: string;
};

const categories = [
  "Brainstorm",
  "Design",
  "Prototype",
  "Build",
  "Programming",
  "Testing",
  "Other",
];

const subsystems = [
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

export default function ManageImagesPage() {
  const supabase = createClient();

  const [images, setImages] = useState<ImageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadMyImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMyImages() {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage("You must be logged in to manage images.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("image_entries")
      .select(
        `
        id,
        title,
        description,
        image_url,
        category,
        subsystem,
        created_by,
        created_at
      `
      )
      .eq("created_by", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading images:", error);
      setMessage(`Error loading images: ${error.message}`);
      setLoading(false);
      return;
    }

    setImages(data || []);
    setLoading(false);
  }

  function updateLocalImage(
    id: string,
    field: "title" | "description" | "category" | "subsystem",
    value: string
  ) {
    setImages((currentImages) =>
      currentImages.map((image) =>
        image.id === id
          ? {
              ...image,
              [field]: value,
            }
          : image
      )
    );
  }

  async function saveChanges(entry: ImageEntry) {
    setSavingId(entry.id);
    setMessage("");

    const { error } = await supabase
      .from("image_entries")
      .update({
        title: entry.title,
        description: entry.description,
        category: entry.category,
        subsystem: entry.subsystem,
      })
      .eq("id", entry.id)
      .eq("created_by", entry.created_by);

    setSavingId(null);

    if (error) {
      console.error("Error saving image:", error);
      setMessage(`Error saving image: ${error.message}`);
      return;
    }

    setMessage("Image information saved.");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-8">
        <div className="mx-auto max-w-5xl rounded bg-white p-8 shadow">
          <p className="text-slate-700">Loading images...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Manage Images</h1>
            <p className="mt-1 text-sm text-slate-600">
              Update the information for images you uploaded.
            </p>
          </div>

          <Link
            href="/images"
            className="rounded border bg-white px-4 py-2 hover:bg-slate-50"
          >
            Back to Images
          </Link>
        </div>

        {message && (
          <div className="mb-6 rounded bg-white p-4 text-sm text-slate-700 shadow">
            {message}
          </div>
        )}

        {images.length === 0 ? (
          <div className="rounded bg-white p-8 text-center shadow">
            <p className="text-slate-600">
              You have not uploaded any images yet.
            </p>
            <Link
              href="/images/new"
              className="mt-4 inline-block rounded bg-[#8ED4FF] text-[#1C1F23] px-4 py-2 text-white hover:bg-[#74C7FA]"
            >
              Add Image
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {images.map((entry) => (
              <div key={entry.id} className="rounded-lg bg-white p-4 shadow">
                <div className="grid gap-6 md:grid-cols-[260px_1fr]">
                  <Image
                    src={entry.image_url}
                    alt={entry.title || "Uploaded image"}
                    width={520}
                    height={360}
                    className="h-64 w-full rounded border object-cover md:h-48"
                  />

                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Title
                      </label>
                      <input
                        value={entry.title || ""}
                        onChange={(event) =>
                          updateLocalImage(
                            entry.id,
                            "title",
                            event.target.value
                          )
                        }
                        className="w-full rounded border p-2"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Description
                      </label>
                      <textarea
                        value={entry.description || ""}
                        onChange={(event) =>
                          updateLocalImage(
                            entry.id,
                            "description",
                            event.target.value
                          )
                        }
                        rows={4}
                        className="w-full rounded border p-2"
                        placeholder="Describe what this image shows"
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium">
                          Category
                        </label>
                        <select
                          value={entry.category || ""}
                          onChange={(event) =>
                            updateLocalImage(
                              entry.id,
                              "category",
                              event.target.value
                            )
                          }
                          className="w-full rounded border p-2"
                        >
                          <option value="">Select category</option>
                          {categories.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium">
                          Subsystem
                        </label>
                        <select
                          value={entry.subsystem || ""}
                          onChange={(event) =>
                            updateLocalImage(
                              entry.id,
                              "subsystem",
                              event.target.value
                            )
                          }
                          className="w-full rounded border p-2"
                        >
                          <option value="">Select subsystem</option>
                          {subsystems.map((subsystem) => (
                            <option key={subsystem} value={subsystem}>
                              {subsystem}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 border-t pt-4">
                      <p className="text-xs text-slate-500">
                        Uploaded {new Date(entry.created_at).toLocaleString()}
                      </p>

                      <button
                        type="button"
                        onClick={() => saveChanges(entry)}
                        disabled={savingId === entry.id}
                        className="rounded bg-[#8ED4FF] text-[#1C1F23] px-4 py-2 text-white hover:bg-[#74C7FA] disabled:opacity-50"
                      >
                        {savingId === entry.id ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}