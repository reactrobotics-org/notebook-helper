# REACT Learning Pilot

This project copy includes the first working Learning-system pass for `reactrobotics.app`.

## What is included

- `/learning` course list and student progress
- ordered modules with automatic locking/unlocking
- lesson completion tracking
- module tests with an 80% pass requirement
- server-side quiz grading; answer keys are not exposed through normal student reads
- `/admin/learning` progress overview
- Learning links in desktop/mobile navigation
- Dashboard Learning progress card replacing the old Action Items placeholder
- VEX IQ pilot seed: Rules & Safety and Structure

## Supabase setup

1. Open the existing REACT Supabase project.
2. Open **SQL Editor**.
3. Run the entire contents of `supabase/learning.sql`.
4. Confirm the existing Vercel environment has `SUPABASE_SERVICE_ROLE_KEY`. The app already uses this key for admin-created student accounts; the Learning pilot also uses it server-side to read quiz answer keys while grading.
5. Deploy the updated Next.js project.

The SQL is designed to be rerunnable for the pilot seed. It creates the Learning tables, RLS policies, helper functions, indexes, and pilot curriculum.

## Curriculum note

The module/topic structure comes from the supplied REACT Curriculum Outline. The explanatory lesson prose and pilot quiz wording are draft instructional content added to make the workflow testable. Review that prose and the quiz questions before using them as the final curriculum.

## Current pilot behavior

Every authenticated user can see published courses. There is no enrollment-management requirement in this first pass. Progress is stored per user. A student completes every lesson in a module, takes the module test, and must score at least the module's configured passing score (80% in the seed). Passing unlocks the next module automatically.

Mentors do not sign off on anything. RLS permits mentors to read progress for students on teams they mentor, which leaves room for a mentor progress screen later. Admins can see the cross-student progress table at `/admin/learning`.

## Recommended next build

After the pilot workflow is tested with real accounts, add a browser-based curriculum editor for Admins, then populate the remaining IQ modules (Motion, Electronics, Coding) and V5 modules from the outline.
