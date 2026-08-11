import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";
import {
  CheckCircle2,
  Circle,
  Eye,
  LockKeyhole,
} from "lucide-react";
import { createClient } from "@/utils/supabase/server";

export default async function CoursePage({
  params,
}: {
  params: Promise<{
    courseSlug: string;
  }>;
}) {
  const { courseSlug } =
    await params;

  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  const role = (
    profile?.role ?? ""
  ).toLowerCase();

  const isReviewer =
    role === "reviewer";

  /*
   * Course
   */
  let courseQuery = supabase
    .from("learning_courses")
    .select(
      `
        id,
        slug,
        title,
        description,
        published
      `
    )
    .eq(
      "slug",
      courseSlug
    );

  if (!isReviewer) {
    courseQuery =
      courseQuery.eq(
        "published",
        true
      );
  }

  const {
    data: course,
  } =
    await courseQuery.maybeSingle();

  if (!course) {
    notFound();
  }

  /*
   * Modules
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
        published
      `
    )
    .eq(
      "course_id",
      course.id
    )
    .order("sort_order", {
      ascending: true,
    });

  if (!isReviewer) {
    moduleQuery =
      moduleQuery.eq(
        "published",
        true
      );
  }

  const {
    data: modules,
  } = await moduleQuery;

  const moduleIds =
    (modules ?? []).map(
      (module) =>
        module.id
    );

  /*
   * Lessons
   */
  let lessonsPromise;

  if (moduleIds.length) {
    let lessonQuery =
      supabase
        .from(
          "learning_lessons"
        )
        .select(
          `
            id,
            module_id,
            published
          `
        )
        .in(
          "module_id",
          moduleIds
        );

    if (!isReviewer) {
      lessonQuery =
        lessonQuery.eq(
          "published",
          true
        );
    }

    lessonsPromise =
      lessonQuery;
  } else {
    lessonsPromise =
      Promise.resolve({
        data: [] as {
          id: string;
          module_id: string;
          published: boolean;
        }[],
      });
  }

  const [
    { data: lessons },
    { data: progress },
    { data: attempts },
  ] = await Promise.all([
    lessonsPromise,

    supabase
      .from(
        "learning_lesson_progress"
      )
      .select("lesson_id")
      .eq(
        "user_id",
        user.id
      ),

    moduleIds.length
      ? supabase
          .from(
            "learning_quiz_attempts"
          )
          .select(
            `
              module_id,
              score,
              passed
            `
          )
          .eq(
            "user_id",
            user.id
          )
          .in(
            "module_id",
            moduleIds
          )
          .order(
            "created_at",
            {
              ascending: false,
            }
          )
      : Promise.resolve({
          data: [] as {
            module_id: string;
            score: number;
            passed: boolean;
          }[],
        }),
  ]);

  const completedLessons =
    new Set(
      (progress ?? []).map(
        (row) =>
          row.lesson_id
      )
    );

  const passedModules =
    new Set(
      (attempts ?? [])
        .filter(
          (row) =>
            row.passed
        )
        .map(
          (row) =>
            row.module_id
        )
    );

  const bestScores =
    new Map<
      string,
      number
    >();

  for (
    const attempt of
    attempts ?? []
  ) {
    bestScores.set(
      attempt.module_id,
      Math.max(
        bestScores.get(
          attempt.module_id
        ) ?? 0,
        attempt.score
      )
    );
  }

  return (
    <main className="min-h-dvh bg-[#F5F7FA] p-6 md:p-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/learning"
          className="font-semibold text-slate-600 hover:text-black"
        >
          ← All courses
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
                Draft modules and
                lessons are visible.
                Progress locks are
                disabled for review.
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <h1 className="text-4xl font-bold text-[#1C1F23]">
            {course.title}
          </h1>

          {isReviewer &&
            !course.published && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-800">
                DRAFT COURSE
              </span>
            )}
        </div>

        <p className="mt-2 max-w-3xl text-lg text-slate-600">
          {
            course.description
          }
        </p>

        <div className="mt-8 space-y-4">
          {(modules ?? []).map(
            (
              module,
              index
            ) => {
              /*
               * Reviewers may open
               * every module.
               *
               * Students must still
               * pass the previous one.
               */
              const unlocked =
                isReviewer ||
                index === 0 ||
                passedModules.has(
                  (
                    modules ??
                    []
                  )[
                    index - 1
                  ].id
                );

              const moduleLessons =
                (
                  lessons ?? []
                ).filter(
                  (lesson) =>
                    lesson.module_id ===
                    module.id
                );

              const completeCount =
                moduleLessons.filter(
                  (lesson) =>
                    completedLessons.has(
                      lesson.id
                    )
                ).length;

              const passed =
                passedModules.has(
                  module.id
                );

              const best =
                bestScores.get(
                  module.id
                );

              const body = (
                <div
                  className={`rounded-2xl border bg-white p-6 shadow-sm ${
                    unlocked
                      ? "border-slate-200"
                      : "border-slate-200 opacity-65"
                  }`}
                >
                  <div className="flex gap-4">
                    <div className="mt-1">
                      {isReviewer ? (
                        <Eye className="text-amber-600" />
                      ) : passed ? (
                        <CheckCircle2 className="text-emerald-600" />
                      ) : unlocked ? (
                        <Circle className="text-[#1C1F23]" />
                      ) : (
                        <LockKeyhole className="text-slate-400" />
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-bold text-[#1C1F23]">
                            {
                              module.title
                            }
                          </h2>

                          {isReviewer &&
                            !module.published && (
                              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                                DRAFT
                              </span>
                            )}
                        </div>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
                          {isReviewer
                            ? `${
                                moduleLessons.length
                              } lesson${
                                moduleLessons.length ===
                                1
                                  ? ""
                                  : "s"
                              }`
                            : `${completeCount}/${moduleLessons.length} lessons`}
                        </span>
                      </div>

                      <p className="mt-2 text-slate-600">
                        {
                          module.description
                        }
                      </p>

                      <div className="mt-4 text-sm font-semibold text-slate-500">
                        {isReviewer
                          ? "Review module →"
                          : passed
                            ? `Passed${
                                best !==
                                undefined
                                  ? ` · Best score ${best}%`
                                  : ""
                              }`
                            : unlocked
                              ? "Open module →"
                              : "Pass the previous module to unlock"}
                      </div>
                    </div>
                  </div>
                </div>
              );

              return unlocked ? (
                <Link
                  key={
                    module.id
                  }
                  href={`/learning/${course.slug}/${module.slug}`}
                  className="block transition hover:-translate-y-0.5"
                >
                  {body}
                </Link>
              ) : (
                <div
                  key={
                    module.id
                  }
                >
                  {body}
                </div>
              );
            }
          )}
        </div>

        {(modules ?? [])
          .length === 0 && (
          <div className="mt-8 rounded-2xl bg-white p-7 text-slate-600 shadow">
            No modules are
            available yet.
          </div>
        )}
      </div>
    </main>
  );
}