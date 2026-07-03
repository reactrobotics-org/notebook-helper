"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type TeamOption = {
  id: string;
  team_number: string;
  team_name: string | null;
};

type Props = {
  teams: TeamOption[];
  activeTeamId: string | null;
  allowAllTeams?: boolean;
};

export default function TeamSwitcher({
  teams,
  activeTeamId,
  allowAllTeams = false,
}: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState("");

  async function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const rawValue = event.target.value;
    const newTeamId = rawValue === "" ? null : rawValue;

    setSwitching(true);
    setError("");

    const { error: rpcError } = await supabase.rpc("switch_active_team", {
      new_team_id: newTeamId,
    });

    setSwitching(false);

    if (rpcError) {
      console.error("Error switching team:", rpcError);
      setError("Could not switch teams.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="text-right">
      <select
        value={activeTeamId ?? ""}
        onChange={handleChange}
        disabled={switching}
        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm font-medium text-[#1C1F23] disabled:opacity-50"
      >
        {allowAllTeams && <option value="">All Teams</option>}

        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.team_number}
            {team.team_name ? ` - ${team.team_name}` : ""}
          </option>
        ))}
      </select>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}