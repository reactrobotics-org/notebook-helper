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
  a cross-team activity log, feedback triage, and deleted-image recovery.
  Admins are gated at `app/(main)/admin/layout.tsx`. Unlike Mentors, Admins
  can switch to **any** team in the system (not just ones they personally
  mentor), and have an **"All Teams"** option in the header team switcher
  that aggregates Dashboard, Images, and Meeting Notes across every team at
  once instead of scoping to a single one.

## Database Schema

No migrations are checked into the repo — schema lives in the Supabase
dashboard. As currently built:

- **profiles** — `id` (= `auth.users.id`), `email`, `full_name`, `role`,
  `team_id` (the user's _active_ team — see Mentors note below), `created_at`,
  `last_ai_request_at` (used to rate-limit `/api/ai`, see below)
- **teams** — `id`, `team_number`, `team_name`, `created_at`
- **team_mentors** — join table for many-to-many mentor↔team assignment.
  `team_id`, `mentor_id`, `created_at`, unique on `(team_id, mentor_id)`.
  A mentor's `profiles.team_id` is just whichever assigned team is currently
  "active" for their dashboard/images/notes view — switchable via the
  `switch_active_team(new_team_id)` Postgres function, exposed in the nav
  for any mentor assigned to more than one team, and for any Admin (who can
  also pass `null` to select "All Teams" — confirm this function accepts a
  null `new_team_id` if you haven't already; it needs to for the All Teams
  option to work).
- **image_entries** — `id`, `team_id`, `created_by`, `title`, `description`,
  `image_url`, `category`, `subsystem`, `created_at`, `deleted_at`
  (nullable timestamp — soft-delete flag, see below)
- **meeting_notes** — `id`, `team_id`, `created_by`, `title`, `meeting_date`,
  `attendees`, `worked_on` (HTML from the rich text editor), `action_items`
  (HTML), `created_at`, `updated_by_name`, `updated_at` (who/when it was
  last saved — any team member can edit any note for their team, so this is
  a plain text snapshot of the saver's name at save time, not a live FK)
- **feedback** — `id`, `user_id`, `name`, `email`, `team_id`, `type`
  (`"issue" | "idea"`), `title`, `description`, `page`, `browser`, `status`
  (`"New" | "In Progress" | "Closed"`, defaults to `"New"`), `created_at`
- **feedback_comments** — `id`, `feedback_id` (FK to `feedback`,
  `on delete cascade`), `author_id`, `author_name`, `comment`, `created_at`.
  Admin-only, used for the comment thread on `/admin/feedback`.

### Image soft-delete

`image_entries.deleted_at` is `NULL` for active images, or a timestamp once
someone deletes it. A deleted image disappears from every normal view
(`/images`, Dashboard counts/recents, `/teams`, `/admin/activity`) via an
`.is("deleted_at", null)` filter on each of those queries, but the row and
its file in Storage both still exist. Students can delete their own images
but have **no restore capability** — recovery is Admin-only, via
`/admin/deleted-images`, which shows every deleted image across every team
with **Restore** (clears `deleted_at`) or **Delete Forever** (removes the row
_and_ the file from the `images` Storage bucket — genuinely permanent, no
further recovery). There is currently no automatic purge — soft-deleted
images accumulate in Storage until an Admin manually purges them. Meeting
notes do not have an equivalent soft-delete/trash system yet.

### RLS notes

Several tables required an explicit **Admin-can-read-everything** SELECT
policy in addition to the normal "own team only" policy — without it, data
that exists in the DB is invisible to Admins in the app (this bit us more
than once during development: a row can insert successfully and still not
show up anywhere due to RLS). If a new admin-facing list ever comes up empty
despite data existing, check RLS before assuming the code is broken.

**Important gotcha discovered this session:** Supabase's `.update()` and
`.delete()` calls do **not** return an error just because a Row Level
Security policy silently filtered out every row — they return
`error: null` with zero affected rows, which looks identical to "nothing
matched the WHERE clause" from the app's point of view. This caused two real
bugs: Admins couldn't restore or permanently delete other users' soft-deleted
images (there was no UPDATE/DELETE policy covering rows an Admin didn't
personally create), and it failed completely silently until we started
chaining `.select()` after every mutating call and explicitly checking
whether any rows came back. **Any new delete/update feature should follow
this pattern** — check the returned row count, don't just check for
`error`. `image_entries` now has explicit Admin-scoped UPDATE and DELETE
policies (in addition to the student-scoped "own rows only" UPDATE policy)
for exactly this reason; other tables with admin-side mutations should be
audited for the same gap if similar bugs show up.

## Key Routes

- `/login`, `/auth/callback` — Google OAuth + email magic link via Supabase.
  Note: `/auth/callback` currently redirects to `/dashboard` unconditionally,
  even if `exchangeCodeForSession` fails (e.g. an expired magic link) — see
  Known Gaps.
- `/dashboard` — team stats + quick actions. Recent Meeting Notes/Images are
  clickable, linking straight to `/meeting-notes/manage?id=...` or
  `/images#image-<id>` respectively. Supports Admin "All Teams" (aggregates
  across every team, and labels each recent item with its team).
- `/images`, `/images/new`, `/images/manage` — `/images` shows the team
  gallery (or all teams' images, for an Admin viewing "All Teams"); images
  you personally uploaded are clickable there and link straight to editing
  just that one entry via `/images/manage?id=<id>`. Uploads are compressed
  client-side before hitting Storage (see `utils/compressImage.ts`).
  `/images/manage` (no `id`) shows your full upload history for editing/
  deleting; it has **no restore UI** for students by design.
- `/meeting-notes`, `/meeting-notes/new`, `/meeting-notes/manage` (accepts
  `?id=<note id>` to edit a single note; without it, shows a paginated list,
  10 per page, with each note collapsed to its header until "Show Details"
  is clicked). The rich text editor supports inserting an existing team
  image or capturing a new photo directly from the device camera (via
  `ImagePicker.tsx`), and inserted images can be resized (S/M/L/Full) via a
  toolbar that appears when an image is selected.
- `/teams` — the signed-in user's team, teammates, and recent activity. Does
  **not** currently support the Admin "All Teams" view — an Admin with no
  team selected will see "You are not assigned to a team yet" here, unlike
  Dashboard/Images/Meeting Notes. See Known Gaps.
- `/feedback` (in-app) — floating "Feedback" button (in the header, next to
  User/Team) opens a small popup to submit an Issue or Idea; saves
  automatically with user, email, team, page, browser, and timestamp.
- `/admin`, `/admin/users`, `/admin/teams`, `/admin/activity`,
  `/admin/feedback`, `/admin/deleted-images` — all gated to Admins by the
  shared `admin/layout.tsx`.
  - `/admin/users` — paginated (20/page), search/role/team filtering now
    happens at the query level (not in-memory), so it scales. Note: the
    free-text search box matches name/email only, not team name (use the
    Team dropdown for that).
  - `/admin/feedback` — search, type/status filters, quick Open/Closed/All
    tabs, inline status changes, and a comment thread per item (with a
    "Comment & Close" shortcut).
  - `/admin/deleted-images` — see Image soft-delete above.
- `POST /api/ai` — OpenAI-backed "Improve Writing" / "Suggest Details"
  actions used inside the meeting notes rich text editor; requires an
  authenticated session, and now rate-limited per user (see below).

### AI rate limiting

`/api/ai` enforces a per-user cooldown (`AI_COOLDOWN_SECONDS`, currently set
to `67`) using `profiles.last_ai_request_at`, checked and updated in the
database rather than in-memory — necessary because Vercel can route
concurrent requests to different serverless instances, so an in-memory
counter wouldn't reliably catch rapid repeated clicks.

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
- **Destructive admin actions have no confirmation dialogs** except
  "Delete Forever" on `/admin/deleted-images` (which uses the new
  `ConfirmSubmitButton` component). Deleting a user, deleting a team, and
  removing a mentor from a team all fire immediately on click with no
  "are you sure?" step. `ConfirmSubmitButton` is a reusable pattern now —
  worth applying to those actions too.
- `/auth/callback` doesn't handle a failed `exchangeCodeForSession` (expired
  or reused magic link) — it redirects to `/dashboard` regardless, which then
  bounces to `/login` with zero explanation of what went wrong.
- `/teams` doesn't participate in the Admin "All Teams" pattern that
  Dashboard/Images/Meeting Notes now share — see Key Routes above.
- Meeting notes have no soft-delete/trash equivalent to what Images now has
  — a deleted meeting note (if that feature is ever added) would need the
  same `deleted_at` + Admin-recovery treatment.
- `/images/manage` and `/meeting-notes/manage` still fetch a user's entire
  personal history unpaginated. Not urgent at current volume, but the same
  root cause (and the same fix — query-level pagination) that `/meeting-notes`
  and `/admin/users` already got.
- No automatic Storage purge for permanently-unwanted soft-deleted images —
  "Delete Forever" on `/admin/deleted-images` is the only current cleanup
  path, and it's manual.
- Given the RLS silent-failure gotcha discovered this session (see RLS
  notes), other tables with admin-side or cross-user mutations should be
  spot-checked for the same missing-policy pattern before they're relied on.

## Recent Work

**This session — Feedback, Meeting Notes media, team scoping, image
lifecycle:**

- Built out the full Feedback system: submission popup in the header (next
  to User/Team), automatic capture of user/email/team/page/browser/status,
  and a complete `/admin/feedback` — search, type/status filters, quick
  Open/Closed/All tabs, inline status editing, and a comment thread with a
  "Comment & Close" action. Removed a duplicate, unguarded copy of the
  feedback list that had been accidentally exposed outside `/admin`, and
  removed a redundant second `FeedbackButton` render in `admin/layout.tsx`.
- Meeting Notes: the image-insert modal (`ImagePicker.tsx`) now supports
  taking a new photo directly from the device camera in addition to picking
  an existing team image — camera captures are uploaded and also added to
  the team's Images gallery. Inserted images can be resized via a
  toolbar (S/M/L/Full) that appears when an image is selected in the editor.
  `/meeting-notes` is now paginated (10/page) with each note collapsed by
  default.
- Mobile navigation: added a hamburger menu (`MobileNav.tsx`) for viewports
  below `md`; desktop layout is unchanged.
- Team-scoping fixes: `/images`, `/meeting-notes`, and the Dashboard now
  strictly follow the header's active-team selector for every role. Added an
  "All Teams" option to the switcher for Admins (aggregates instead of
  filtering), and fixed the switcher's team list for Admins to include every
  team in the system rather than only ones they personally mentor.
- Efficiency/reliability pass: fixed a real bug where the Dashboard queried
  a nonexistent `"images"` table instead of `"image_entries"` (Images count
  was always 0); added client-side image compression before upload
  (`utils/compressImage.ts`, downscales to 1600px max, re-encodes as JPEG);
  added per-user rate limiting to `/api/ai`; converted `/admin/users` from
  in-memory filtering over the full table to query-level search/filter with
  real pagination.
- Image lifecycle: added soft-delete for images (`image_entries.deleted_at`)
  with student-facing Delete (no restore) and a new Admin-only
  `/admin/deleted-images` for restoring or permanently purging deleted
  images (including their Storage files). Clicking your own image on
  `/images` now goes straight to editing that one entry
  (`/images/manage?id=...`) instead of the full manage list.

**Earlier:**

- Team Management (`/admin/teams`): create/rename/delete teams, assign or
  remove mentors (including Admins), with support for a mentor being on
  multiple teams simultaneously.
- Mentor team switcher in the main nav for anyone assigned to 2+ teams.
- `/admin/activity`: a combined, filterable feed of the most recent images
  and meeting notes across every team, meant as a quick sanity check that
  student submissions are actually reaching the database.
- Meeting notes are collaboratively editable by any team member, track
  who last saved them and when, and can be edited one at a time via
  `/meeting-notes/manage?id=...` instead of only as a full list.
- `/api/ai` requires authentication (previously callable anonymously).
