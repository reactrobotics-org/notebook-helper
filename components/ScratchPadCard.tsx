"use client";

import Link from "next/link";
import { useState } from "react";

type Props = {
  entry: {
    id: string;
    title: string | null;
    content: string | null;
    created_at: string;
  };
  submittedBy: string;
};

function getPreviewText(html: string, maxLength = 140) {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return "(image only, click to view)";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}…`;
}

export default function ScratchpadCard({ entry, submittedBy }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-3 flex items-start justify-between gap-4">
        <h2 className="text-xl font-semibold">
          {entry.title || "Untitled Idea"}
        </h2>

        <Link
          href={`/scratchpad/manage?id=${entry.id}`}
          onClick={(event) => event.stopPropagation()}
          className="shrink-0 rounded border px-3 py-2 text-sm hover:bg-slate-100"
        >
          Edit
        </Link>
      </div>

      {entry.content && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="w-full text-left"
        >
          {expanded ? (
            <div
              className="text-sm text-slate-700 [&_p]:mb-2 [&_a]:text-blue-600 [&_a]:underline [&_img]:my-2 [&_img]:max-w-full [&_img]:rounded [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5"
              dangerouslySetInnerHTML={{ __html: entry.content }}
            />
          ) : (
            <p className="truncate text-sm text-slate-600">
              {getPreviewText(entry.content)}
            </p>
          )}

          <span className="mt-2 inline-block text-xs font-semibold text-blue-600">
            {expanded ? "Show less ↑" : "Click to view more ↓"}
          </span>
        </button>
      )}

      <div className="mt-4 border-t pt-3 text-xs text-slate-500">
        <p>Submitted by: {submittedBy}</p>
        <p>{new Date(entry.created_at).toLocaleString()}</p>
      </div>
    </div>
  );
}