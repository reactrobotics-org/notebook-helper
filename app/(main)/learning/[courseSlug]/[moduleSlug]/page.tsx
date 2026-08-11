import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import {
  CheckCircle2,
  Eye,
  LockKeyhole,
} from "lucide-react";
import { createClient } from "@/utils/supabase/server";

function renderLessonContent(content: string) {
  if (content.trim().startsWith("<")) {
    return (
      <div
        className="
          lesson-rich-content

          [&_h1]:mb-4
          [&_h1]:mt-6
          [&_h1]:text-3xl
          [&_h1]:font-bold
          [&_h1]:text-[#1C1F23]

          [&_h2]:mb-3
          [&_h2]:mt-6
          [&_h2]:text-2xl
          [&_h2]:font-bold
          [&_h2]:text-[#1C1F23]

          [&_h3]:mb-2
          [&_h3]:mt-5
          [&_h3]:text-xl
          [&_h3]:font-bold
          [&_h3]:text-[#1C1F23]

          [&_p]:mb-4

          [&_ul]:mb-4
          [&_ul]:list-disc
          [&_ul]:pl-6

          [&_ol]:mb-4
          [&_ol]:list-decimal
          [&_ol]:pl-6

          [&_li]:mb-1

          [&_a]:font-semibold
          [&_a]:text-sky-700
          [&_a]:underline

          [&_img]:my-5
          [&_img]:h-auto
          [&_img]:max-w-full
          [&_img]:rounded-xl

          [&_blockquote]:my-4
          [&_blockquote]:border-l-4
          [&_blockquote]:border-sky-300
          [&_blockquote]:pl-4

          [&_hr]:my-6
          [&_hr]:border-slate-200
        "
        dangerouslySetInnerHTML={{
          __html: content,
        }}
      />
    );
  }

  const blocks = content
    .split("\n\n")
    .filter(Boolean);

  return blocks.map((block, index) => {
    if (block.startsWith("## ")) {
      return (
        <h3
          key={index}
          className="pt-2 text-xl font-bold text-[#1C1F23]"
        >
          {block.slice(3)}
        </h3>
      );
    }

    if (block.startsWith("- ")) {
      return (
        <ul
          key={index}
          className="list-disc space-y-2 pl-6"
        >
          {block.split("\n").map((item) => (
            <li key={item}>
              {item.replace(/^- /, "")}
            </li>
          ))}
        </ul>
      );
    }

    return <p key={index}>{block}</p>;
  });
}

async function completeLesson(
  formData: FormData
) {
  "use server";

  const lessonId = String(
    formData.get("lesson_id") ?? ""
  );

  const courseSlug = String(
    formData.get("course_slug") ?? ""
  );

  const moduleSlug = String(
    formData.get("module_slug") ?? ""
  );

  const nextLessonSlug = String(
    formData.get("next_lesson_slug") ?? ""
  );

  if (
    !lessonId ||
    !courseSlug ||
    !moduleSlug
  ) {
    return;
  }

  const supabase = await createClient();

  const { data: claimsData } =
    await supabase.auth.getClaims();

  const userId =
    claimsData?.claims?.sub;

  if (!userId) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("learning_lesson_progress")
    .upsert(
      {
        user_id: userId,
        lesson_id: lessonId,
      },
      {
        onConflict:
          "user_id,lesson_id",
      }
    );

  if (error) {
    throw new Error(
      `Unable to complete lesson: ${error.message}`
    );
  }

  revalidatePath(
    `/learning/${courseSlug}/${moduleSlug}`
  );

  revalidatePath(
    `/learning/${courseSlug}`
  );

  revalidatePath("/learning");

  if (nextLessonSlug) {
    redirect(
      `/learning/${courseSlug}/${moduleSlug}?lesson=${encodeURIComponent(
        nextLessonSlug
      )}`
    );
  }

  redirect(
    `/learning/${courseSlug}/${moduleSlug}`
  );
}

export default async function ModulePage({
  params,
  searchParams,
}: {
  params: Promise<{
    courseSlug: string;
    moduleSlug: string;
  }>;

  searchParams?: Promise<{
    lesson?: string;
  }>;
}) {
  const {
    courseSlug,
    moduleSlug,
  } = await params;

  const query =
    await searchParams;

  const requestedLessonSlug =
    query?.lesson?.trim() ?? "";

  const supabase =
    await createClient();

  const { data: claimsData } =
    await supabase.auth.getClaims();

  const userId =
    claimsData?.claims?.sub;

  if (!userId) {
    redirect("/login");
  }

  /*
   * Determine whether this person
   * is the Board reviewer.
   */
  const { data: profile } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

  const role = (
    profile?.role ?? ""
  ).toLowerCase();

  const isReviewer =
    role === "reviewer";

  /*
   * Load the requested module.
   *
   * Students:
   *   published modules only
   *
   * Reviewer:
   *   published + draft modules
   */
  let moduleQuery = supabase
    .from("learning_modules")
    .select(
      `
        id,
        slug,
        title,
        description,
        passing_score,
        sort_order,
        course_id,
        published,
        learning_courses!inner (
          id,
          slug,
          title,
          published
        )
      `
    )
    .eq("slug", moduleSlug)
    .eq(
      "learning_courses.slug",
      courseSlug
    );

  if (!isReviewer) {
    moduleQuery =
      moduleQuery
        .eq("published", true)
        .eq(
          "learning_courses.published",
          true
        );
  }

  const {
    data: moduleData,
    error: moduleError,
  } =
    await moduleQuery.maybeSingle();

  if (
    moduleError ||
    !moduleData
  ) {
    notFound();
  }

  const courseRelation =
    moduleData.learning_courses;

  const course =
    Array.isArray(courseRelation)
      ? courseRelation[0]
      : courseRelation;

  if (!course) {
    notFound();
  }

  /*
   * Previous module.
   *
   * Reviewer can see drafts.
   */
  let previousModuleQuery =
    supabase
      .from("learning_modules")
      .select("id")
      .eq(
        "course_id",
        moduleData.course_id
      )
      .lt(
        "sort_order",
        moduleData.sort_order
      )
      .order("sort_order", {
        ascending: false,
      })
      .limit(1);

  if (!isReviewer) {
    previousModuleQuery =
      previousModuleQuery.eq(
        "published",
        true
      );
  }

  /*
   * Lessons.
   *
   * Reviewer can see drafts.
   */
  let lessonQuery =
    supabase
      .from("learning_lessons")
      .select(
        `
          id,
          slug,
          title,
          summary,
          content,
          sort_order,
          published
        `
      )
      .eq(
        "module_id",
        moduleData.id
      )
      .order("sort_order", {
        ascending: true,
      });

  if (!isReviewer) {
    lessonQuery =
      lessonQuery.eq(
        "published",
        true
      );
  }

  const [
    { data: previousModules },
    { data: lessons },
  ] = await Promise.all([
    previousModuleQuery,
    lessonQuery,
  ]);

  const previousModuleId =
    previousModules?.[0]?.id ??
    null;

  const lessonList =
    lessons ?? [];

  const lessonIds =
    lessonList.map(
      (lesson) =>
        lesson.id
    );

  const [
    { data: progress },
    { data: attempts },
    { data: previousPass },
  ] = await Promise.all([
    lessonIds.length
      ? supabase
          .from(
            "learning_lesson_progress"
          )
          .select(
            "lesson_id"
          )
          .eq(
            "user_id",
            userId
          )
          .in(
            "lesson_id",
            lessonIds
          )
      : Promise.resolve({
          data: [] as {
            lesson_id: string;
          }[],
        }),

    supabase
      .from(
        "learning_quiz_attempts"
      )
      .select(
        "score, passed, created_at"
      )
      .eq(
        "user_id",
        userId
      )
      .eq(
        "module_id",
        moduleData.id
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      ),

    previousModuleId &&
    !isReviewer
      ? supabase
          .from(
            "learning_quiz_attempts"
          )
          .select("id")
          .eq(
            "user_id",
            userId
          )
          .eq(
            "module_id",
            previousModuleId
          )
          .eq(
            "passed",
            true
          )
          .limit(1)
      : Promise.resolve({
          data: [] as {
            id: string;
          }[],
        }),
  ]);

  /*
   * Normal students must still pass
   * the previous module.
   *
   * Reviewer bypasses this.
   */
  if (
    !isReviewer &&
    previousModuleId &&
    !previousPass?.length
  ) {
    redirect(
      `/learning/${courseSlug}`
    );
  }

  const completed =
    new Set(
      (progress ?? []).map(
        (row) =>
          row.lesson_id
      )
    );

  /*
   * Normal student progression.
   */
  const firstIncompleteIndex =
    lessonList.findIndex(
      (lesson) =>
        !completed.has(
          lesson.id
        )
    );

  const studentUnlockedIndex =
    firstIncompleteIndex === -1
      ? Math.max(
          lessonList.length - 1,
          0
        )
      : firstIncompleteIndex;

  /*
   * Reviewer can open every lesson.
   */
  const furthestUnlockedIndex =
    isReviewer
      ? Math.max(
          lessonList.length - 1,
          0
        )
      : studentUnlockedIndex;

  /*
   * Reviewer starts at Lesson 1
   * unless a lesson is requested.
   *
   * Students start at their first
   * incomplete lesson.
   */
  let currentLessonIndex =
    isReviewer
      ? 0
      : furthestUnlockedIndex;

  if (requestedLessonSlug) {
    const requestedIndex =
      lessonList.findIndex(
        (lesson) =>
          lesson.slug ===
          requestedLessonSlug
      );

    if (
      requestedIndex >= 0 &&
      (
        isReviewer ||
        requestedIndex <=
          furthestUnlockedIndex
      )
    ) {
      currentLessonIndex =
        requestedIndex;
    }
  }

  const currentLesson =
    lessonList[
      currentLessonIndex
    ] ?? null;

  const previousLesson =
    currentLessonIndex > 0
      ? lessonList[
          currentLessonIndex - 1
        ]
      : null;

  const nextLesson =
    currentLessonIndex <
    lessonList.length - 1
      ? lessonList[
          currentLessonIndex + 1
        ]
      : null;

  const currentLessonComplete =
    currentLesson
      ? completed.has(
          currentLesson.id
        )
      : false;

  const completedCount =
    lessonList.filter(
      (lesson) =>
        completed.has(
          lesson.id
        )
    ).length;

  const allComplete =
    lessonIds.length > 0 &&
    lessonIds.every(
      (id) =>
        completed.has(id)
    );

  const passed =
    (attempts ?? []).some(
      (attempt) =>
        attempt.passed
    );

  const best =
    (attempts ?? []).reduce(
      (
        highest,
        attempt
      ) =>
        Math.max(
          highest,
          attempt.score
        ),
      0
    );

  return (
    <main className="min-h-dvh bg-[#F5F7FA] p-6 md:p-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href={`/learning/${courseSlug}`}
          className="font-semibold text-slate-600 hover:text-black"
        >
          ← {course.title}
        </Link>

        {isReviewer && (
          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-amber-900">
            <Eye
              size={22}
              className="shrink-0"
            />

            <div>
              <div className="font-bold">
                BOARD PREVIEW
              </div>

              <div className="text-sm">
                Draft lessons are
                visible and lesson
                completion requirements
                are disabled.
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 rounded-2xl bg-[#1C1F23] p-7 text-white shadow">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold md:text-4xl">
              {moduleData.title}
            </h1>

            {isReviewer &&
              !moduleData.published && (
                <span className="rounded-full bg-amber-300 px-3 py-1 text-xs font-bold text-amber-950">
                  DRAFT MODULE
                </span>
              )}
          </div>

          {moduleData.description && (
            <p className="mt-2 max-w-3xl text-slate-300">
              {
                moduleData.description
              }
            </p>
          )}

          {!isReviewer && (
            <div className="mt-5">
              <div className="flex items-center justify-between text-sm font-semibold text-slate-300">
                <span>
                  {completedCount} of{" "}
                  {lessonIds.length}{" "}
                  lessons complete
                </span>

                <span>
                  {lessonIds.length
                    ? Math.round(
                        (completedCount /
                          lessonIds.length) *
                          100
                      )
                    : 0}
                  %
                </span>
              </div>

              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-700">
                <div
                  className="h-full rounded-full bg-[#8ED4FF]"
                  style={{
                    width: `${
                      lessonIds.length
                        ? (completedCount /
                            lessonIds.length) *
                          100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {currentLesson ? (
          <section className="mt-8 rounded-2xl bg-white p-7 shadow">
            {/* TOP NAVIGATION */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              {previousLesson ? (
                <Link
                  href={`/learning/${courseSlug}/${moduleSlug}?lesson=${encodeURIComponent(
                    previousLesson.slug
                  )}`}
                  className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-[#1C1F23] transition hover:bg-slate-50"
                >
                  ← Previous Lesson
                </Link>
              ) : (
                <div />
              )}

              {isReviewer &&
                nextLesson && (
                  <Link
                    href={`/learning/${courseSlug}/${moduleSlug}?lesson=${encodeURIComponent(
                      nextLesson.slug
                    )}`}
                    className="inline-flex items-center rounded-xl bg-[#8ED4FF] px-4 py-2 text-sm font-bold text-[#1C1F23] hover:bg-[#74C7FA]"
                  >
                    Next Lesson →
                  </Link>
                )}
            </div>

            <div className="border-b border-slate-200 pb-5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-sm font-bold uppercase tracking-wide text-sky-700">
                  Lesson{" "}
                  {currentLessonIndex +
                    1}{" "}
                  of{" "}
                  {lessonIds.length}
                </div>

                {isReviewer &&
                  !currentLesson.published && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                      DRAFT
                    </span>
                  )}
              </div>

              <h2 className="mt-1 text-3xl font-bold text-[#1C1F23]">
                {
                  currentLesson.title
                }
              </h2>

              {currentLesson.summary && (
                <p className="mt-2 font-medium text-slate-600">
                  {
                    currentLesson.summary
                  }
                </p>
              )}
            </div>

            <div className="mt-6 space-y-4 text-base leading-7 text-slate-700">
              {renderLessonContent(
                currentLesson.content
              )}
            </div>

            <div className="mt-8 border-t border-slate-200 pt-6">
              {isReviewer ? (
                /*
                 * Reviewer navigation does
                 * not write lesson progress.
                 */
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {previousLesson ? (
                    <Link
                      href={`/learning/${courseSlug}/${moduleSlug}?lesson=${encodeURIComponent(
                        previousLesson.slug
                      )}`}
                      className="rounded-xl border border-slate-300 px-5 py-3 text-center font-bold text-[#1C1F23] hover:bg-slate-50"
                    >
                      ← Previous Lesson
                    </Link>
                  ) : (
                    <div />
                  )}

                  {nextLesson ? (
                    <Link
                      href={`/learning/${courseSlug}/${moduleSlug}?lesson=${encodeURIComponent(
                        nextLesson.slug
                      )}`}
                      className="rounded-xl bg-[#8ED4FF] px-5 py-3 text-center font-bold text-[#1C1F23] hover:bg-[#74C7FA]"
                    >
                      Next Lesson →
                    </Link>
                  ) : (
                    <Link
                      href={`/learning/${courseSlug}/${moduleSlug}/quiz`}
                      className="rounded-xl bg-[#1C1F23] px-5 py-3 text-center font-bold text-white hover:bg-black"
                    >
                      Review Module Test →
                    </Link>
                  )}
                </div>
              ) : !currentLessonComplete ? (
                <form
                  action={
                    completeLesson
                  }
                >
                  <input
                    type="hidden"
                    name="lesson_id"
                    value={
                      currentLesson.id
                    }
                  />

                  <input
                    type="hidden"
                    name="course_slug"
                    value={
                      courseSlug
                    }
                  />

                  <input
                    type="hidden"
                    name="module_slug"
                    value={
                      moduleSlug
                    }
                  />

                  <input
                    type="hidden"
                    name="next_lesson_slug"
                    value={
                      nextLesson?.slug ??
                      ""
                    }
                  />

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    {previousLesson ? (
                      <Link
                        href={`/learning/${courseSlug}/${moduleSlug}?lesson=${encodeURIComponent(
                          previousLesson.slug
                        )}`}
                        className="rounded-xl border border-slate-300 px-5 py-3 text-center font-bold text-[#1C1F23] hover:bg-slate-50"
                      >
                        ← Previous Lesson
                      </Link>
                    ) : (
                      <div />
                    )}

                    <button
                      type="submit"
                      className="rounded-xl bg-[#8ED4FF] px-6 py-3 font-bold text-[#1C1F23] hover:bg-[#74C7FA]"
                    >
                      {nextLesson
                        ? `Complete & Continue to Lesson ${
                            currentLessonIndex +
                            2
                          } →`
                        : "Complete Final Lesson →"}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 font-bold text-emerald-700">
                    <CheckCircle2
                      size={20}
                    />
                    Lesson complete
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    {previousLesson && (
                      <Link
                        href={`/learning/${courseSlug}/${moduleSlug}?lesson=${encodeURIComponent(
                          previousLesson.slug
                        )}`}
                        className="rounded-xl border border-slate-300 px-5 py-3 text-center font-bold text-[#1C1F23] hover:bg-slate-50"
                      >
                        ← Previous Lesson
                      </Link>
                    )}

                    {nextLesson &&
                      currentLessonIndex <
                        furthestUnlockedIndex && (
                        <Link
                          href={`/learning/${courseSlug}/${moduleSlug}?lesson=${encodeURIComponent(
                            nextLesson.slug
                          )}`}
                          className="rounded-xl bg-[#8ED4FF] px-5 py-3 text-center font-bold text-[#1C1F23] hover:bg-[#74C7FA]"
                        >
                          Next Lesson →
                        </Link>
                      )}
                  </div>
                </div>
              )}
            </div>
          </section>
        ) : (
          <section className="mt-8 rounded-2xl bg-white p-7 shadow">
            <p className="text-slate-600">
              There are currently no
              lessons in this module.
            </p>
          </section>
        )}

        <section className="mt-8 rounded-2xl bg-white p-7 shadow">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[#1C1F23]">
                Module Test
              </h2>

              <p className="mt-1 text-slate-600">
                {isReviewer
                  ? "Board preview can open the test without completing the lessons."
                  : passed
                    ? `Passed · Best score ${best}%`
                    : allComplete
                      ? "All lessons complete. You are ready to test."
                      : `${completedCount} of ${lessonIds.length} lessons complete.`}
              </p>
            </div>

            {isReviewer ||
            allComplete ? (
              <Link
                href={`/learning/${courseSlug}/${moduleSlug}/quiz`}
                className="rounded-xl bg-[#1C1F23] px-6 py-3 text-center font-bold text-white hover:bg-black"
              >
                {isReviewer
                  ? "Review module test"
                  : passed
                    ? "Retake test"
                    : "Take module test"}
              </Link>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-5 py-3 font-semibold text-slate-500">
                <LockKeyhole
                  size={18}
                />
                Test locked
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}