"use client";

import Link from "next/link";
import RichTextEditor from "@/components/RichTextEditor";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function NewScratchpadEntryPage() {
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function saveEntry() {
    setSaving(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage("You must be logged in to add a scratchpad entry.");
      setSaving(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("team_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.team_id) {
      setMessage("You must be assigned to a team before adding an idea.");
      setSaving(false);
      return;
    }

    if (!content.trim()) {
      setMessage("Write something before saving.");
      setSaving(false);
      return;
    }

    const displayName =
      user.user_metadata?.full_name ?? user.email ?? "Unknown user";

    const { error } = await supabase.from("scratchpad_entries").insert({
      team_id: profile.team_id,
      created_by: user.id,
      title: title.trim() || null,
      content,
      updated_by_name: displayName,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Error saving scratchpad entry:", error);
      setMessage(`Error saving idea: ${error.message}`);
      setSaving(false);
      return;
    }

    router.push("/scratchpad");
  }

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-4xl rounded bg-white p-8 shadow">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">New Idea</h1>
            <p className="mt-1 text-sm text-slate-600">
              Jot down a thought to reference later — take a picture if it
              helps explain it. This isn&apos;t a full meeting note.
            </p>
          </div>

          <Link
            href="/scratchpad"
            className="rounded border px-4 py-2 hover:bg-slate-100"
          >
            Back
          </Link>
        </div>

        {message && (
          <div className="mb-6 rounded bg-red-100 p-4 text-sm text-red-700">
            {message}
          </div>
        )}

        <div className="space-y-5">
          <div>
            <label className="mb-1 block font-medium">
              Title <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded border p-2"
              placeholder="Example: Idea for the intake mechanism"
            />
          </div>

          <div>
            <label className="mb-1 block font-medium">What&apos;s the idea?</label>
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder="Type your idea here. Use the image button to take a picture or insert an existing team photo."
            />
          </div>

          <button
            type="button"
            onClick={saveEntry}
            disabled={saving}
            className="rounded bg-[#8ED4FF] text-[#1C1F23] px-5 py-2 text-white hover:bg-[#74C7FA] disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Idea"}
          </button>
        </div>
      </div>
    </main>
  );
}