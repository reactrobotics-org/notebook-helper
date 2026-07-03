# TODO

## High priority

- [ ] Add confirmation dialogs to destructive admin actions that don't have
      one yet: delete user, delete team, remove mentor from team
      (`/admin/users`, `/admin/teams`). The `ConfirmSubmitButton` component
      built for "Delete Forever" on `/admin/deleted-images` should work
      as-is for these — it's already a generic reusable wrapper.
- [ ] Audit other tables' RLS policies for the same silent-failure gap found
      on `image_entries` (an UPDATE/DELETE that matches zero rows returns
      no error). Anywhere Admins mutate rows they didn't create is at risk —
      `meeting_notes`, `teams`, `feedback`, `feedback_comments` haven't been
      specifically checked.
- [ ] Handle a failed `exchangeCodeForSession` in `app/(auth)/auth/callback/route.ts`
      — right now an expired/reused magic link silently redirects to
      `/dashboard` → bounces to `/login` with no explanation. Should redirect
      to `/login?error=expired_link` (or similar) with a visible message.

## Medium priority

- [ ] Make `/teams` aware of the Admin "All Teams" selection, matching
      Dashboard/Images/Meeting Notes. Right now an Admin with no team
      selected sees "You are not assigned to a team yet" on `/teams`, which
      reads like an error rather than the expected result of their choice.
- [ ] Decide whether meeting notes need the same soft-delete/trash pattern
      images now have. There's currently no way to delete a meeting note at
      all, so this may be two separate asks: (1) add delete capability, and
      (2) decide if it should be soft-delete + admin recovery like images,
      or something simpler.
- [ ] Paginate `/images/manage` and `/meeting-notes/manage` (personal
      upload/note history) — same unbounded-fetch issue that `/meeting-notes`
      and `/admin/users` already had fixed. Not urgent at current volume.
- [ ] `/admin/activity` pagination — currently hard-capped at 40 most recent
      entries combined, no way to see older activity.

## Lower priority / nice to have

- [ ] Automatic Storage purge for old soft-deleted images (e.g. after 30
      days) — currently "Delete Forever" on `/admin/deleted-images` is the
      only cleanup path, and it's fully manual. Would need a scheduled job
      (Supabase Edge Function + cron, or similar).
- [ ] Build real Action Items / task tracking — the Dashboard's "Action
      Items" stat is still a hardcoded `0` placeholder.
- [ ] Conflict warning when two people edit the same meeting note at the
      same time (currently last save silently wins).
- [ ] Consider centralizing session refresh into `middleware.ts` instead of
      per-page — works today, just not the typical Supabase SSR pattern.
- [ ] If meeting note content ever comes from anywhere other than the app's
      own TipTap editor, revisit the unsanitized `dangerouslySetInnerHTML`
      rendering of `worked_on`/`action_items`.

## Recently completed (for reference — remove once confirmed stable)

- [x] Feedback system: submission, header placement, admin search/filter/
      status/comments, Open/Closed/All tabs.
- [x] Meeting Notes: camera capture + existing-image picker in one modal,
      image resizing (S/M/L/Full), pagination + collapsed cards.
- [x] Mobile hamburger nav.
- [x] Team scoping for Images/Meeting Notes/Dashboard + Admin "All Teams".
- [x] Dashboard `"images"` → `"image_entries"` table-name bug fix.
- [x] Client-side image compression before upload.
- [x] `/api/ai` per-user rate limiting.
- [x] `/admin/users` query-level filtering + pagination.
- [x] Image soft-delete + Admin-only restore/permanent-delete
      (`/admin/deleted-images`), including the RLS fix that made restore/
      delete actually work for rows an Admin didn't personally create.
- [x] Click-your-own-image-to-edit-it flow on `/images`.
