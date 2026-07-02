import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  ImageIcon,
  NotebookTabs,
  Users,
} from "lucide-react";
import { createClient } from "@/utils/supabase/server";

export default async function AdminPage() {
  const supabase = await createClient();

  const [usersResult, teamsResult, imagesResult, notesResult, unassignedResult] =
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
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .is("team_id", null),
    ]);

  const unassignedCount = unassignedResult.count ?? 0;

  const cards = [
    {
      label: "Users",
      value: usersResult.count ?? 0,
      icon: Users,
    },
    {
      label: "Teams",
      value: teamsResult.count ?? 0,
      icon: ClipboardList,
    },
    {
      label: "Images",
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
          Quick overview of users, teams, images, and meeting notes.
        </p>
      </div>

      {unassignedCount > 0 && (
        <Link
          href="/admin/users"
          className="mb-8 flex items-center justify-between gap-4 rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-sm transition hover:bg-amber-100"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-200 text-amber-900">
              <AlertTriangle size={20} />
            </div>

            <p className="font-semibold text-amber-900">
              {unassignedCount} user{unassignedCount === 1 ? "" : "s"} not yet
              assigned to a team
            </p>
          </div>

          <span className="inline-flex items-center gap-2 text-sm font-semibold text-amber-900">
            Open User Management
            <ArrowRight size={16} />
          </span>
        </Link>
      )}

      <div className="mb-8 grid gap-6 md:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.label}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E8F6FF] text-[#1C1F23]">
                  <Icon size={24} />
                </div>
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
        <AdminCard
          href="/admin/users"
          icon={<Users size={28} />}
          title="User Management"
          description="Assign users to teams, promote mentors, and manage admin access."
          action="Open User Management"
        />

        <AdminCard
          href="/admin/teams"
          icon={<ClipboardList size={28} />}
          title="Team Management"
          description="Create, edit, delete, and organize robotics teams."
          action="Open Team Management"
        />
      </section>
    </>
  );
}

function AdminCard({
  href,
  icon,
  title,
  description,
  action,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  action: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-[#8ED4FF] text-[#1C1F23]">
        {icon}
      </div>

      <h2 className="text-2xl font-bold text-[#1C1F23]">{title}</h2>

      <p className="mt-2 text-slate-600">{description}</p>

      <div className="mt-5 inline-flex items-center gap-2 font-semibold text-[#1C1F23]">
        {action}
        <ArrowRight
          size={18}
          className="transition group-hover:translate-x-1"
        />
      </div>
    </Link>
  );
}