import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

type Lesson = {
  id: string;
  slug: string;
  title: string;
  published: boolean;
  sort_order: number;
};

type Module = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  passing_score: number;
  published: boolean;
  sort_order: number;
  learning_lessons: Lesson[] | null;
};

type Course = {
  id: string;
  slug: string;
  title: string;
  published: boolean;
  sort_order: number;
  learning_modules: Module[] | null;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if ((profile?.role ?? "").toLowerCase() !== "admin") {
    redirect("/dashboard");
  }

  return supabase;
}

async function createUniqueModuleSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  courseId: string,
  requestedSlug: string
) {
  const base = slugify(requestedSlug) || "module";

  let slug = base;
  let number = 2;

  while (true) {
    const { data } = await supabase
      .from("learning_modules")
      .select("id")
      .eq("course_id", courseId)
      .eq("slug", slug)
      .maybeSingle();

    if (!data) {
      return slug;
    }

    slug = `${base}-${number}`;
    number += 1;
  }
}

async function createUniqueLessonSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  moduleId: string,
  requestedSlug: string
) {
  const base = slugify(requestedSlug) || "lesson";

  let slug = base;
  let number = 2;

  while (true) {
    const { data } = await supabase
      .from("learning_lessons")
      .select("id")
      .eq("module_id", moduleId)
      .eq("slug", slug)
      .maybeSingle();

    if (!data) {
      return slug;
    }

    slug = `${base}-${number}`;
    number += 1;
  }
}

async function createModule(formData: FormData) {
  "use server";

  const courseId = String(formData.get("course_id") ?? "");
  const courseSlug = String(formData.get("course_slug") ?? "");

  const title = String(formData.get("title") ?? "").trim();

  const requestedSlug = String(formData.get("slug") ?? "").trim();

  const description = String(
    formData.get("description") ?? ""
  ).trim();

  const passingScoreRaw = Number(
    formData.get("passing_score") ?? 80
  );

  const passingScore = Number.isFinite(passingScoreRaw)
    ? Math.min(100, Math.max(0, Math.round(passingScoreRaw)))
    : 80;

  const published =
    formData.get("published") === "true";

  if (!courseId || !courseSlug || !title) {
    return;
  }

  const supabase = await requireAdmin();

  const { data: existingModules } = await supabase
    .from("learning_modules")
    .select("sort_order")
    .eq("course_id", courseId)
    .order("sort_order", {
      ascending: false,
    })
    .limit(1);

  const nextSortOrder =
    (existingModules?.[0]?.sort_order ?? 0) + 10;

  const moduleSlug = await createUniqueModuleSlug(
    supabase,
    courseId,
    requestedSlug || title
  );

  const { error } = await supabase
    .from("learning_modules")
    .insert({
      course_id: courseId,
      title,
      slug: moduleSlug,
      description: description || null,
      passing_score: passingScore,
      sort_order: nextSortOrder,
      published,
    });

  if (error) {
    throw new Error(
      `Unable to create module: ${error.message}`
    );
  }

  revalidatePath("/admin/learning");
  revalidatePath(`/learning/${courseSlug}`);
  revalidatePath("/learning");

  redirect("/admin/learning?created=module");
}

async function updateModule(formData: FormData) {
  "use server";

  const moduleId = String(
    formData.get("module_id") ?? ""
  );

  const courseSlug = String(
    formData.get("course_slug") ?? ""
  );

  const moduleSlug = String(
    formData.get("module_slug") ?? ""
  );

  const title = String(
    formData.get("title") ?? ""
  ).trim();

  const description = String(
    formData.get("description") ?? ""
  ).trim();

  const passingScoreRaw = Number(
    formData.get("passing_score") ?? 80
  );

  const sortOrderRaw = Number(
    formData.get("sort_order") ?? 0
  );

  const passingScore = Number.isFinite(passingScoreRaw)
    ? Math.min(
        100,
        Math.max(0, Math.round(passingScoreRaw))
      )
    : 80;

  const sortOrder = Number.isFinite(sortOrderRaw)
    ? Math.round(sortOrderRaw)
    : 0;

  const published =
    formData.get("published") === "true";

  if (
    !moduleId ||
    !courseSlug ||
    !moduleSlug ||
    !title
  ) {
    return;
  }

  const supabase = await requireAdmin();

  const { error } = await supabase
    .from("learning_modules")
    .update({
      title,
      description: description || null,
      passing_score: passingScore,
      sort_order: sortOrder,
      published,
    })
    .eq("id", moduleId);

  if (error) {
    throw new Error(
      `Unable to update module: ${error.message}`
    );
  }

  revalidatePath("/admin/learning");
  revalidatePath("/learning");
  revalidatePath(`/learning/${courseSlug}`);
  revalidatePath(
    `/learning/${courseSlug}/${moduleSlug}`
  );

  redirect("/admin/learning?updated=module");
}

