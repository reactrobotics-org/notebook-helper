"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import FeedbackButton from "@/components/FeedbackButton";
import TeamSwitcher from "@/components/TeamSwitcher";

type TeamOption = {
  id: string;
  team_number: string;
  team_name: string | null;
};

type Props = {
  isAdmin: boolean;
  displayName: string;
  teamNumber: string;
  switcherTeams: TeamOption[];
  activeTeamId: string | null;
  showTeamSwitcher: boolean;
};

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/images", label: "Images" },
  { href: "/meeting-notes", label: "Meeting Notes" },
  { href: "/teams", label: "Team" },
];

export default function MobileNav({
  isAdmin,
  displayName,
  teamNumber,
  switcherTeams,
  activeTeamId,
  showTeamSwitcher,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? "Close menu" : "Open menu"}
        className="rounded-lg p-2 text-[#1C1F23] hover:bg-slate-100"
      >
        {open ? <X size={26} /> : <Menu size={26} />}
      </button>

      {open && (
        <div className="fixed inset-x-0 top-20 z-40 max-h-[calc(100vh-5rem)] overflow-y-auto border-t border-slate-200 bg-white px-6 py-5 shadow-lg">
          <nav className="mb-5 flex flex-col gap-1 text-base font-medium">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-black transition hover:bg-[#EEF8FF]"
              >
                {link.label}
              </Link>
            ))}

            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="mt-2 rounded-lg bg-[#1C1F23] px-3 py-2 text-center text-white transition hover:bg-black"
              >
                Admin
              </Link>
            )}
          </nav>

          <div className="mb-4 border-t border-slate-200 pt-4 text-sm text-slate-600">
            <div>
              <strong>User:</strong> {displayName}
            </div>

            {showTeamSwitcher ? (
              <div className="mt-2 flex items-center gap-2">
                <strong>Team:</strong>
                <TeamSwitcher
                  teams={switcherTeams}
                  activeTeamId={activeTeamId}
                  allowAllTeams={isAdmin}
                />
              </div>
            ) : (
              <div className="mt-1">
                <strong>Team:</strong> {teamNumber}
              </div>
            )}
          </div>

          <div className="relative border-t border-slate-200 pt-4">
            <FeedbackButton />
          </div>
        </div>
      )}
    </div>
  );
}