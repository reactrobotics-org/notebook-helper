"use client";

import Link from "next/link";
import RichTextEditor from "@/components/RichTextEditor";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function NewMeetingNotePage() {
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [attendees, setAttendees] = useState("");
  const [workedOn, setWorkedOn] = useState("");
  const [actionItems, setActionItems] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function saveMeetingNote() {
    setSaving(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage("You must be logged in to add meeting notes.");
      setSaving(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("team_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.team_id) {
      setMessage("You must be assigned to a team before adding meeting notes.");
      setSaving(false);
      return;
    }

    if (!title.trim()) {
      setMessage("Please enter a title.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("meeting_notes").insert({
      team_id: profile.team_id,
      created_by: user.id,
      title,
      meeting_date: meetingDate,
      attendees,
      worked_on: workedOn,
      action_items: actionItems,
      notes,
    });

    if (error) {
      console.error("Error saving meeting note:", error);
      setMessage(`Error saving meeting note: ${error.message}`);
      setSaving(false);
      return;
    }

    router.push("/meeting-notes");
  }

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-4xl rounded bg-white p-8 shadow">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Add Meeting Note</h1>
            <p className="mt-1 text-sm text-slate-600">
              Record what happened during practice.
            </p>
          </div>

          <Link
            href="/meeting-notes"
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
            <label className="mb-1 block font-medium">Title</label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded border p-2"
              placeholder="Example: Drive team practice"
            />
          </div>

          <div>
            <label className="mb-1 block font-medium">Meeting Date</label>
            <input
              type="date"
              value={meetingDate}
              onChange={(event) => setMeetingDate(event.target.value)}
              className="rounded border p-2"
            />
          </div>

          <div>
            <label className="mb-1 block font-medium">Who Was Present?</label>
            <textarea
              value={attendees}
              onChange={(event) => setAttendees(event.target.value)}
              rows={3}
              className="w-full rounded border p-2"
              placeholder="List Students Present"
            />
          </div>

          <div>
            <label className="mb-1 block font-medium">
              What Did Each Person Work On?
            </label>
            <RichTextEditor
              value={workedOn}
              onChange={setWorkedOn}
              placeholder="Example: Alex worked on intake. Jordan tested autonomous. Sam documented changes."
            />
          </div>

          <div>
            <label className="mb-1 block font-medium">
              Action Items for Next Practice
            </label>
            <RichTextEditor
              value={actionItems}
              onChange={setActionItems}
              placeholder="What needs to happen next?"
            />
          </div>

          <div>
            <label className="mb-1 block font-medium">Additional Notes</label>
            <RichTextEditor
              value={notes}
              onChange={setNotes}
              placeholder="Anything else worth documenting"
            />
          </div>

          <button
            type="button"
            onClick={saveMeetingNote}
            disabled={saving}
            className="rounded bg-blue-600 px-5 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Meeting Note"}
          </button>
        </div>
      </div>
    </main>
  );
}