async function createLesson(formData: FormData) {
  "use server";

  const courseSlug = String(
    formData.get("course_slug") ?? ""
  );

  const moduleId = String(
    formData.get("module_id") ?? ""
  );

  const moduleSlug = String(
    formData.get("module_slug") ?? ""
  );

  const title = String(
    formData.get("title") ?? ""
  ).trim();

  const requestedSlug = String(
    formData.get("slug") ?? ""
  ).trim();

  const summary = String(
    formData.get("summary") ?? ""
  ).trim();

  const published =
    formData.get("published") === "true";

  if (
    !courseSlug ||
    !moduleId ||
    !moduleSlug ||
    !title
  ) {
    return;
  }

  const supabase = await requireAdmin();

  const { data: existingLessons } = await supabase
    .from("learning_lessons")
    .select("sort_order")
    .eq("module_id", moduleId)
    .order("sort_order", {
      ascending: false,
    })
    .limit(1);

  const nextSortOrder =
    (existingLessons?.[0]?.sort_order ?? 0) + 10;

  const lessonSlug = await createUniqueLessonSlug(
    supabase,
    moduleId,
    requestedSlug || title
  );

  const { data: lesson, error } = await supabase
    .from("learning_lessons")
    .insert({
      module_id: moduleId,
      title,
      slug: lessonSlug,
      summary: summary || null,
      content: "",
      sort_order: nextSortOrder,
      published,
    })
    .select("id")
    .single();

  if (error || !lesson) {
    throw new Error(
      `Unable to create lesson: ${
        error?.message ?? "Unknown error"
      }`
    );
  }

  revalidatePath("/admin/learning");
  revalidatePath(`/learning/${courseSlug}`);
  revalidatePath(
    `/learning/${courseSlug}/${moduleSlug}`
  );
  revalidatePath("/learning");

  redirect(
    `/admin/learning/${courseSlug}/${moduleSlug}/${lessonSlug}`
  );
}

