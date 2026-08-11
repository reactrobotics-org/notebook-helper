-- REACT Learning pilot schema + VEX IQ pilot curriculum
-- Run this entire file in the Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.learning_courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  sort_order integer not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.learning_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.learning_courses(id) on delete cascade,
  slug text not null,
  title text not null,
  description text,
  sort_order integer not null default 0,
  passing_score integer not null default 80 check (passing_score between 0 and 100),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  unique(course_id, slug)
);

create table if not exists public.learning_lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.learning_modules(id) on delete cascade,
  slug text not null,
  title text not null,
  summary text,
  content text not null default '',
  resource_url text,
  sort_order integer not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  unique(module_id, slug)
);

create table if not exists public.learning_questions (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.learning_modules(id) on delete cascade,
  prompt text not null,
  sort_order integer not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.learning_question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.learning_questions(id) on delete cascade,
  option_key text not null,
  label text not null,
  sort_order integer not null default 0,
  unique(question_id, option_key)
);

-- Kept separate from student-readable question data so the answer key is never
-- sent to the browser by normal course queries.
create table if not exists public.learning_answer_keys (
  question_id uuid primary key references public.learning_questions(id) on delete cascade,
  correct_option_key text not null
);

create table if not exists public.learning_lesson_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.learning_lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key(user_id, lesson_id)
);

create table if not exists public.learning_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id uuid not null references public.learning_modules(id) on delete cascade,
  score integer not null check (score between 0 and 100),
  passed boolean not null,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists learning_modules_course_idx on public.learning_modules(course_id, sort_order);
create index if not exists learning_lessons_module_idx on public.learning_lessons(module_id, sort_order);
create index if not exists learning_questions_module_idx on public.learning_questions(module_id, sort_order);
create index if not exists learning_attempts_user_module_idx on public.learning_quiz_attempts(user_id, module_id, created_at desc);

create or replace function public.is_learning_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and lower(coalesce(role, '')) = 'admin'
  );
$$;

