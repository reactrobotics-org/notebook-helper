import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  ImageIcon,
  NotebookTabs,
  Users,
} from "lucide-react";
import { createClient } from "@/utils/supabase/server";

export default async function AdminPage() {
  const supabase = await createClient();

  const [usersResult, teamsResult, imagesResult, notesResult] =
    await Promise.all([
      supabase.from("profiles").select("id", {
        count: "exact",
        head: true,
      }),

      supabase.from("teams").select("id", {
        count: "exact",
        head: true,
      }),

      supabase.from("image_entries").select("id", {
        count: "exact",
        head: true,
      }),

      supabase.from("meeting_notes").select("id", {
        count: "exact",
        head: true,
      }),
    ]);

  const cards = [
    {
      label: "Total Users",
      value: usersResult.count ?? 0,
      icon: Users,
    },
    {
      label: "Total Teams",
      value: teamsResult.count ?? 0,
      icon: ClipboardList,
    },
    {
      label: "Total Images",
      value: imagesResult.count ?? 0,
      icon: ImageIcon,
    },
    {
      label: "Meeting Notes",
      value: notesResult.count ?? 0,
      icon: NotebookTabs,
    },
  ];

  return (
    <>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-[#1C1F23]">
          Admin Dashboard
        </h2>
        <p className="mt-2 text-slate-600">
          Quick overview of your notebook system.
        </p>
      </div>

      <div className="mb-8 grid gap-6 md:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <div key={card.label} className="rounded-2xl bg-white p-6 shadow">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#E8F6FF] text-[#1C1F23]">
                <Icon size={22} />
              </div>

              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {card.label}
              </p>

              <p className="mt-2 text-4xl font-bold text-[#1C1F23]">
                {card.value}
              </p>
            </div>
          );
        })}
      </div>

      <section className="grid gap-6 md:grid-cols-2">
        <Link
          href="/admin/users"
          className="group rounded-2xl bg-white p-6 shadow transition hover:-translate-y-1 hover:shadow-lg"
        >
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-[#8ED4FF] text-[#1C1F23]">
            <Users size={28} />
          </div>

          <h2 className="text-2xl font-bold text-[#1C1F23]">
            User Management
          </h2>

          <p className="mt-2 text-slate-600">
            Assign users to teams, promote mentors, and manage permissions.
          </p>

          <div className="mt-5 inline-flex items-center gap-2 font-semibold text-[#1C1F23]">
            Open User Management
            <ArrowRight size={18} className="transition group-hover:translate-x-1" />
          </div>
        </Link>

        <Link
          href="/admin/teams"
          className="group rounded-2xl bg-white p-6 shadow transition hover:-translate-y-1 hover:shadow-lg"
        >
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-[#8ED4FF] text-[#1C1F23]">
            <ClipboardList size={28} />
          </div>

          <h2 className="text-2xl font-bold text-[#1C1F23]">
            Team Management
          </h2>

          <p className="mt-2 text-slate-600">
            Create, edit, delete, and organize robotics teams.
          </p>

          <div className="mt-5 inline-flex items-center gap-2 font-semibold text-[#1C1F23]">
            Open Team Management
            <ArrowRight size={18} className="transition group-hover:translate-x-1" />
          </div>
        </Link>
      </section>
    </>
  );
}