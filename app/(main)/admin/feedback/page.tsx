import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/utils/supabase/server";

type Feedback = {
  id: string;
  created_at: string;
  name: string | null;
  email: string | null;
  type: "issue" | "idea";
  title: string;
  description: string;
  page: string | null;
  status: string;
};

type FeedbackComment = {
  id: string;
  feedback_id: string;
  author_name: string | null;
  comment: string;
  created_at: string;
};

const STATUS_OPTIONS = ["New", "In Progress", "Closed"];

function normalizeStatusForDisplay(status: string) {
  const match = STATUS_OPTIONS.find(
    (option) => option.toLowerCase() === status.toLowerCase()
  );
  return match ?? STATUS_OPTIONS[0];
}

async function updateFeedbackStatus(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!id || !status) return;

  const { data } = await supabase
    .from("feedback")
    .update({ status })
    .eq("id", id)
    .select();

  if (!data || data.length === 0) {
    redirect("/admin/feedback?error=update_failed");
  }

  revalidatePath("/admin/feedback");
}

async function addFeedbackComment(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const feedbackId = String(formData.get("feedback_id") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  const closeAfter = formData.get("close_after") === "true";

  if (!feedbackId || !comment) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  await supabase.from("feedback_comments").insert({
    feedback_id: feedbackId,
    author_id: user.id,
    author_name: profile?.full_name || profile?.email || "Admin",
    comment,
  });

  if (closeAfter) {
    const { data } = await supabase
      .from("feedback")
      .update({ status: "Closed" })
      .eq("id", feedbackId)
      .select();

    if (!data || data.length === 0) {
      redirect("/admin/feedback?error=close_failed");
    }
  }

  revalidatePath("/admin/feedback");
}

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    type?: string;
    error?: string;
  }>;
}) {
  const supabase = await createClient();
  const params = await searchParams;

  const q = params.q?.trim() ?? "";
  const statusFilter = params.status ?? "all";
  const typeFilter = params.type ?? "all";

  let query = supabase
    .from("feedback")
    .select("id, created_at, name, email, type, title, description, page, status")
    .order("created_at", { ascending: false });

  if (statusFilter === "open") {
    query = query.neq("status", "Closed");
  } else if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  if (typeFilter !== "all") {
    query = query.eq("type", typeFilter);
  }

  if (q) {
    query = query.or(
      `title.ilike.%${q}%,description.ilike.%${q}%,name.ilike.%${q}%,email.ilike.%${q}%`
    );
  }

  const { data: feedback } = await query;

  const feedbackList = (feedback ?? []) as Feedback[];

  const feedbackIds = feedbackList.map((item) => item.id);

  const { data: comments } = feedbackIds.length
    ? await supabase
        .from("feedback_comments")
        .select("id, feedback_id, author_name, comment, created_at")
        .in("feedback_id", feedbackIds)
        .order("created_at", { ascending: true })
    : { data: [] as FeedbackComment[] };

  const commentsByFeedback = new Map<string, FeedbackComment[]>();
  (comments ?? []).forEach((comment) => {
    const list = commentsByFeedback.get(comment.feedback_id) ?? [];
    list.push(comment as FeedbackComment);
    commentsByFeedback.set(comment.feedback_id, list);
  });

  return (
    <>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-[#1C1F23]">Feedback</h2>
        <p className="mt-2 text-slate-600">
          Review issues and ideas submitted by users.
        </p>
      </div>

      {params.error === "update_failed" && (
        <div className="mb-6 flex items-center gap-3 rounded-xl bg-amber-50 p-4 text-amber-900">
          <AlertTriangle size={20} className="shrink-0" />
          <p>
            The status wasn&apos;t updated. This usually means a Supabase Row
            Level Security policy is blocking the update — check the UPDATE
            policy on feedback covers Admins for rows they didn&apos;t
            create.
          </p>
        </div>
      )}

      {params.error === "close_failed" && (
        <div className="mb-6 flex items-center gap-3 rounded-xl bg-amber-50 p-4 text-amber-900">
          <AlertTriangle size={20} className="shrink-0" />
          <p>
            Your comment was saved, but the feedback wasn&apos;t closed. This
            usually means a Supabase Row Level Security policy is blocking
            the update — check the UPDATE policy on feedback covers Admins
            for rows they didn&apos;t create.
          </p>
        </div>
      )}

      <div className="mb-4 flex gap-2">
        {[
          { label: "Open", value: "open" },
          { label: "Closed", value: "Closed" },
          { label: "All", value: "all" },
        ].map((tab) => {
          const isActive = statusFilter === tab.value;

          const tabParams = new URLSearchParams();
          if (q) tabParams.set("q", q);
          if (typeFilter !== "all") tabParams.set("type", typeFilter);
          if (tab.value !== "all") tabParams.set("status", tab.value);

          const href = tabParams.toString()
            ? `/admin/feedback?${tabParams.toString()}`
            : "/admin/feedback";

          return (
            <Link
              key={tab.value}
              href={href}
              className={
                isActive
                  ? "rounded-lg bg-[#1C1F23] px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-[#1C1F23] hover:bg-slate-50"
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <form className="mb-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_auto_auto_auto]">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search title, description, or user..."
          className="rounded-lg border border-slate-300 px-3 py-2"
        />

        <select
          name="type"
          defaultValue={typeFilter}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2"
        >
          <option value="all">All Types</option>
          <option value="issue">Issue</option>
          <option value="idea">Idea</option>
        </select>

        <select
          name="status"
          defaultValue={statusFilter}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2"
        >
          <option value="all">All Statuses</option>
          <option value="open">Open (Not Closed)</option>
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <button
          type="submit"
          className="rounded-lg bg-[#1C1F23] px-5 py-2 font-semibold text-white hover:bg-black"
        >
          Filter
        </button>
      </form>

      <div className="space-y-4">
        {feedbackList.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
            No feedback matches your filters.
          </div>
        ) : (
          feedbackList.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="mb-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-600">
                    {item.type === "issue" ? "Issue" : "Idea"}
                  </div>

                  <h3 className="text-xl font-bold text-[#1C1F23]">
                    {item.title}
                  </h3>
                </div>

                <form action={updateFeedbackStatus} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={item.id} />
                  <select
                    name="status"
                    defaultValue={normalizeStatusForDisplay(item.status)}
                    className="rounded-full border border-slate-300 bg-[#E8F6FF] px-3 py-1 text-sm font-semibold text-[#1C1F23]"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-semibold text-[#1C1F23] hover:bg-slate-50"
                  >
                    Save
                  </button>
                </form>
              </div>

              <p className="whitespace-pre-wrap text-slate-700">
                {item.description}
              </p>

              <div className="mt-4 border-t pt-4 text-sm text-slate-500">
                <p>
                  Submitted by {item.name || item.email || "Unknown user"}
                </p>
                {item.page && <p>Page: {item.page}</p>}
                <p>{new Date(item.created_at).toLocaleString()}</p>
              </div>

              <div className="mt-4 border-t pt-4">
                <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Comments ({(commentsByFeedback.get(item.id) ?? []).length})
                </p>

                {(commentsByFeedback.get(item.id) ?? []).length > 0 && (
                  <ul className="mb-3 space-y-2">
                    {(commentsByFeedback.get(item.id) ?? []).map((comment) => (
                      <li
                        key={comment.id}
                        className="rounded-lg bg-slate-50 px-4 py-2 text-sm text-slate-700"
                      >
                        <p>{comment.comment}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {comment.author_name || "Admin"} ·{" "}
                          {new Date(comment.created_at).toLocaleString()}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}

                <form action={addFeedbackComment} className="space-y-2">
                  <input type="hidden" name="feedback_id" value={item.id} />
                  <textarea
                    name="comment"
                    required
                    placeholder="Add a comment..."
                    className="h-20 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      name="close_after"
                      value="false"
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-[#1C1F23] hover:bg-slate-50"
                    >
                      Add Comment
                    </button>
                    <button
                      type="submit"
                      name="close_after"
                      value="true"
                      className="rounded-lg bg-[#1C1F23] px-3 py-1.5 text-sm font-semibold text-white hover:bg-black"
                    >
                      Comment & Close
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}