export default async function AdminLearningPage({
  searchParams,
}: {
  searchParams: Promise<{
    saved?: string;
    created?: string;
    updated?: string;
  }>;
}) {
  const {
    saved,
    created,
    updated,
  } = await searchParams;

  const supabase = await requireAdmin();

  const [
    { data: courseData },
    { data: students },
    { data: attempts },
  ] = await Promise.all([
    supabase
      .from("learning_courses")
      .select(
        `
          id,
          slug,
          title,
          published,
          sort_order,
          learning_modules (
            id,
            slug,
            title,
            description,
            passing_score,
            published,
            sort_order,
            learning_lessons (
              id,
              slug,
              title,
              published,
              sort_order
            )
          )
        `
      )
      .order("sort_order", {
        ascending: true,
      }),

    supabase
      .from("profiles")
      .select(
        `
          id,
          full_name,
          username,
          email,
          team_id
        `
      )
      .ilike("role", "student")
      .order("full_name", {
        ascending: true,
      }),

    supabase
      .from("learning_quiz_attempts")
      .select(
        `
          user_id,
          module_id,
          score,
          passed,
          created_at
        `
      )
      .order("created_at", {
        ascending: false,
      }),
  ]);

  if (!courseData) {
    return (
      <div className="rounded-2xl bg-amber-50 p-6 text-amber-900">
        Learning tables could not be loaded.
      </div>
    );
  }

  const courses =
    courseData as unknown as Course[];

  /*
   * Make sure nested modules and lessons
   * appear in sort_order.
   */
  for (const course of courses) {
    course.learning_modules?.sort(
      (a, b) =>
        a.sort_order - b.sort_order
    );

    for (
      const module of
      course.learning_modules ?? []
    ) {
      module.learning_lessons?.sort(
        (a, b) =>
          a.sort_order - b.sort_order
      );
    }
  }

  const publishedModules =
    courses.flatMap((course) =>
      (
        course.learning_modules ?? []
      ).filter(
        (module) => module.published
      )
    );

  const attemptsByStudent = new Map<
    string,
    NonNullable<typeof attempts>
  >();

  for (const attempt of attempts ?? []) {
    const existing =
      attemptsByStudent.get(
        attempt.user_id
      ) ?? [];

    existing.push(attempt);

    attemptsByStudent.set(
      attempt.user_id,
      existing
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-[#1C1F23]">
            Learning
          </h2>

          <p className="mt-1 text-slate-600">
            Build courses, lessons, module tests,
            and review student progress.
          </p>
        </div>

        <Link
          href="/learning"
          className="rounded-xl bg-[#1C1F23] px-5 py-3 font-semibold text-white"
        >
          Open student view
        </Link>
      </div>

      {saved === "1" && (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 font-semibold text-emerald-800">
          Lesson saved.
        </div>
      )}

      {created === "module" && (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 font-semibold text-emerald-800">
          Module created.
        </div>
      )}

      {updated === "module" && (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 font-semibold text-emerald-800">
          Module updated.
        </div>
      )}

      <div className="mt-7 grid gap-4 md:grid-cols-3">
        <Stat
          label="Courses"
          value={courses.length}
        />

        <Stat
          label="Published modules"
          value={publishedModules.length}
        />

        <Stat
          label="Students"
          value={(students ?? []).length}
        />
      </div>

      <section className="mt-8 rounded-2xl bg-white p-6 shadow">
        <div className="mb-5 border-b border-slate-200 pb-4">
          <h3 className="text-xl font-bold">
            Curriculum editor
          </h3>

          <p className="mt-1 text-slate-600">
            Add and edit modules, lessons,
            and module tests.
          </p>
        </div>

        <div className="space-y-8">
          {courses.map((course) => (
            <div key={course.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <h4 className="text-xl font-bold text-[#1C1F23]">
                    {course.title}
                  </h4>

                  <Status
                    published={
                      course.published
                    }
                  />
                </div>

                <details className="group">
                  <summary className="cursor-pointer list-none rounded-lg bg-[#8ED4FF] px-4 py-2 text-sm font-bold text-[#1C1F23] hover:bg-[#74C7FA]">
                    + Add Module
                  </summary>

                  <form
                    action={createModule}
                    className="mt-3 w-full rounded-xl border border-sky-200 bg-[#EEF8FF] p-5 sm:w-[520px]"
                  >
                    <input
                      type="hidden"
                      name="course_id"
                      value={course.id}
                    />

                    <input
                      type="hidden"
                      name="course_slug"
                      value={course.slug}
                    />

                    <div className="grid gap-4">
                      <label>
                        <span className="mb-1 block text-sm font-bold text-slate-700">
                          Module title
                        </span>

                        <input
                          name="title"
                          required
                          placeholder="Example: Drivetrain"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                        />
                      </label>

                      <label>
                        <span className="mb-1 block text-sm font-bold text-slate-700">
                          Slug
                        </span>

                        <input
                          name="slug"
                          placeholder="Leave blank to create automatically"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                        />
                      </label>

                      <label>
                        <span className="mb-1 block text-sm font-bold text-slate-700">
                          Description
                        </span>

                        <textarea
                          name="description"
                          rows={3}
                          placeholder="Short description of this module"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                        />
                      </label>

                      <label>
                        <span className="mb-1 block text-sm font-bold text-slate-700">
                          Passing score
                        </span>

                        <input
                          type="number"
                          name="passing_score"
                          min={0}
                          max={100}
                          defaultValue={80}
                          className="w-32 rounded-lg border border-slate-300 bg-white px-3 py-2"
                        />
                      </label>

                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          name="published"
                          value="true"
                          className="h-5 w-5"
                        />

                        <span className="font-semibold text-slate-700">
                          Publish immediately
                        </span>
                      </label>

                      <button
                        type="submit"
                        className="rounded-lg bg-[#1C1F23] px-5 py-3 font-bold text-white hover:bg-black"
                      >
                        Create Module
                      </button>
                    </div>
                  </form>
                </details>
              </div>

              <div className="mt-4 space-y-4">
                {(
                  course.learning_modules ?? []
                ).map((module) => (
                  <div
                    key={module.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="font-bold text-slate-800">
                          {module.title}
                        </div>

                        <Status
                          published={
                            module.published
                          }
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">

                        {/* EDIT MODULE */}
                        <details className="group">
                          <summary className="cursor-pointer list-none rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100">
                            Edit Module
                          </summary>

                          <form
                            action={updateModule}
                            className="mt-3 w-full rounded-xl border border-slate-300 bg-white p-5 shadow-sm sm:w-[520px]"
                          >
                            <input
                              type="hidden"
                              name="module_id"
                              value={
                                module.id
                              }
                            />

                            <input
                              type="hidden"
                              name="course_slug"
                              value={
                                course.slug
                              }
                            />

                            <input
                              type="hidden"
                              name="module_slug"
                              value={
                                module.slug
                              }
                            />

                            <div className="grid gap-4">
                              <label>
                                <span className="mb-1 block text-sm font-bold text-slate-700">
                                  Module title
                                </span>

                                <input
                                  name="title"
                                  required
                                  defaultValue={
                                    module.title
                                  }
                                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                                />
                              </label>

                              <label>
                                <span className="mb-1 block text-sm font-bold text-slate-700">
                                  Description
                                </span>

                                <textarea
                                  name="description"
                                  rows={3}
                                  defaultValue={
                                    module.description ??
                                    ""
                                  }
                                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                                />
                              </label>

                              <div className="grid gap-4 sm:grid-cols-2">
                                <label>
                                  <span className="mb-1 block text-sm font-bold text-slate-700">
                                    Passing score
                                  </span>

                                  <input
                                    type="number"
                                    name="passing_score"
                                    min={0}
                                    max={100}
                                    defaultValue={
                                      module.passing_score
                                    }
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                                  />
                                </label>

                                <label>
                                  <span className="mb-1 block text-sm font-bold text-slate-700">
                                    Sort order
                                  </span>

                                  <input
                                    type="number"
                                    name="sort_order"
                                    defaultValue={
                                      module.sort_order
                                    }
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                                  />
                                </label>
                              </div>

                              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <label className="flex items-start gap-3">
                                  <input
                                    type="checkbox"
                                    name="published"
                                    value="true"
                                    defaultChecked={
                                      module.published
                                    }
                                    className="mt-1 h-5 w-5"
                                  />

                                  <div>
                                    <div className="font-bold text-slate-800">
                                      Published
                                    </div>

                                    <div className="text-sm text-slate-500">
                                      Students can see this module when it is published.
                                    </div>
                                  </div>
                                </label>
                              </div>

                              <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
                                URL slug:{" "}
                                <strong>
                                  {
                                    module.slug
                                  }
                                </strong>
                              </div>

                              <button
                                type="submit"
                                className="rounded-lg bg-[#1C1F23] px-5 py-3 font-bold text-white hover:bg-black"
                              >
                                Save Module
                              </button>
                            </div>
                          </form>
                        </details>

                        {/* ADD LESSON */}
                        <details className="group">
                          <summary className="cursor-pointer list-none rounded-lg border border-sky-300 bg-white px-4 py-2 text-sm font-bold text-sky-800 hover:bg-sky-50">
                            + Add Lesson
                          </summary>

                          <form
                            action={
                              createLesson
                            }
                            className="mt-3 w-full rounded-xl border border-sky-200 bg-[#EEF8FF] p-5 sm:w-[520px]"
                          >
                            <input
                              type="hidden"
                              name="course_slug"
                              value={
                                course.slug
                              }
                            />

                            <input
                              type="hidden"
                              name="module_id"
                              value={
                                module.id
                              }
                            />

                            <input
                              type="hidden"
                              name="module_slug"
                              value={
                                module.slug
                              }
                            />

                            <div className="grid gap-4">
                              <label>
                                <span className="mb-1 block text-sm font-bold text-slate-700">
                                  Lesson title
                                </span>

                                <input
                                  name="title"
                                  required
                                  placeholder="Example: Gear Ratios"
                                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                                />
                              </label>

                              <label>
                                <span className="mb-1 block text-sm font-bold text-slate-700">
                                  Slug
                                </span>

                                <input
                                  name="slug"
                                  placeholder="Leave blank to create automatically"
                                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                                />
                              </label>

                              <label>
                                <span className="mb-1 block text-sm font-bold text-slate-700">
                                  Summary
                                </span>

                                <textarea
                                  name="summary"
                                  rows={2}
                                  placeholder="Short lesson summary"
                                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                                />
                              </label>

                              <label className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  name="published"
                                  value="true"
                                  className="h-5 w-5"
                                />

                                <span className="font-semibold text-slate-700">
                                  Publish immediately
                                </span>
                              </label>

                              <button
                                type="submit"
                                className="rounded-lg bg-[#1C1F23] px-5 py-3 font-bold text-white hover:bg-black"
                              >
                                Create Lesson
                              </button>
                            </div>
                          </form>
                        </details>

                        <Link
                          href={`/admin/learning/${course.slug}/${module.slug}/quiz`}
                          className="inline-flex items-center justify-center rounded-lg bg-[#1C1F23] px-4 py-2 text-sm font-bold text-white hover:bg-black"
                        >
                          Edit Test
                        </Link>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {(
                        module.learning_lessons ??
                        []
                      ).map((lesson) => (
                        <Link
                          key={lesson.id}
                          href={`/admin/learning/${course.slug}/${module.slug}/${lesson.slug}`}
                          className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 transition hover:border-sky-400 hover:bg-[#EEF8FF]"
                        >
                          <span className="font-semibold text-slate-800">
                            {
                              lesson.title
                            }
                          </span>

                          <span className="flex shrink-0 items-center gap-2">
                            <Status
                              published={
                                lesson.published
                              }
                            />

                            <span className="text-sm font-bold text-sky-700">
                              Edit →
                            </span>
                          </span>
                        </Link>
                      ))}

                      {(
                        module.learning_lessons ??
                        []
                      ).length === 0 && (
                        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">
                          No lessons yet. Use
                          + Add Lesson.
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {(
                  course.learning_modules ??
                  []
                ).length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-slate-500">
                    No modules yet. Use
                    + Add Module.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-8 overflow-hidden rounded-2xl bg-white shadow">
        <div className="border-b border-slate-200 p-5">
          <h3 className="text-xl font-bold">
            Student progress
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-sm uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">
                  Student
                </th>

                <th className="px-5 py-3">
                  Modules passed
                </th>

                <th className="px-5 py-3">
                  Best score
                </th>

                <th className="px-5 py-3">
                  Attempts
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {(students ?? []).map(
                (student) => {
                  const studentAttempts =
                    attemptsByStudent.get(
                      student.id
                    ) ?? [];

                  const passedCount =
                    new Set(
                      studentAttempts
                        .filter(
                          (attempt) =>
                            attempt.passed
                        )
                        .map(
                          (attempt) =>
                            attempt.module_id
                        )
                    ).size;

                  const best =
                    studentAttempts.length
                      ? Math.max(
                          ...studentAttempts.map(
                            (attempt) =>
                              attempt.score
                          )
                        )
                      : null;

                  const label =
                    student.full_name ||
                    (student.username
                      ? `@${student.username}`
                      : student.email) ||
                    "Student";

                  return (
                    <tr
                      key={
                        student.id
                      }
                    >
                      <td className="px-5 py-4 font-semibold">
                        {label}
                      </td>

                      <td className="px-5 py-4">
                        {passedCount} /{" "}
                        {
                          publishedModules.length
                        }
                      </td>

                      <td className="px-5 py-4">
                        {best === null
                          ? "—"
                          : `${best}%`}
                      </td>

                      <td className="px-5 py-4">
                        {
                          studentAttempts.length
                        }
                      </td>
                    </tr>
                  );
                }
              )}

              {(students ?? [])
                .length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-8 text-center text-slate-500"
                  >
                    No student profiles
                    found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow">
      <div className="text-sm font-bold uppercase tracking-wide text-slate-500">
        {label}
      </div>

      <div className="mt-2 text-4xl font-bold text-[#1C1F23]">
        {value}
      </div>
    </div>
  );
}

function Status({
  published,
}: {
  published: boolean;
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
        published
          ? "bg-emerald-100 text-emerald-800"
          : "bg-slate-200 text-slate-600"
      }`}
    >
      {published
        ? "Published"
        : "Draft"}
    </span>
  );
}