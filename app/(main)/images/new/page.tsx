"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { v4 as uuidv4 } from "uuid";
import { Camera, ImagePlus } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { compressImage } from "@/utils/compressImage";

type ImageForm = {
  title: string;
  category: string;
  subsystem: string;
  notes: string;
};

export default function NewImagePage() {
  const supabase = createClient();
  const { register, handleSubmit, reset } = useForm<ImageForm>();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");

  function handleImageSelected(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0] ?? null;

    setSelectedFile(file);
    setMessage("");
  }

  async function onSubmit(data: ImageForm) {
    setMessage("Saving...");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage("You must be logged in to save an image.");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, team_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      setMessage("Could not find your profile.");
      return;
    }

    if (!profile.team_id) {
      setMessage("Your account is not assigned to a team yet.");
      return;
    }

    if (!selectedFile) {
      setMessage("Please choose an image.");
      return;
    }

    setMessage("Compressing image...");
    const compressedFile = await compressImage(selectedFile);

    const originalKB = (selectedFile.size / 1024).toFixed(0);
    const compressedKB = (compressedFile.size / 1024).toFixed(0);

    const fileExt = compressedFile.name.split(".").pop();
    const fileName = `${profile.team_id}/${uuidv4()}.${fileExt}`;

    setMessage(`Saving (${originalKB}KB → ${compressedKB}KB)...`);

    const { error: uploadError } = await supabase.storage
      .from("images")
      .upload(fileName, compressedFile);

    if (uploadError) {
      setMessage(`Upload error: ${uploadError.message}`);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("images")
      .getPublicUrl(fileName);

    const { error: insertError } = await supabase
      .from("image_entries")
      .insert({
        team_id: profile.team_id,
        created_by: user.id,
        title: data.title,
        category: data.category,
        subsystem: data.subsystem,
        description: data.notes,
        image_url: publicUrlData.publicUrl,
      });

    if (insertError) {
      setMessage(`Database error: ${insertError.message}`);
      return;
    }

    reset();
    setSelectedFile(null);

    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setMessage("Image saved.");
  }

  return (
    <main className="min-h-dvh bg-slate-100 p-8">
      <div className="mx-auto max-w-3xl rounded-lg bg-white p-8 shadow">
        <h1 className="mb-6 text-3xl font-bold">Add Image</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label className="mb-2 block font-medium">Image</label>

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

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg bg-[#1C1F23] px-4 py-2 font-semibold text-white hover:bg-black"
              >
                <Camera size={18} />
                Take Photo
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-[#1C1F23] hover:bg-slate-50"
              >
                <ImagePlus size={18} />
                Choose Existing Image
              </button>
            </div>

            {selectedFile && (
              <p className="mt-3 text-sm text-slate-600">
                Selected: {selectedFile.name}
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block font-medium">Title</label>
            <input
              {...register("title")}
              className="w-full rounded border p-2"
            />
          </div>

          <div>
            <label className="mb-2 block font-medium">Category</label>
            <select
              {...register("category")}
              className="w-full rounded border p-2"
            >
              <option>Brainstorm</option>
              <option>Design</option>
              <option>Prototype</option>
              <option>Build</option>
              <option>Programming</option>
              <option>Testing</option>
              <option>Other</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block font-medium">Subsystem</label>
            <select
              {...register("subsystem")}
              className="w-full rounded border p-2"
            >
              <option>Drivetrain</option>
              <option>Intake</option>
              <option>Conveyor</option>
              <option>Lift</option>
              <option>Claw</option>
              <option>Electrical</option>
              <option>Pneumatics</option>
              <option>Sensors</option>
              <option>Other</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block font-medium">Notes</label>
            <textarea
              {...register("notes")}
              rows={6}
              className="w-full rounded border p-2"
            />
          </div>

          <button
            type="submit"
            className="rounded bg-[#8ED4FF] px-4 py-2 text-[#1C1F23] hover:bg-[#74C7FA]"
          >
            Save
          </button>

          {message && (
            <p className="text-sm text-slate-700">{message}</p>
          )}
        </form>
      </div>
    </main>
  );
}