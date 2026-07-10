"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import RichTextEditor from "@/components/RichTextEditor";
import { createClient } from "@/utils/supabase/client";

type ScratchpadEntry = {
  id: string;
  team_id: string;
  title: string | null;
  content: string | null;
  created_at: string;
  updated_by_name: string | null;
  updated_at: string | null;
};

const PAGE_SIZE = 10;

type EditableField = "title" | "content";

function ManageScratchpadContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const entryId = searchParams.get("id");
  const currentPage = Math.max(
    1,
    parseInt(searchParams.get("page") ?? "1", 10) || 1
  );

  const [entries, setEntries] = useState<ScratchpadEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reloadingId, setReloadingId] = useState<string | null>(null);
  const [conflictId, setConflictId] = useState<string | null>(null);
  const [conflictInfo, setConflictInfo] = useState<{
    updatedByName: string | null;
    updatedAt: string;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [currentUserLabel, setCurrentUserLabel] = useState("");

  useEffect(() => {
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId, currentPage]);

  async function loadEntries() {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage("You must be logged in to manage scratchpad entries.");
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
      setMessage("You must be assigned to a team to manage ideas.");
      setLoading(false);
      return;
    }

    let query = supabase
      .from("scratchpad_entries")
      .select(
        `
        id,
        team_id,
        title,
        content,
        created_at,
        updated_by_name,
        updated_at
      `,
        { count: "exact" }
      )
      .eq("team_id", profile.team_id)
      .is("deleted_at", null);

    if (entryId) {
      query = query.eq("id", entryId);
    } else {
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.order("created_at", { ascending: false }).range(from, to);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error("Error loading scratchpad entries:", error);
      setMessage(`Error loading ideas: ${error.message}`);
      setLoading(false);
      return;
    }

    setEntries(data || []);
    setTotalCount(count ?? 0);
    setLoading(false);
  }

  function updateLocalEntry(id: string, field: EditableField, value: string) {
    setEntries((current) =>
      current.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              [field]: value,
            }
          : entry
      )
    );
  }

  async function saveChanges(entry: ScratchpadEntry) {
    setSavingId(entry.id);
    setMessage("");
    setConflictId(null);
    setConflictInfo(null);

    const savedAt = new Date().toISOString();

    let query = supabase
      .from("scratchpad_entries")
      .update({
        title: entry.title,
        content: entry.content,
        updated_by_name: currentUserLabel,
        updated_at: savedAt,
      })
      .eq("id", entry.id)
      .eq("team_id", entry.team_id);

    // Only overwrite if the row still matches the version we loaded —
    // this is what catches a second person's save landing in between.
    query = entry.updated_at
      ? query.eq("updated_at", entry.updated_at)
      : query.is("updated_at", null);

    const { data, error } = await query.select();

    setSavingId(null);

    if (error) {
      console.error("Error saving scratchpad entry:", error);
      setMessage(`Error saving idea: ${error.message}`);
      return;
    }

    if (!data || data.length === 0) {
      // Either an RLS policy blocked the write, or someone else saved
      // this entry first. Reading the row's current state tells us which.
      const { data: currentRow } = await supabase
        .from("scratchpad_entries")
        .select("updated_at, updated_by_name")
        .eq("id", entry.id)
        .eq("team_id", entry.team_id)
        .is("deleted_at", null)
        .maybeSingle();

      if (currentRow) {
        setConflictId(entry.id);
        setConflictInfo({
          updatedByName: currentRow.updated_by_name,
          updatedAt: currentRow.updated_at ?? savedAt,
        });
        setMessage(
          "This idea wasn't saved — someone else saved changes to it first."
        );
        return;
      }

      console.error(
        "Update returned no rows — likely blocked by a Row Level Security policy."
      );
      setMessage(
        "Nothing was updated. This usually means a Supabase Row Level Security policy is blocking the update — check the UPDATE policy on scratchpad_entries."
      );
      return;
    }

    setEntries((current) =>
      current.map((item) =>
        item.id === entry.id
          ? {
              ...item,
              updated_by_name: currentUserLabel,
              updated_at: savedAt,
            }
          : item
      )
    );

    setMessage("Idea saved.");
  }

  async function reloadEntry(id: string) {
    setReloadingId(id);
    setMessage("");

    const { data, error } = await supabase
      .from("scratchpad_entries")
      .select(
        `
        id,
        team_id,
        title,
        content,
        created_at,
        updated_by_name,
        updated_at
      `
      )
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    setReloadingId(null);

    if (error || !data) {
      setMessage(
        "Could not reload this idea. It may have been deleted — try going back to the list."
      );
      return;
    }

    setEntries((current) =>
      current.map((item) => (item.id === id ? (data as ScratchpadEntry) : item))
    );

    setConflictId(null);
    setConflictInfo(null);
    setMessage(
      "Reloaded the latest version of this idea. Your unsaved edits were discarded."
    );
  }

  async function deleteEntry(entry: ScratchpadEntry) {
    const confirmed = window.confirm(
      "Delete this idea? An admin will be able to restore it if needed."
    );

    if (!confirmed) return;

    setDeletingId(entry.id);
    setMessage("");

    const { data, error } = await supabase
      .from("scratchpad_entries")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", entry.id)
      .eq("team_id", entry.team_id)
      .select();

    setDeletingId(null);

    if (error) {
      console.error("Error deleting scratchpad entry:", error);
      setMessage(`Error deleting idea: ${error.message}`);
      return;
    }

    if (!data || data.length === 0) {
      console.error(
        "Delete returned no rows — likely blocked by a Row Level Security policy."
      );
      setMessage(
        "Nothing was updated. This usually means a Supabase Row Level Security policy is blocking the update — check the UPDATE policy on scratchpad_entries."
      );
      return;
    }

    setEntries((current) => current.filter((item) => item.id !== entry.id));
    setMessage(
      "Idea deleted. If you deleted this by mistake, ask an admin to restore it."
    );
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-8">
        <div className="mx-auto max-w-4xl rounded bg-white p-8 shadow">
          <p className="text-slate-700">Loading ideas...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Manage Ideas</h1>
            <p className="mt-1 text-sm text-slate-600">
              {entryId
                ? "Any team member can update this idea."
                : "Edit ideas for your team. Any team member can update these."}
            </p>
          </div>

          <Link
            href="/scratchpad"
            className="rounded border bg-white px-4 py-2 hover:bg-slate-50"
          >
            Back to Scratchpad
          </Link>
        </div>

        {message && (
          <div className="mb-6 rounded bg-white p-4 text-sm text-slate-700 shadow">
            {message}
          </div>
        )}

        {entries.length === 0 ? (
          <div className="rounded bg-white p-8 text-center shadow">
            {entryId ? (
              <p className="text-slate-600">
                This idea could not be found, or isn&apos;t part of your team.
              </p>
            ) : (
              <>
                <p className="text-slate-600">No ideas to manage yet.</p>
                <Link
                  href="/scratchpad/new"
                  className="mt-4 inline-block rounded bg-[#8ED4FF] text-[#1C1F23] px-4 py-2 text-white hover:bg-[#74C7FA]"
                >
                  Add Idea
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {entries.map((entry) => (
              <div key={entry.id} className="rounded-lg bg-white p-6 shadow">
                <div className="space-y-5">
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Title{" "}
                      <span className="font-normal text-slate-400">
                        (optional)
                      </span>
                    </label>
                    <input
                      value={entry.title || ""}
                      onChange={(event) =>
                        updateLocalEntry(entry.id, "title", event.target.value)
                      }
                      className="w-full rounded border p-2"
                      placeholder="Example: Idea for the intake mechanism"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      What&apos;s the idea?
                    </label>
                    <RichTextEditor
                      value={entry.content || ""}
                      onChange={(value) =>
                        updateLocalEntry(entry.id, "content", value)
                      }
                      placeholder="Type your idea here. Use the image button to take a picture or insert an existing team photo."
                    />
                  </div>

                  {conflictId === entry.id && conflictInfo && (
                    <div className="rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                      <p>
                        Someone else saved changes to this idea
                        {conflictInfo.updatedByName
                          ? ` (${conflictInfo.updatedByName})`
                          : ""}{" "}
                        at {new Date(conflictInfo.updatedAt).toLocaleString()},
                        after you started editing. Your changes above were
                        not saved.
                      </p>
                      <button
                        type="button"
                        onClick={() => reloadEntry(entry.id)}
                        disabled={reloadingId === entry.id}
                        className="mt-3 rounded border border-amber-400 bg-white px-4 py-2 font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                      >
                        {reloadingId === entry.id
                          ? "Reloading..."
                          : "Reload This Idea"}
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-4 border-t pt-4">
                    <div>
                      <p className="text-xs text-slate-500">
                        Created {new Date(entry.created_at).toLocaleString()}
                      </p>

                      {entry.updated_by_name && entry.updated_at && (
                        <p className="mt-1 text-xs text-slate-400">
                          Last saved by {entry.updated_by_name} at{" "}
                          {new Date(entry.updated_at).toLocaleString()}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => deleteEntry(entry)}
                        disabled={deletingId === entry.id}
                        className="rounded border border-red-300 px-4 py-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        {deletingId === entry.id ? "Deleting..." : "Delete"}
                      </button>

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

        {!entryId && totalPages > 1 && (
          <div className="mt-8 flex items-center justify-between">
            <Link
              href={`/scratchpad/manage?page=${currentPage - 1}`}
              aria-disabled={currentPage <= 1}
              className={`rounded border bg-white px-4 py-2 text-sm font-semibold ${
                currentPage <= 1
                  ? "pointer-events-none opacity-40"
                  : "hover:bg-slate-50"
              }`}
            >
              ← Previous
            </Link>

            <p className="text-sm text-slate-600">
              Page {currentPage} of {totalPages}
            </p>

            <Link
              href={`/scratchpad/manage?page=${currentPage + 1}`}
              aria-disabled={currentPage >= totalPages}
              className={`rounded border bg-white px-4 py-2 text-sm font-semibold ${
                currentPage >= totalPages
                  ? "pointer-events-none opacity-40"
                  : "hover:bg-slate-50"
              }`}
            >
              Next →
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

export default function ManageScratchpadPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-100 p-8">
          <div className="mx-auto max-w-4xl rounded bg-white p-8 shadow">
            <p className="text-slate-700">Loading ideas...</p>
          </div>
        </main>
      }
    >
      <ManageScratchpadContent />
    </Suspense>
  );
}