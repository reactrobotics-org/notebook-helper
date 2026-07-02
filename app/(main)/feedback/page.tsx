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

export default async function AdminFeedbackPage() {
  const supabase = await createClient();

  const { data: feedback } = await supabase
    .from("feedback")
    .select("id, created_at, name, email, type, title, description, page, status")
    .order("created_at", { ascending: false });

  const feedbackList = (feedback ?? []) as Feedback[];

  return (
    <>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-[#1C1F23]">Feedback</h2>
        <p className="mt-2 text-slate-600">
          Review issues and ideas submitted by users.
        </p>
      </div>

      <div className="space-y-4">
        {feedbackList.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
            No feedback has been submitted yet.
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

                <div className="rounded-full bg-[#E8F6FF] px-3 py-1 text-sm font-semibold text-[#1C1F23]">
                  {item.status}
                </div>
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
            </div>
          ))
        )}
      </div>
    </>
  );
}