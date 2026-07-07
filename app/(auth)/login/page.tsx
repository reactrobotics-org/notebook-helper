"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(() =>
    searchParams.get("error") === "expired_link"
      ? "That sign-in link has expired or already been used. Request a new one below."
      : ""
  );
  const [sending, setSending] = useState(false);

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback`,
      },
    });
  }

  async function sendMagicLink() {
    if (!email.trim()) return;

    setSending(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Check your email for a sign-in link sent from Supabase Auth.");
    }

    setSending(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <h1 className="text-3xl font-bold text-slate-800">
          REACT Notebook Helper
        </h1>

        <p className="mt-2 text-slate-600">
          Sign in to document your team's progress.
        </p>

        <button
          onClick={signInWithGoogle}
          className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-3 font-semibold text-white hover:bg-slate-700"
        >
          Sign in with Google
        </button>

        <div className="my-6 flex items-center">
          <div className="h-px flex-1 bg-slate-300" />
          <span className="mx-3 text-sm text-slate-500">or</span>
          <div className="h-px flex-1 bg-slate-300" />
        </div>

        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Enter your email"
          className="w-full rounded-lg border border-slate-300 px-4 py-3"
        />

        <button
          onClick={sendMagicLink}
          disabled={sending}
          className="mt-4 w-full rounded-lg bg-[#8ED4FF] px-4 py-3 font-semibold text-[#1C1F23] hover:bg-[#6CC7FF] disabled:opacity-50"
        >
          {sending ? "Sending..." : "Email Me a Sign-In Link"}
        </button>

        {message && (
          <p className="mt-4 text-center text-sm text-slate-600">{message}</p>
        )}
      </div>
    </main>
  );
}