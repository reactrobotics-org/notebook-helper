"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle, Lightbulb, X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

type FeedbackType = "issue" | "idea";

export default function FeedbackButton() {
  const supabase = createClient();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setIsSignedIn(!!user);
    }

    checkUser();
  }, [supabase]);

  function resetForm() {
    setType(null);
    setTitle("");
    setDescription("");
    setError("");
    setSending(false);
  }

  function closePanel() {
    resetForm();
    setOpen(false);
  }

  async function submitFeedback() {
    if (!type || !title.trim() || !description.trim()) return;

    setSending(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("You must be signed in to submit feedback.");
      setSending(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email, team_id")
      .eq("id", user.id)
      .single();

    const { error } = await supabase.from("feedback").insert({
      user_id: user.id,
      name: profile?.full_name ?? user.email ?? null,
      email: profile?.email ?? user.email ?? null,
      team_id: profile?.team_id ?? null,
      type,
      title: title.trim(),
      description: description.trim(),
      page: pathname,
      browser: navigator.userAgent,
    });

    if (error) {
      setError("Unable to submit feedback. Please try again.");
      setSending(false);
      return;
    }

    closePanel();
  }

  if (!isSignedIn) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-[#1C1F23] px-4 py-2 text-sm font-semibold text-white transition hover:bg-black"
      >
        Feedback
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[360px] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-[#1C1F23]">Feedback</h2>

            <button
              type="button"
              onClick={closePanel}
              className="rounded-lg p-1 hover:bg-slate-100"
            >
              <X size={18} />
            </button>
          </div>

          {!type ? (
            <>
              <p className="mb-4 text-sm font-semibold text-slate-700">
                What would you like to share?
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setType("issue")}
                  className="rounded-xl border border-slate-300 p-5 text-center hover:bg-slate-50"
                >
                  <AlertTriangle className="mx-auto mb-2 text-red-500" />
                  <div className="font-bold">Issue</div>
                  <div className="text-sm text-slate-500">
                    Something is not working
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setType("idea")}
                  className="rounded-xl border border-slate-300 p-5 text-center hover:bg-slate-50"
                >
                  <Lightbulb className="mx-auto mb-2 text-orange-500" />
                  <div className="font-bold">Idea</div>
                  <div className="text-sm text-slate-500">
                    Improve the app
                  </div>
                </button>
              </div>
            </>
          ) : (
            <>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={type === "issue" ? "Brief issue title" : "Brief idea title"}
                className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2"
              />

              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={
                  type === "issue"
                    ? "Describe what is not working..."
                    : "Describe your idea..."
                }
                className="h-32 w-full resize-none rounded-lg border border-slate-300 px-3 py-2"
              />

              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setType(null);
                    setError("");
                  }}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                >
                  Back
                </button>

                <button
                  type="button"
                  onClick={submitFeedback}
                  disabled={sending || !title.trim() || !description.trim()}
                  className="rounded-lg bg-[#8ED4FF] px-4 py-2 text-sm font-semibold text-[#1C1F23] hover:bg-[#6CC7FF] disabled:opacity-50"
                >
                  {sending ? "Sending..." : "Submit"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}