create or replace function public.can_view_learning_student(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    target_user_id = auth.uid()
    or public.is_learning_admin()
    or exists (
      select 1
      from public.profiles student
      join public.team_mentors tm on tm.team_id = student.team_id
      where student.id = target_user_id
        and tm.mentor_id = auth.uid()
    );
$$;

alter table public.learning_courses enable row level security;
alter table public.learning_modules enable row level security;
alter table public.learning_lessons enable row level security;
alter table public.learning_questions enable row level security;
alter table public.learning_question_options enable row level security;
alter table public.learning_answer_keys enable row level security;
alter table public.learning_lesson_progress enable row level security;
alter table public.learning_quiz_attempts enable row level security;

-- Re-runnable policy setup.
drop policy if exists "Read published learning courses" on public.learning_courses;
create policy "Read published learning courses" on public.learning_courses
for select using (published or public.is_learning_admin());

drop policy if exists "Admins manage learning courses" on public.learning_courses;
create policy "Admins manage learning courses" on public.learning_courses
for all using (public.is_learning_admin()) with check (public.is_learning_admin());

drop policy if exists "Read published learning modules" on public.learning_modules;
create policy "Read published learning modules" on public.learning_modules
for select using (
  (published and exists (select 1 from public.learning_courses c where c.id = course_id and c.published))
  or public.is_learning_admin()
);

drop policy if exists "Admins manage learning modules" on public.learning_modules;
create policy "Admins manage learning modules" on public.learning_modules
for all using (public.is_learning_admin()) with check (public.is_learning_admin());

drop policy if exists "Read published learning lessons" on public.learning_lessons;
create policy "Read published learning lessons" on public.learning_lessons
for select using (
  (published and exists (
    select 1 from public.learning_modules m
    join public.learning_courses c on c.id = m.course_id
    where m.id = module_id and m.published and c.published
  )) or public.is_learning_admin()
);

drop policy if exists "Admins manage learning lessons" on public.learning_lessons;
create policy "Admins manage learning lessons" on public.learning_lessons
for all using (public.is_learning_admin()) with check (public.is_learning_admin());

drop policy if exists "Read published learning questions" on public.learning_questions;
create policy "Read published learning questions" on public.learning_questions
for select using (
  (published and exists (
    select 1 from public.learning_modules m
    join public.learning_courses c on c.id = m.course_id
    where m.id = module_id and m.published and c.published
  )) or public.is_learning_admin()
);

drop policy if exists "Admins manage learning questions" on public.learning_questions;
create policy "Admins manage learning questions" on public.learning_questions
for all using (public.is_learning_admin()) with check (public.is_learning_admin());

drop policy if exists "Read learning question options" on public.learning_question_options;
create policy "Read learning question options" on public.learning_question_options
for select using (
  exists (
    select 1 from public.learning_questions q
    join public.learning_modules m on m.id = q.module_id
    join public.learning_courses c on c.id = m.course_id
    where q.id = question_id and q.published and m.published and c.published
  ) or public.is_learning_admin()
);

drop policy if exists "Admins manage learning question options" on public.learning_question_options;
create policy "Admins manage learning question options" on public.learning_question_options
for all using (public.is_learning_admin()) with check (public.is_learning_admin());

-- Students cannot read this table. Quiz grading uses the existing server-only
-- Supabase service-role client.
drop policy if exists "Admins manage learning answer keys" on public.learning_answer_keys;
create policy "Admins manage learning answer keys" on public.learning_answer_keys
for all using (public.is_learning_admin()) with check (public.is_learning_admin());

drop policy if exists "View authorized lesson progress" on public.learning_lesson_progress;
create policy "View authorized lesson progress" on public.learning_lesson_progress
for select using (public.can_view_learning_student(user_id));

drop policy if exists "Students complete own lessons" on public.learning_lesson_progress;
create policy "Students complete own lessons" on public.learning_lesson_progress
for insert with check (user_id = auth.uid());

drop policy if exists "Students update own lesson completion" on public.learning_lesson_progress;
create policy "Students update own lesson completion" on public.learning_lesson_progress
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "View authorized quiz attempts" on public.learning_quiz_attempts;
create policy "View authorized quiz attempts" on public.learning_quiz_attempts
for select using (public.can_view_learning_student(user_id));

drop policy if exists "Students create own quiz attempts" on public.learning_quiz_attempts;
create policy "Students create own quiz attempts" on public.learning_quiz_attempts
for insert with check (user_id = auth.uid());

-- -----------------------------
-- Pilot curriculum: VEX IQ
-- -----------------------------
insert into public.learning_courses (slug, title, description, sort_order, published)
values (
  'vex-iq-fundamentals',
  'VEX IQ Fundamentals',
  'REACT pilot course covering VEX IQ safety and structural building fundamentals.',
  10,
  true
)
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  sort_order = excluded.sort_order,
  published = excluded.published;

with course as (
  select id from public.learning_courses where slug = 'vex-iq-fundamentals'
)
insert into public.learning_modules (course_id, slug, title, description, sort_order, passing_score, published)
select id, 'rules-safety', '1. Rules & Safety', 'Start with safe habits and the expectations for working with VEX IQ robots.', 10, 80, true from course
union all
select id, 'structure', '2. Structure', 'Learn how pins, standoffs, connectors, gussets, and triangles create strong VEX IQ structures.', 20, 80, true from course
on conflict (course_id, slug) do update set
  title = excluded.title,
  description = excluded.description,
  sort_order = excluded.sort_order,
  passing_score = excluded.passing_score,
  published = excluded.published;

with module as (
  select m.id, m.slug
  from public.learning_modules m
  join public.learning_courses c on c.id = m.course_id
  where c.slug = 'vex-iq-fundamentals'
)
insert into public.learning_lessons (module_id, slug, title, summary, content, resource_url, sort_order, published)
select id, 'work-safely', 'Work Safely',
  'Learn the basic habits that protect students, teammates, and equipment.',
  E'Robotics work should be deliberate and organized. Keep the work area clear, handle parts and tools carefully, and stop when something does not look or feel right. Before powering or testing a robot, make sure hands, hair, clothing, and loose objects are clear of moving mechanisms.\n\nREACT expects students to understand and follow the VEX safety guidance before moving into hands-on building.',
  'https://kb.vex.com/hc/en-us/articles/360053670271-Precautions-and-Safety-Guidelines-When-Working-with-VEX-GO-and-VEX-IQ-Robots', 10, true
from module where slug = 'rules-safety'
union all
select id, 'pins-standoffs', 'Pins & Standoffs',
  'Learn how beams, pins, and standoffs work together to create rigid, well-spaced structures.',
  E'## Beams: the frame of the robot\n\nBeams are the main structural pieces used to build frames, chassis, towers, arms, and supports. Long beams can span larger distances, but long unsupported sections can flex more easily. Strong designs support long spans with additional connections or bracing instead of simply stacking extra parts.\n\n## Pins: connection points matter\n\nPins join VEX IQ structural pieces through their holes. One pin can hold two pieces together while still allowing them to rotate around that point. That can be useful for a pivot, but it is usually undesirable in a rigid frame.\n\nUsing two well-spaced connection points helps stop unwanted rotation. Spreading the connection points farther apart usually gives the joint more resistance to twisting than placing both connections very close together.\n\n## Standoffs: spacing with support\n\nStandoffs hold structural members a controlled distance apart while connecting them together. They are useful for creating wider frames, separating parallel beams, supporting components between layers, and tying the left and right sides of a chassis together.\n\nA structure that uses spacing effectively can resist bending and twisting without becoming unnecessarily heavy.\n\n## Check your build\n\nGently test the joint in several directions. If it rotates, twists, or separates when it should stay rigid, identify the unwanted movement and add support that specifically prevents it.',
  null, 10, true
from module where slug = 'structure'
union all
select id, 'corner-connectors', 'Corner Connectors',
  'Learn how corner connectors create strong changes in direction and three-dimensional structures.',
  E'## Building corners\n\nRobot structures rarely stay in one flat plane. Corner connectors let beams meet in different directions so you can create rectangular frames, chassis sections, towers, supports, and other three-dimensional shapes.\n\n## Strong 90-degree joints\n\nA good corner connection holds the pieces at the intended angle without allowing them to wobble. Check a corner from more than one direction: a joint can look strong from the side while still twisting from front to back.\n\n## More than one connection point\n\nWhenever possible, use a connection that prevents rotation instead of relying on a single pivot point. Multiple well-placed connections distribute force across a wider area and usually create a more rigid joint.\n\n## Square frames can still move\n\nFour beams connected into a rectangle may look solid, but the rectangle can rack sideways into a slanted shape without any side changing length. Corner connectors make the corners stronger, but diagonal support may still be needed when the frame must resist side-to-side movement.',
  null, 20, true
from module where slug = 'structure'
union all
select id, 'gussets-angles', 'Gussets & Angles',
  'Use angled structural parts and bracing to create supported 90-degree and 45-degree connections.',
  E'## Reinforcing a change in direction\n\nWhenever a structure changes direction, the joint becomes an important load point. Angled connectors and braces reinforce that joint and help structural members stay at the intended angle.\n\n## 90-degree construction\n\nA 90-degree joint forms a square corner. These joints are common in chassis frames, vertical towers, mounting structures, and mechanism supports. A strong 90-degree joint should resist folding or twisting when you gently apply force.\n\n## 45-degree supports\n\nA diagonal support near 45 degrees can connect a vertical member to a horizontal member and reduce side-to-side movement. The exact geometry of a robot varies, but the engineering idea stays the same: support the joint from another direction so the load is not carried by the corner alone.\n\n## Test every direction\n\nA tower may be rigid from front to back but weak from side to side. Test structural sections in multiple directions and add support where movement actually occurs.',
  null, 30, true
from module where slug = 'structure'
union all
select id, 'triangles', 'Structural Triangles',
  'Use triangles and diagonal bracing to prevent frames and towers from changing shape.',
  E'## Why rectangles can rack\n\nA rectangle can lean sideways and become a parallelogram while all four sides remain the same length. This movement is called racking. A rectangular frame therefore may need more than strong corners.\n\n## Why triangles are rigid\n\nIf all three sides of a triangle keep the same length, the triangle cannot change shape without one of those sides bending or changing length. That is why triangular bracing is so useful in robot structures.\n\n## Add a diagonal brace\n\nAdding a diagonal member across a rectangular opening divides the area into triangles. This can dramatically reduce racking and make a frame or tower feel much more rigid.\n\n## Strong does not mean heavy\n\nAdding parts everywhere can increase weight without solving the real problem. Efficient structures place support where forces and unwanted movement occur. A well-placed diagonal brace can provide more useful rigidity than several unnecessary beams.\n\n## Structure design checklist\n\n- Are important joints connected at more than one point?\n- Can any part rotate when it should remain rigid?\n- Can the frame twist or rack?\n- Are long sections supported?\n- Are corners reinforced?\n- Would a diagonal brace reduce movement?\n- Is the structure strong in more than one direction?\n- Are unnecessary parts adding weight?\n\nGood structure is about controlling movement. Build strong, rigid, and efficient robots by putting support where it is actually needed.',
  null, 40, true
from module where slug = 'structure'
on conflict (module_id, slug) do update set
  title = excluded.title,
  summary = excluded.summary,
  content = excluded.content,
  resource_url = excluded.resource_url,
  sort_order = excluded.sort_order,
  published = excluded.published;

-- Replace pilot questions on each seeded module so this script remains repeatable.
delete from public.learning_questions q
using public.learning_modules m, public.learning_courses c
where q.module_id = m.id and m.course_id = c.id
  and c.slug = 'vex-iq-fundamentals' and m.slug in ('rules-safety', 'structure');

with module as (
  select m.id, m.slug
  from public.learning_modules m join public.learning_courses c on c.id = m.course_id
  where c.slug = 'vex-iq-fundamentals'
)
insert into public.learning_questions (module_id, prompt, sort_order, published)
select id, 'Before powering or testing a robot, what should you do?', 10, true from module where slug = 'rules-safety'
union all
select id, 'What is the best response when something on the robot does not look or feel right?', 20, true from module where slug = 'rules-safety'
union all
select id, 'Which item should be kept clear of a moving robot mechanism?', 30, true from module where slug = 'rules-safety'
union all
select id, 'Why should the work area be kept organized?', 40, true from module where slug = 'rules-safety'
union all
select id, 'When should a student learn the VEX safety guidance?', 50, true from module where slug = 'rules-safety'
union all
select id, 'What is a main purpose of standoffs in a VEX IQ structure?', 10, true from module where slug = 'structure'
union all
select id, 'When are corner connectors especially useful?', 20, true from module where slug = 'structure'
union all
select id, 'What can gussets help a builder create?', 30, true from module where slug = 'structure'
union all
select id, 'Why does adding a diagonal brace often make a rectangular frame more rigid?', 40, true from module where slug = 'structure'
union all
select id, 'What should you consider when choosing how to connect structural pieces?', 50, true from module where slug = 'structure';

-- Options + answer keys, keyed by prompt for readable seed data.
with q as (select id, prompt from public.learning_questions)
insert into public.learning_question_options (question_id, option_key, label, sort_order)
select id,'a','Make sure hands, hair, clothing, and loose objects are clear',10 from q where prompt='Before powering or testing a robot, what should you do?'
union all select id,'b','Hold the moving mechanism so it cannot turn',20 from q where prompt='Before powering or testing a robot, what should you do?'
union all select id,'c','Remove the battery while the program is running',30 from q where prompt='Before powering or testing a robot, what should you do?'
union all select id,'a','Stop and check the problem before continuing',10 from q where prompt='What is the best response when something on the robot does not look or feel right?'
union all select id,'b','Increase the motor speed',20 from q where prompt='What is the best response when something on the robot does not look or feel right?'
union all select id,'c','Ignore it if the robot still moves',30 from q where prompt='What is the best response when something on the robot does not look or feel right?'
union all select id,'a','Loose clothing',10 from q where prompt='Which item should be kept clear of a moving robot mechanism?'
union all select id,'b','The Brain screen',20 from q where prompt='Which item should be kept clear of a moving robot mechanism?'
union all select id,'c','A labeled parts bin',30 from q where prompt='Which item should be kept clear of a moving robot mechanism?'
union all select id,'a','It reduces hazards and makes careful work easier',10 from q where prompt='Why should the work area be kept organized?'
union all select id,'b','It makes the robot drive faster',20 from q where prompt='Why should the work area be kept organized?'
union all select id,'c','It removes the need for safety checks',30 from q where prompt='Why should the work area be kept organized?'
union all select id,'a','Before moving into hands-on building',10 from q where prompt='When should a student learn the VEX safety guidance?'
union all select id,'b','Only after the first competition',20 from q where prompt='When should a student learn the VEX safety guidance?'
union all select id,'c','Only if a robot breaks',30 from q where prompt='When should a student learn the VEX safety guidance?'
union all select id,'a','Create spacing between structural members',10 from q where prompt='What is a main purpose of standoffs in a VEX IQ structure?'
union all select id,'b','Increase battery voltage',20 from q where prompt='What is a main purpose of standoffs in a VEX IQ structure?'
union all select id,'c','Program the Brain',30 from q where prompt='What is a main purpose of standoffs in a VEX IQ structure?'
union all select id,'a','When structural pieces need a supported change in direction',10 from q where prompt='When are corner connectors especially useful?'
union all select id,'b','When charging a battery',20 from q where prompt='When are corner connectors especially useful?'
union all select id,'c','When changing motor code',30 from q where prompt='When are corner connectors especially useful?'
union all select id,'a','Supported 90-degree and 45-degree joints',10 from q where prompt='What can gussets help a builder create?'
union all select id,'b','Wireless controller signals',20 from q where prompt='What can gussets help a builder create?'
union all select id,'c','Higher battery capacity',30 from q where prompt='What can gussets help a builder create?'
union all select id,'a','It creates triangular bracing that resists racking',10 from q where prompt='Why does adding a diagonal brace often make a rectangular frame more rigid?'
union all select id,'b','It makes every beam longer',20 from q where prompt='Why does adding a diagonal brace often make a rectangular frame more rigid?'
union all select id,'c','It removes all joints',30 from q where prompt='Why does adding a diagonal brace often make a rectangular frame more rigid?'
union all select id,'a','The directions of force and unwanted movement the joint must resist',10 from q where prompt='What should you consider when choosing how to connect structural pieces?'
union all select id,'b','Only the color of the connector',20 from q where prompt='What should you consider when choosing how to connect structural pieces?'
union all select id,'c','Only the number of motors on the robot',30 from q where prompt='What should you consider when choosing how to connect structural pieces?';

insert into public.learning_answer_keys (question_id, correct_option_key)
select id, 'a' from public.learning_questions
on conflict (question_id) do update set correct_option_key = excluded.correct_option_key;
