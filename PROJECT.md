# Notebook Helper

Progress-tracking application for robotics teams. **This is not an engineering
notebook** — it's a place for students to upload progress photos, describe
them, log meeting notes, jot down quick ideas, and share everything with
their team.

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

- **Student** — uploads images, writes meeting notes, jots down scratchpad
  ideas, views their team. Younger students without an email address can be
  given a username/password account instead of Google/magic-link (see
  Authentication below).
- **Mentor** — same as Student, plus can be assigned to one or more teams
  and switch between them. Mentors can edit any meeting note or scratchpad
  entry belonging to a team they're on.
- **Admin** — full access to `/admin/*`: user management (including creating
  username/password student accounts), team management (including assigning
  mentors — Admins can also be assigned as mentors), a cross-team activity
  log (now paginated), feedback triage, and deleted-image/deleted-meeting-note
  recovery. Admins are gated at `app/(main)/admin/layout.tsx`. Unlike
  Mentors, Admins can switch to **any** team in the system (not just ones
  they personally mentor), and have an **"All Teams"** option in the header
  team switcher that aggregates Dashboard, Images, Meeting Notes, Scratchpad,
  and `/teams` across every team at once instead of scoping to a single one.

## Authentication

Three ways to sign in, all via Supabase Auth:

- **Google OAuth** and **email magic link** — the original two methods, for
  anyone with a real email address. `/auth/callback` now correctly handles a
  failed `exchangeCodeForSession` (expired/reused link) by redirecting to
  `/login?error=expired_link` with a visible message, instead of silently
  bouncing to `/dashboard` and then `/login` with no explanation.
- **Username + password** — for younger students without an email address.
  Admins create these at `/admin/users/new`, picking a username, an initial
  password, a full name, and a team. Under the hood there's no real email:
  the account's actual Supabase Auth email is a synthetic
  `{username}@students.local` (always lowercased, so login is
  case-insensitive even though the *displayed* username preserves whatever
  case the Admin typed). Creating these accounts requires the Supabase
  **service-role key** (`SUPABASE_SERVICE_ROLE_KEY` env var, server-only,
  read by `utils/supabase/admin.ts`) since it calls
  `auth.admin.createUser()` directly — never expose this key to the browser.
  There's currently no self-service password reset for these accounts; an
  Admin has to reset one manually (no UI for that yet either — see Known
  Gaps).

Session refresh is centralized in `proxy.ts` (project root) — Next.js 16
renamed the `middleware.ts` file convention to `proxy.ts`; the exported
function is `proxy()` instead of `middleware()`, calling into
`utils/supabase/middleware.ts`'s `updateSession()`. This replaced the old
per-page session handling.

## Database Schema

No migrations are checked into the repo — schema lives in the Supabase
dashboard. As currently built:

