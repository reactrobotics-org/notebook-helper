# Notebook Helper

Progress-tracking application for robotics teams. **This is not an engineering
notebook** — it's a place for students to upload progress photos, describe
them, log meeting notes, and share everything with their team.

## Tech Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4
- Supabase (Auth, Postgres, Storage)
- OpenAI (`gpt-5.5`) for writing assistance in meeting notes
- TipTap for rich text editing
- Deployed on Vercel, source on GitHub
- Developed in VS Code on Windows

## Roles

Stored in `profiles.role` as `"Student" | "Mentor" | "Admin"` (role checks in
code lowercase this before comparing, so casing in the DB doesn't need to be
perfectly consistent).

- **Student** — uploads images, writes meeting notes, views their team.
- **Mentor** — same as Student, plus can be assigned to one or more teams
  and switch between them. Mentors can edit any meeting note belonging to a
  team they're on.
- **Admin** — full access to `/admin/*`: user management, team management
  (including assigning mentors — Admins can also be assigned as mentors),
  and a cross-team activity log. Admins are gated at `app/(main)/admin/layout.tsx`.

## Database Schema

No migrations are checked into the repo — schema lives in the Supabase
dashboard. As currently built:

- **profiles** — `id` (= `auth.users.id`), `email`, `full_name`, `role`,
  `team_id` (the user's _active_ team — see Mentors note below), `created_at`
- **teams** — `id`, `team_number`, `team_name`, `created_at`
- **team_mentors** — join table for many-to-many mentor↔team assignment.
  `team_id`, `mentor_id`, `created_at`, unique on `(team_id, mentor_id)`.
  A mentor's `profiles.team_id` is just whichever assigned team is currently
  "active" for their dashboard/images/notes view — switchable via the
  `switch_active_team(new_team_id)` Postgres function, exposed in the nav
  for any mentor assigned to more than one team.
- **image_entries** — `id`, `team_id`, `created_by`, `title`, `description`,
  `image_url`, `category`, `subsystem`, `created_at`
- **meeting_notes** — `id`, `team_id`, `created_by`, `title`, `meeting_date`,
  `attendees`, `worked_on` (HTML from the rich text editor), `action_items`
  (HTML), `created_at`, `updated_by_name`, `updated_at` (who/when it was
  last saved — any team member can edit any note for their team, so this is
  a plain text snapshot of the saver's name at save time, not a live FK)

### RLS notes

Several tables required an explicit **Admin-can-read-everything** SELECT
policy in addition to the normal "own team only" policy — without it, data
that exists in the DB is invisible to Admins in the app (this bit us more
than once during development: a row can insert successfully and still not
show up anywhere due to RLS). If a new admin-facing list ever comes up empty
despite data existing, check RLS before assuming the code is broken.

## Key Routes

- `/login`, `/auth/callback` — Google OAuth via Supabase
- `/dashboard` — team stats + quick actions
- `/images`, `/images/new`, `/images/manage`
- `/meeting-notes`, `/meeting-notes/new`, `/meeting-notes/manage` (accepts
  `?id=<note id>` to edit a single note; without it, shows the full team list)
- `/teams` — the signed-in user's team, teammates, and recent activity
- `/admin`, `/admin/users`, `/admin/teams`, `/admin/activity` — all gated to
  Admins by the shared `admin/layout.tsx`
- `POST /api/ai` — OpenAI-backed "Improve Writing" / "Suggest Details"
  actions used inside the meeting notes rich text editor; requires an
  authenticated session

## Known Gaps / Things to Revisit

- No `middleware.ts` — session refresh is handled per-page rather than
  centrally. Works, just not the typical Supabase SSR pattern.
- `worked_on` and `action_items` render via `dangerouslySetInnerHTML` with no
  sanitization. Content only ever comes from the app's own TipTap editor
  today, so this is low-risk in practice, but worth knowing if that ever
  changes.
- `/admin/activity` caps at the 40 most recent entries with no pagination —
  fine for now, would need work at higher volume.
- Two people editing the same meeting note at the same time will silently
  overwrite each other — last save wins, no conflict warning.
- The dashboard's "Action Items" stat is a hardcoded placeholder — no task
  tracking feature exists yet.

## Recent Work

- Team Management (`/admin/teams`): create/rename/delete teams, assign or
  remove mentors (including Admins), with support for a mentor being on
  multiple teams simultaneously.
- Mentor team switcher in the main nav for anyone assigned to 2+ teams.
- `/admin/activity`: a combined, filterable feed of the most recent images
  and meeting notes across every team, meant as a quick sanity check that
  student submissions are actually reaching the database.
- Meeting notes are now collaboratively editable by any team member, track
  who last saved them and when, and can be edited one at a time via
  `/meeting-notes/manage?id=...` instead of only as a full list.
- `/api/ai` now requires authentication (previously callable anonymously).
