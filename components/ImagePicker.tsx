"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type ImageEntry = {
  id: string;
  title: string;
  image_url: string;
  description: string | null;
};

type ImageSize = "small" | "medium" | "large" | "full";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (imageUrl: string, size: ImageSize) => void;
};

export default function ImagePicker({ open, onClose, onSelect }: Props) {
  const supabase = createClient();
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadTeamImages();
    }
  }, [open]);

  async function loadTeamImages() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("team_id")
      .eq("id", user.id)
      .single();

    if (!profile?.team_id) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("image_entries")
      .select("id, title, image_url, description")
      .eq("team_id", profile.team_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading team images:", error);
      setLoading(false);
      return;
    }

    setImages(data || []);
    setLoading(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
      <div className="max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Choose an Image</h2>

          <button
            type="button"
            onClick={onClose}
            className="rounded border px-3 py-1 hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        {loading && <p>Loading images...</p>}

        {!loading && images.length === 0 && (
          <p className="text-slate-600">No team images found.</p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {images.map((image) => (
            <button
              key={image.id}
              type="button"
              onClick={() => {
                onSelect(image.image_url,"medium");
                onClose();
              }}
              className="rounded border bg-white p-3 text-left hover:bg-slate-50"
            >
              <Image
                src={image.image_url}
                alt={image.title || "Team image"}
                width={400}
                height={300}
                className="mb-2 h-40 w-full rounded object-cover"
              />

              <div className="font-medium">{image.title || "Untitled"}</div>

              {image.description && (
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                  {image.description}
                </p>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}