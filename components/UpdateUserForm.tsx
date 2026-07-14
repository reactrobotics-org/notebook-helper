"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Role = "Student" | "Mentor" | "Admin";

type Team = {
  id: string;
  team_number: string;
  team_name: string | null;
};

type Props = {
  userId: string;
  currentRole: Role;
  currentTeamId: string | null;
  teams: Team[];
  roles: Role[];
  updateUserAction: (
    formData: FormData
  ) => Promise<{ success: boolean; message: string }>;
};

export default function UpdateUserForm({
  userId,
  currentRole,
  currentTeamId,
  teams,
  roles,
  updateUserAction,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [role, setRole] = useState<Role>(currentRole);
  const [teamId, setTeamId] = useState(currentTeamId ?? "none");
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData();
    formData.set("user_id", userId);
    formData.set("role", role);
    formData.set("team_id", teamId);

    setResult(null);

    startTransition(async () => {
      const outcome = await updateUserAction(formData);
      setResult(outcome);

      if (outcome.success) {
        router.refresh();
      }
    });
  }

  return (
    <div>
      <form
        onSubmit={handleSubmit}
        className="grid gap-3 lg:grid-cols-[160px_260px_auto]"
      >
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as Role)}
          className="rounded-lg border border-slate-300 bg-white p-2"
        >
          {roles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        <select
          value={teamId}
          onChange={(event) => setTeamId(event.target.value)}
          className="rounded-lg border border-slate-300 bg-white p-2"
        >
          <option value="none">No Team</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.team_number}
              {team.team_name ? ` - ${team.team_name}` : ""}
            </option>
          ))}
        </select>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-[#1C1F23] px-4 py-2 font-semibold text-white hover:bg-black disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </form>

      {result && (
        <p
          className={`mt-2 text-sm ${
            result.success ? "text-green-700" : "text-red-600"
          }`}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}