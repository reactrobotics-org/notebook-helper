"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  Users,
  MessageSquare,
} from "lucide-react";

const links = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
   {
    href: "/admin/users",
    label: "Users",
    icon: Users,
  },
  {
    href: "/admin/teams",
    label: "Teams",
    icon: ClipboardList,
  },
  {
    href: "/admin/activity",
    label: "Activity",
    icon: BarChart3,
  },
  {
  href: "/admin/feedback",
  label: "Feedback",
  icon: MessageSquare,
  },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-3">
      {links.map((link) => {
        const Icon = link.icon;

        const isActive =
          link.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              isActive
                ? "inline-flex items-center gap-2 rounded-xl bg-[#1C1F23] px-4 py-2 font-semibold text-white shadow-sm transition"
                : "inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-[#1C1F23] shadow-sm transition hover:bg-[#E8F6FF]"
            }
          >
            <Icon size={18} />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}