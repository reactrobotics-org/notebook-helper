"use client";

import { useState } from "react";

type Props = {
  userId: string;
  displayName: string;
  resetPasswordAction: (formData: FormData) => Promise<void>;
};

export default function ResetStudentPassword({
  userId,
  displayName,
  resetPasswordAction,
}: Props) {
  const [showReset, setShowReset] = useState(false);

  if (!showReset) {
    return (
      <button
        type="button"
        onClick={() => setShowReset(true)}
        className="mt-2 text-sm font-semibold text-blue-600 hover:underline"
      >
        Reset password
      </button>
    );
  }

  return (
    <form
      action={resetPasswordAction}
      className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
    >
      <input type="hidden" name="user_id" value={userId} />

      <p className="mb-3 text-sm font-semibold text-slate-700">
        Reset password for {displayName}
      </p>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="password"
          name="password"
          required
          minLength={6}
          autoComplete="new-password"
          placeholder="New password"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm sm:max-w-xs"
        />

        <button
          type="submit"
          className="rounded-lg bg-[#1C1F23] px-4 py-2 text-sm font-semibold text-white hover:bg-black"
        >
          Set Password
        </button>

        <button
          type="button"
          onClick={() => setShowReset(false)}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          Cancel
        </button>
      </div>

      <p className="mt-2 text-xs text-slate-500">
        Password must include uppercase, lowercase, a number, and a special character.
      </p>
    </form>
  );
}