import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export default async function MeetingNotesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: notes, error } = await supabase
    .from("meeting_notes")
    .select(
      `
      id,
      title,
      meeting_date,
      attendees,
      worked_on,
      action_items,
      created_at,
      profiles (
        full_name,
        email
      )
    `
    )
    .order("meeting_date", { ascending: false });

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Meeting Notes</h1>
            <p className="mt-1 text-sm text-slate-600">
              Record what happened at practice and what needs to happen next.
            </p>
          </div>

          <Link
            href="/meeting-notes/new"
            className="rounded bg-[#8ED4FF] text-[#1C1F23] px-4 py-2 text-white hover:bg-[#74C7FA]"
          >
            Add Meeting Note
          </Link>
        </div>

        {error && (
          <div className="rounded bg-red-100 p-4 text-red-700">
            Error loading meeting notes: {error.message}
          </div>
        )}

        {!error && (!notes || notes.length === 0) && (
          <div className="rounded bg-white p-8 text-center shadow">
            <p className="text-gray-600">No meeting notes have been added yet.</p>
          </div>
        )}

        <div className="space-y-6">
          {notes?.map((note) => {
          const profile = Array.isArray(note.profiles)
            ? note.profiles[0]
            : note.profiles;

          const submittedBy =
            profile?.full_name ?? profile?.email ?? "Unknown user";
          
            return (
              <div key={note.id} className="rounded-lg bg-white p-6 shadow">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold">{note.title}</h2>
                    <p className="text-sm text-slate-500">
                      Meeting Date:{" "}
                      {new Date(note.meeting_date).toLocaleDateString()}
                    </p>
                  </div>

                  <Link
                    href={`/meeting-notes/manage?id=${note.id}`}
                    className="rounded border px-3 py-2 text-sm hover:bg-slate-100"
                  >
                    Edit
                  </Link>
                </div>

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

                <div className="mt-4 border-t pt-3 text-xs text-slate-500">
                  <p>Submitted by: {submittedBy}</p>
                  <p>{new Date(note.created_at).toLocaleString()}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}