- **profiles** — `id` (= `auth.users.id`), `email`, `full_name`, `role`,
  `team_id` (the user's _active_ team — see Mentors note below), `username`
  (nullable, unique — only set for username/password student accounts),
  `created_at`, `last_ai_request_at` (used to rate-limit `/api/ai`, see
  below)
- **teams** — `id`, `team_number`, `team_name`, `created_at`
- **team_mentors** — join table for many-to-many mentor↔team assignment.
  `team_id`, `mentor_id`, `created_at`, unique on `(team_id, mentor_id)`.
  A mentor's `profiles.team_id` is just whichever assigned team is currently
  "active" for their dashboard/images/notes view — switchable via the
  `switch_active_team(new_team_id)` Postgres function, exposed in the nav
  for any mentor assigned to more than one team, and for any Admin (who can
  also pass `null` to select "All Teams").
- **image_entries** — `id`, `team_id`, `created_by`, `title`, `description`,
  `image_url`, `category`, `subsystem`, `created_at`, `deleted_at`
  (nullable timestamp — soft-delete flag, see below)
- **meeting_notes** — `id`, `team_id`, `created_by`, `title`, `meeting_date`,
  `attendees`, `worked_on` (HTML from the rich text editor), `action_items`
  (HTML), `created_at`, `updated_by_name`, `updated_at` (who/when it was
  last saved — any team member can edit any note for their team), and now
  `deleted_at` (nullable timestamp — soft-delete, mirrors `image_entries`;
  Admins can restore or permanently delete via `/admin/deleted-meeting-notes`)
- **scratchpad_entries** — new this session. Quick, lightweight ideas —
  "not a complete meeting note." `id`, `team_id`, `created_by`, `title`
  (nullable — entries can be untitled), `content` (HTML from the rich text
  editor, supports inline images the same way meeting notes do), `created_at`,
  `updated_by_name`, `updated_at`, `deleted_at` (soft-delete; same
  "any team member can edit" model and conflict-detection as meeting notes,
  but **no dedicated admin recovery page exists yet** — restoring one today
  means a manual SQL update).
- **feedback** — `id`, `user_id`, `name`, `email`, `team_id`, `type`
  (`"issue" | "idea"`), `title`, `description`, `page`, `browser`, `status`.
  The actual Postgres column default for `status` on new rows is the
  **lowercase** string `"new"` — the app's own status-changing UI writes
  the capitalized `"New" | "In Progress" | "Closed"` instead, so don't
  assume status values are consistently cased when querying directly; the
  app normalizes for display and filters "Open" as "anything not exactly
  `Closed`" rather than an allowlist, specifically to route around this.
- **feedback_comments** — `id`, `feedback_id` (FK to `feedback`,
  `on delete cascade`), `author_id`, `author_name`, `comment`, `created_at`.
  Admin-only, used for the comment thread on `/admin/feedback`.

### Image & meeting note soft-delete

`image_entries.deleted_at` and `meeting_notes.deleted_at` are `NULL` for
active rows, or a timestamp once someone deletes it. A deleted row
disappears from every normal view via an `.is("deleted_at", null)` filter on
each relevant query, but the row (and, for images, its file in Storage)
still exists. Students/team members can soft-delete but not restore —
recovery is Admin-only:

- `/admin/deleted-images` — restore, or **Delete Forever** (removes the row
  _and_ the file from the `images` Storage bucket — genuinely permanent).
- `/admin/deleted-meeting-notes` — same restore/permanently-delete pattern
  (no Storage file to worry about, meeting notes don't have one).

There is currently no automatic purge for either — soft-deleted rows/files
accumulate until an Admin manually purges them. `scratchpad_entries` also
soft-deletes but has **no admin recovery page yet** (see Known Gaps).

### RLS notes

Several tables required an explicit **Admin-can-read-everything** SELECT
policy in addition to the normal "own team only" policy — without it, data
that exists in the DB is invisible to Admins in the app.

**Important gotcha (discovered building the image soft-delete feature,
since audited more broadly):** Supabase's `.update()` and `.delete()` calls
do **not** return an error just because a Row Level Security policy silently
filtered out every row — they return `error: null` with zero affected rows,
which looks identical to "nothing matched the WHERE clause" from the app's
point of view. **Any delete/update feature should check the returned row
count via `.select()` after the mutation, not just check for `error`.**

Tables now audited and fixed for this pattern: `image_entries`, `profiles`,
`teams`, `team_mentors`, `feedback`, `meeting_notes`. Each has explicit
Admin-scoped UPDATE/DELETE policies in addition to the normal user-scoped
ones. `scratchpad_entries` was built with the same Admin-bypass policies
from the start. If a new admin-facing mutation ever silently "does nothing,"
check RLS policies before assuming the app code is broken — this exact
symptom is why the Open/Closed feedback filter and several admin actions
needed fixing this session.

This same row-count check is also reused for a second purpose on
`meeting_notes` and `scratchpad_entries`: **optimistic-concurrency conflict
detection**. Saving includes the loaded `updated_at` in the `WHERE` clause;
if it doesn't match (because someone else saved first), the update affects
zero rows, and the app distinguishes "someone else's edit landed first" from
"an RLS policy blocked this" by re-reading the row afterward. When it's a
genuine conflict, the editor shows who saved and when, with a button to
reload the latest version (discarding local edits) rather than silently
overwriting.

## Key Routes

- `/login`, `/auth/callback` — Google OAuth, email magic link, and
  username/password (see Authentication above), all via Supabase. The login
  page includes a short "New here?" explanation of what the site is for,
  aimed at first-time users.
- `/dashboard` — team stats + quick actions. Recent Meeting Notes/Images are
  clickable, linking straight to `/meeting-notes/manage?id=...` or
  `/images#image-<id>` respectively. Supports Admin "All Teams" (aggregates
  across every team, and labels each recent item with its team).
- `/images`, `/images/new`, `/images/manage` — `/images` shows the team
  gallery (or all teams' images, for an Admin viewing "All Teams"); images
  you personally uploaded are clickable there and link straight to editing
  just that one entry via `/images/manage?id=<id>`. Uploads are compressed
  client-side before hitting Storage (see `utils/compressImage.ts`).
  `/images/manage` is now query-level paginated (10/page) instead of
  fetching a user's entire upload history at once, and (like the browse
  page) it now has a short subtitle explaining what the page is for.
- `/meeting-notes`, `/meeting-notes/new`, `/meeting-notes/manage` (accepts
  `?id=<note id>` to edit a single note; without it, shows a paginated list,
  10 per page). The rich text editor supports inserting an existing team
  image or capturing a new photo directly from the device camera (via
  `ImagePicker.tsx`), and inserted images can be resized (S/M/L/Full).
  `/meeting-notes/manage` is now query-level paginated instead of fetching
  everything at once, has a Delete button (soft-delete, restorable by an
  Admin), and shows a conflict warning if someone else saved the same note
  first (see RLS notes above).
- `/scratchpad`, `/scratchpad/new`, `/scratchpad/manage` — new this session.
  Quick ideas/thoughts to reference later, lighter-weight than a full
  meeting note. Mirrors the Meeting Notes structure closely: rich text with
  inline image insertion, any team member can view/edit, soft-delete,
  conflict detection on simultaneous edits, pagination, and Admin "All
  Teams" awareness on the browse page. The browse list
  (`components/ScratchPadCard.tsx` — note the capital P, that's the actual
  filename) shows only a truncated first-line preview of each entry;
  clicking it expands to the full rendered content inline.
- `/teams` — the signed-in user's team, teammates, and recent activity. Now
  supports the Admin "All Teams" view (shows every team with member counts,
  plus aggregated recent images/notes labeled by team) instead of showing
  "You are not assigned to a team yet."
- `/scoreboard` — new this session. Top 5 teams by Meeting Notes and Images
  submitted, both "last 10 days" and "all-time" (4 leaderboards total).
  Visible to every logged-in user, all teams shown regardless of role. Reads
  through the **service-role client** (`utils/supabase/admin.ts`), not the
  normal per-user client — this is intentional and necessary, since the
  normal RLS policies scope Students/Mentors to their own team, but the
  scoreboard needs accurate cross-team counts for everyone. It only ever
  selects `team_id`/`created_at`, never note/image content or authorship.
- `/settings` — new this session. Any logged-in user can update their own
  `full_name`. Also updates `user_metadata.full_name` via
  `supabase.auth.updateUser()` so Google-based sessions (which fall back to
  `user_metadata.full_name` in the header) stay in sync too.
- `/feedback` (in-app) — floating "Feedback" button (in the header, next to
  User/Team/Settings/Sign Out) opens a small popup to submit an Issue or
  Idea; saves automatically with user, email, team, page, browser, and
  timestamp.
- `/admin`, `/admin/users`, `/admin/users/new`, `/admin/teams`,
  `/admin/activity`, `/admin/feedback`, `/admin/deleted-images`,
  `/admin/deleted-meeting-notes` — all gated to Admins by the shared
  `admin/layout.tsx`.
  - `/admin/users` — paginated (20/page), search/role/team filtering at the
    query level. Delete user, remove-from-team, delete team, and
    remove-mentor actions all now have a confirmation dialog
    (`ConfirmSubmitButton.tsx`) before firing.
  - `/admin/users/new` — new this session. Create a username/password
    student account (see Authentication above).
  - `/admin/activity` — now properly paginated (20/page) instead of a hard
    40-entry cap with no way to see older activity. Combines two
    independently-sorted tables (`image_entries`, `meeting_notes`) into one
    correctly-paginated feed — see the comment in that file for the
    "top N from each side" technique used, since a single `.range()` call
    doesn't work across two separate tables.
  - `/admin/feedback` — search, type/status filters, quick Open/Closed/All
    tabs, inline status changes, and a comment thread per item. The "Open"
    filter is defined as "status is not exactly `Closed`" rather than an
    allowlist of `["New", "In Progress"]` — see the `feedback.status`
    column note above for why.
  - `/admin/deleted-images`, `/admin/deleted-meeting-notes` — see soft-delete
    section above.
- `POST /api/ai` — OpenAI-backed "Improve Writing" / "Suggest Details"
  actions used inside the meeting notes rich text editor; requires an
  authenticated session, rate-limited per user (see below).

### AI rate limiting

`/api/ai` enforces a per-user cooldown (`AI_COOLDOWN_SECONDS`, currently set
to `67`) using `profiles.last_ai_request_at`, checked and updated in the
database rather than in-memory — necessary because Vercel can route
concurrent requests to different serverless instances, so an in-memory
counter wouldn't reliably catch rapid repeated clicks.

## PWA (installable on iPad homescreen)

`app/manifest.ts` (Next.js's file-convention manifest, auto-linked in
`<head>`), `app/icon.png` (512×512) and `app/apple-icon.png` (180×180, both
auto-linked by Next.js too), plus `public/icons/icon-192.png` and
`icon-512.png` for the manifest itself. `app/layout.tsx` has an
`appleWebApp` metadata block (`capable`, `statusBarStyle`, `title`) and a
`viewport` export with `themeColor`. The current icon is a **placeholder**
(a generated monogram "R" on the app's dark background color) — swap it for
real branding whenever one exists; `public/react-logo.png` is the real logo
but isn't icon-shaped (648×391, a wide lockup, not square) so it wasn't used
directly. On iPad: Safari (not Chrome) → Share → Add to Home Screen.

## Known Gaps / Things to Revisit

- No automatic Storage purge for permanently-unwanted soft-deleted images —
  "Delete Forever" on `/admin/deleted-images` is the only current cleanup
  path, and it's manual.
- The dashboard's "Action Items" stat is still a hardcoded placeholder — no
  real task-tracking feature exists yet.
- `worked_on`, `action_items`, and scratchpad `content` all render via
  `dangerouslySetInnerHTML` with no sanitization. Content only ever comes
  from the app's own TipTap editor today, so this is low-risk in practice,
  but worth revisiting if that ever changes.
- `scratchpad_entries` soft-deletes but has **no admin recovery UI** yet
  (unlike images and meeting notes) — restoring a deleted idea today
  requires a manual SQL update. Worth adding a `/admin/deleted-scratchpad`
  page if this feature gets real usage.
- No self-service password reset for username/password student accounts —
  an Admin has to reset one manually via the Supabase dashboard; there's no
  in-app "reset this student's password" action on `/admin/users` yet.
- Several admin-facing lists (e.g. `/admin/users`) still fall back to
  displaying `profile.email` when there's no better label. For
  username/password student accounts, that shows the synthetic
  `username@students.local` address rather than something cleaner — not
  broken, just not pretty. `/settings` already handles this correctly
  (shows `@username` instead), but the broader sweep across admin pages
  hasn't been done.
- `profiles.username` has a plain (case-sensitive) unique constraint. Two
  usernames differing only by case (e.g. `JamieD` / `jamied`) would still
  correctly get rejected as duplicates, but via the Auth-layer email check
  rather than a database-level conflict on `profiles.username` itself —
  functionally fine, just worth knowing where the real enforcement lives.

## Recent Work

**This session — Auth expansion, PWA, Scratchpad, and a backlog clear-out:**

- Cleared essentially the entire prior "Known Gaps" list: confirmation
  dialogs on destructive admin actions, a full RLS silent-failure audit
  across `profiles`/`teams`/`team_mentors`/`feedback` (not just
  `image_entries`), expired/reused magic-link handling, `/teams` "All
  Teams" awareness, meeting note soft-delete + `/admin/deleted-meeting-notes`
  recovery, query-level pagination on `/images/manage` and
  `/meeting-notes/manage`, `/admin/activity` pagination (replacing the old
  hard 40-entry cap), and a conflict warning when two people save the same
  meeting note at the same time.
- Centralized session refresh into what's now `proxy.ts` (Next.js 16 renamed
  the `middleware.ts` convention mid-session; migrated when the rename
  landed).
- Added PWA support — installable on iPad/phone homescreens with a
  standalone launch (no browser chrome), placeholder icon pending real
  branding.
- Added a Sign Out button (`SignOutButton.tsx`) — previously there was no
  way to log out at all.
- Added username/password authentication for students without an email
  address (`/admin/users/new`, `utils/supabase/admin.ts`, synthetic
  `@students.local` emails, case-insensitive login) — see Authentication
  above. Requires `SUPABASE_SERVICE_ROLE_KEY` to be set.
- Added `/settings` for any user to change their own display name.
- Added `/scoreboard` — top 5 teams by Meeting Notes/Images, last 10 days
  and all-time.
- Fixed the `/admin/feedback` "Open" filter, which was silently showing
  zero results — root cause was the `feedback.status` column's real default
  value being lowercase `"new"`, not the capitalized `"New"` the filter's
  allowlist expected. Redefined "Open" as "not exactly Closed" instead of
  an allowlist, and normalized the per-item status dropdown to match
  case-insensitively.
- Built Scratchpad (`/scratchpad`) — a new, lighter-weight content type for
  quick ideas with optional inline photos, sitting alongside Meeting Notes
  rather than replacing anything.
- Added short, plain-language explanations of what the site/each page is
  for on the login page, `/images`, and `/meeting-notes`, aimed at
  first-time users.

**Earlier — Feedback, Meeting Notes media, team scoping, image lifecycle:**

- Built out the full Feedback system: submission popup in the header,
  automatic capture of user/email/team/page/browser/status, and a complete
  `/admin/feedback`.
- Meeting Notes: camera capture + existing-image insertion in the rich text
  editor, resizable inserted images, pagination.
- Mobile navigation (`MobileNav.tsx`) for viewports below `md`.
- Team-scoping fixes across `/images`, `/meeting-notes`, and Dashboard;
  Admin "All Teams" option added to the header switcher.
- Fixed a real bug where the Dashboard queried a nonexistent `"images"`
  table instead of `"image_entries"`; added client-side image compression;
  per-user AI rate limiting; converted `/admin/users` to query-level
  search/filter/pagination.
- Image lifecycle: soft-delete with student-facing Delete (no restore) and
  Admin-only `/admin/deleted-images` for restore/permanent purge.

**Further back:**

- Team Management (`/admin/teams`): create/rename/delete teams, assign or
  remove mentors, multi-team mentor support.
- Mentor team switcher in the main nav.
- `/admin/activity`: combined activity feed across every team.
- Meeting notes made collaboratively editable by any team member.
- `/api/ai` requires authentication.
