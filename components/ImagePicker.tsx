"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { Camera, ImagePlus } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { compressImage } from "@/utils/compressImage";

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

export default function ImagePicker({
  open,
  onClose,
  onSelect,
}: Props) {
  const supabase = createClient();

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [images, setImages] = useState<ImageEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

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

  async function handleImageSelected(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    setUploading(true);
    setUploadError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setUploadError("You must be signed in to add a photo.");
      setUploading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("team_id")
      .eq("id", user.id)
      .single();

    if (!profile?.team_id) {
      setUploadError(
        "Your account is not assigned to a team yet."
      );
      setUploading(false);
      return;
    }

    const compressedFile = await compressImage(file);

    const fileExt = compressedFile.name.split(".").pop();
    const fileName = `${profile.team_id}/${uuidv4()}.${fileExt}`;

    const { error: uploadErr } = await supabase.storage
      .from("images")
      .upload(fileName, compressedFile);

    if (uploadErr) {
      setUploadError(`Upload error: ${uploadErr.message}`);
      setUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("images")
      .getPublicUrl(fileName);

    const { error: insertErr } = await supabase
      .from("image_entries")
      .insert({
        team_id: profile.team_id,
        created_by: user.id,
        title: "Meeting Note Photo",
        image_url: publicUrlData.publicUrl,
      });

    if (insertErr) {
      setUploadError(`Database error: ${insertErr.message}`);
      setUploading(false);
      return;
    }

    setUploading(false);

    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    onSelect(publicUrlData.publicUrl, "medium");
    onClose();
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

        <div className="mb-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageSelected}
            className="hidden"
          />

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelected}
            className="hidden"
          />

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1C1F23] px-4 py-2 font-semibold text-white hover:bg-black disabled:opacity-50"
            >
              <Camera size={18} />

              {uploading ? "Uploading..." : "Take a Photo"}
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-[#1C1F23] hover:bg-slate-100 disabled:opacity-50"
            >
              <ImagePlus size={18} />
              Choose Existing Image
            </button>
          </div>

          <p className="mt-3 text-sm text-slate-600">
            Take a new photo or choose one already saved on your
            device. The image will also be added to your team&apos;s
            Images gallery.
          </p>
        </div>

        {uploadError && (
          <p className="mb-4 text-sm text-red-600">
            {uploadError}
          </p>
        )}

        {loading && <p>Loading images...</p>}

        {!loading && images.length === 0 && (
          <p className="text-slate-600">
            No team images found.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {images.map((image) => (
            <button
              key={image.id}
              type="button"
              onClick={() => {
                onSelect(image.image_url, "medium");
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

              <div className="font-medium">
                {image.title || "Untitled"}
              </div>

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