"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDateOnly } from "@/utils/formatDate";

type Props = {
  note: {
    id: string;
    title: string;
    meeting_date: string;
    attendees: string | null;
    worked_on: string | null;
    action_items: string | null;
    created_at: string;
  };
  submittedBy: string;
};

export default function MeetingNoteCard({ note, submittedBy }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">{note.title}</h2>
          <p className="text-sm text-slate-500">
            Meeting Date: {formatDateOnly(note.meeting_date)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="rounded border px-3 py-2 text-sm hover:bg-slate-100"
          >
            {expanded ? "Hide Details" : "Show Details"}
          </button>

          <Link
            href={`/meeting-notes/manage?id=${note.id}`}
            className="rounded border px-3 py-2 text-sm hover:bg-slate-100"
          >
            Edit
          </Link>
        </div>
      </div>

      {expanded && (
        <>
          {note.attendees && (
            <div className="mb-3">
              <h3 className="font-medium">Attendees</h3>
              <p className="text-sm text-slate-700">{note.attendees}</p>
            </div>
          )}

          {note.worked_on && (
            <div className="mb-3">
              <h3 className="font-medium">What We Worked On</h3>
              <div
                className="mt-1 text-sm text-slate-700 [&_p]:mb-2 [&_a]:text-blue-600 [&_a]:underline [&_img]:my-2 [&_img]:max-w-full [&_img]:rounded [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5"
                dangerouslySetInnerHTML={{ __html: note.worked_on }}
              />
            </div>
          )}

          {note.action_items && (
            <div className="mb-3">
              <h3 className="font-medium">Action Items</h3>
              <div
                className="mt-1 text-sm text-slate-700 [&_p]:mb-2 [&_a]:text-blue-600 [&_a]:underline [&_img]:my-2 [&_img]:max-w-full [&_img]:rounded [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5"
                dangerouslySetInnerHTML={{ __html: note.action_items }}
              />
            </div>
          )}
        </>
      )}

      <div className="mt-4 border-t pt-3 text-xs text-slate-500">
        <p>Submitted by: {submittedBy}</p>
        <p>{new Date(note.created_at).toLocaleString()}</p>
      </div>
    </div>
  );
}