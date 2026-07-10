"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type Props = {
  className?: string;
};

export default function SignOutButton({ className }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={signingOut}
      className={
        className ??
        "text-sm font-semibold text-red-600 hover:underline disabled:opacity-50"
      }
    >
      {signingOut ? "Signing out..." : "Sign Out"}
    </button>
  );
}