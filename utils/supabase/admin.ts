import { createClient } from "@supabase/supabase-js";

// Service-role client for privileged server-only operations (e.g. creating
// student accounts that have no real email address). This bypasses Row
// Level Security entirely.
//
// NEVER import this into a Client Component, and never let
// SUPABASE_SERVICE_ROLE_KEY reach the browser — it grants full admin
// access to the database.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
