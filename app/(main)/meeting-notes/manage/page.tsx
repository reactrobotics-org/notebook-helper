"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import RichTextEditor from "@/components/RichTextEditor";
import { createClient } from "@/utils/supabase/client";

type MeetingNote = {
  id: string;
  team_id: string;
  title: string;
  meeting_date: string;
  attendees: string | null;
  worked_on: string | null;
  action_items: string | null;
  created_at: string;
  updated_by_name: string | null;
  updated_at: string | null;
};

type EditableField =
  | "title"
  | "meeting_date"
  | "attendees"
  | "worked_on"
  | "action_items";

function ManageMeetingNotesContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const noteId = searchParams.get("id");

  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [currentUserLabel, setCurrentUserLabel] = useState("");

  useEffect(() => {
    loadNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  async function loadNotes() {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage("You must be logged in to manage meeting notes.");
      setLoading(false);
      return;
    }

    setCurrentUserLabel(
      user.user_metadata?.full_name ?? user.email ?? "Unknown user"
    );

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("team_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.team_id) {
      setMessage("You must be assigned to a team to manage meeting notes.");
      setLoading(false);
      return;
    }

    let query = supabase
      .from("meeting_notes")
      .select(
        `
        id,
        team_id,
        title,
        meeting_date,
        attendees,
        worked_on,
        action_items,
        created_at,
        updated_by_name,
        updated_at
      `
      )
      .eq("team_id", profile.team_id);

    query = noteId
      ? query.eq("id", noteId)
      : query.order("meeting_date", { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error("Error loading meeting notes:", error);
      setMessage(`Error loading meeting notes: ${error.message}`);
      setLoading(false);
      return;
    }

    setNotes(data || []);
    setLoading(false);
  }

  function updateLocalNote(id: string, field: EditableField, value: string) {
    setNotes((currentNotes) =>
      currentNotes.map((note) =>
        note.id === id
          ? {
              ...note,
              [field]: value,
            }
          : note
      )
    );
  }

  async function saveChanges(note: MeetingNote) {
    setSavingId(note.id);
    setMessage("");

    const savedAt = new Date().toISOString();

    const { error } = await supabase
      .from("meeting_notes")
      .update({
        title: note.title,
        meeting_date: note.meeting_date,
        attendees: note.attendees,
        worked_on: note.worked_on,
        action_items: note.action_items,
        updated_by_name: currentUserLabel,
        updated_at: savedAt,
      })
      .eq("id", note.id)
      .eq("team_id", note.team_id);

    setSavingId(null);

    if (error) {
      console.error("Error saving meeting note:", error);
      setMessage(`Error saving meeting note: ${error.message}`);
      return;
    }

    setNotes((currentNotes) =>
      currentNotes.map((current) =>
        current.id === note.id
          ? {
              ...current,
              updated_by_name: currentUserLabel,
              updated_at: savedAt,
            }
          : current
      )
    );

    setMessage("Meeting note saved.");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-8">
        <div className="mx-auto max-w-4xl rounded bg-white p-8 shadow">
          <p className="text-slate-700">Loading meeting notes...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              {noteId ? "Edit Meeting Note" : "Manage Meeting Notes"}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {noteId
                ? "Any team member can update this meeting note."
                : "Edit meeting notes for your team. Any team member can update these."}
            </p>
          </div>

          <Link
            href="/meeting-notes"
            className="rounded border bg-white px-4 py-2 hover:bg-slate-50"
          >
            Back to Meeting Notes
          </Link>
        </div>

        {message && (
          <div className="mb-6 rounded bg-white p-4 text-sm text-slate-700 shadow">
            {message}
          </div>
        )}

        {notes.length === 0 ? (
          <div className="rounded bg-white p-8 text-center shadow">
            {noteId ? (
              <p className="text-slate-600">
                This meeting note could not be found, or isn&apos;t part of
                your team.
              </p>
            ) : (
              <>
                <p className="text-slate-600">
                  No meeting notes to manage yet.
                </p>
                <Link
                  href="/meeting-notes/new"
                  className="mt-4 inline-block rounded bg-[#8ED4FF] text-[#1C1F23] px-4 py-2 text-white hover:bg-[#74C7FA]"
                >
                  Add Meeting Note
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {notes.map((note) => (
              <div key={note.id} className="rounded-lg bg-white p-6 shadow">
                <div className="space-y-5">
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Title
                    </label>
                    <input
                      value={note.title || ""}
                      onChange={(event) =>
                        updateLocalNote(note.id, "title", event.target.value)
                      }
                      className="w-full rounded border p-2"
                      placeholder="Example: Drive team practice"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Meeting Date
                    </label>
                    <input
                      type="date"
                      value={note.meeting_date || ""}
                      onChange={(event) =>
                        updateLocalNote(
                          note.id,
                          "meeting_date",
                          event.target.value
                        )
                      }
                      className="rounded border p-2"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Who Was Present?
                    </label>
                    <textarea
                      value={note.attendees || ""}
                      onChange={(event) =>
                        updateLocalNote(
                          note.id,
                          "attendees",
                          event.target.value
                        )
                      }
                      rows={3}
                      className="w-full rounded border p-2"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      What Did Each Person Work On?
                    </label>
                    <RichTextEditor
                      value={note.worked_on || ""}
                      onChange={(value) =>
                        updateLocalNote(note.id, "worked_on", value)
                      }
                      placeholder="Example: Alex worked on intake. Jordan tested autonomous. Sam documented changes."
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Action Items for Next Practice
                    </label>
                    <RichTextEditor
                      value={note.action_items || ""}
                      onChange={(value) =>
                        updateLocalNote(note.id, "action_items", value)
                      }
                      placeholder="What needs to happen next?"
                      enableImages={false}
                      enableAI={false}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4 border-t pt-4">
                    <div>
                      <p className="text-xs text-slate-500">
                        Created {new Date(note.created_at).toLocaleString()}
                      </p>

                      {note.updated_by_name && note.updated_at && (
                        <p className="mt-1 text-xs text-slate-400">
                          Last saved by {note.updated_by_name} at{" "}
                          {new Date(note.updated_at).toLocaleString()}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => saveChanges(note)}
                      disabled={savingId === note.id}
                      className="rounded bg-[#8ED4FF] text-[#1C1F23] px-4 py-2 text-white hover:bg-[#74C7FA] disabled:opacity-50"
                    >
                      {savingId === note.id ? "Saving..." : "Save Changes"}
                    </button>
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

export default function ManageMeetingNotesPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-100 p-8">
          <div className="mx-auto max-w-4xl rounded bg-white p-8 shadow">
            <p className="text-slate-700">Loading meeting notes...</p>
          </div>
        </main>
      }
    >
      <ManageMeetingNotesContent />
    </Suspense>
  );
}