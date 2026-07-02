import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import AdminNav from "@/components/AdminNav";
import FeedbackButton from "@/components/FeedbackButton";

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if ((profile?.role ?? "").toLowerCase() !== "admin") {
    redirect("/dashboard");
  }
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <main className="min-h-screen bg-[#F5F7FA]">
      <div className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-8 py-6">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#1C1F23] px-4 py-2 text-sm font-semibold text-white">
                <ShieldCheck size={18} />
                Admin Only
              </div>

              <h1 className="text-4xl font-bold text-[#1C1F23]">
                Admin Center
              </h1>

              <p className="mt-1 text-slate-600">
                Manage users, teams, and access.
              </p>
            </div>

            <Link
              href="/dashboard"
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-[#1C1F23] shadow-sm transition hover:bg-slate-50"
            >
              Back to Dashboard
            </Link>
          </div>

          <AdminNav />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-8 py-8">{children}</div>
      <FeedbackButton />
    </main>
  );
}