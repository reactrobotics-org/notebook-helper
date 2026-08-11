import Link from "next/link";
import { revalidatePath } from "next/cache";
import {
  notFound,
  redirect,
} from "next/navigation";
import {
  CheckCircle2,
  Eye,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

async function submitQuiz(
  formData: FormData
) {
  "use server";

  const courseSlug =
    String(
      formData.get(
        "course_slug"
      ) ?? ""
    );

  const moduleSlug =
    String(
      formData.get(
        "module_slug"
      ) ?? ""
    );

  const moduleId =
    String(
      formData.get(
        "module_id"
      ) ?? ""
    );

  if (
    !courseSlug ||
    !moduleSlug ||
    !moduleId
  ) {
    return;
  }

  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  /*
   * Check reviewer role.
   */
  const { data: profile } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  const isReviewer =
    (
      profile?.role ?? ""
    ).toLowerCase() ===
    "reviewer";

  /*
   * Module lookup.
   */
  let moduleQuery =
    supabase
      .from(
        "learning_modules"
      )
      .select(
        `
          id,
          passing_score,
          course_id,
          published
        `
      )
      .eq(
        "id",
        moduleId
      )
      .eq(
        "slug",
        moduleSlug
      );

  if (!isReviewer) {
    moduleQuery =
      moduleQuery.eq(
        "published",
        true
      );
  }

  const {
    data: module,
  } =
    await moduleQuery.maybeSingle();

  if (!module) {
    notFound();
  }

  /*
   * Course lookup.
   */
  let courseQuery =
    supabase
      .from(
        "learning_courses"
      )
      .select(
        "id, published"
      )
      .eq(
        "id",
        module.course_id
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
   * Students must complete all
   * published lessons.
   *
   * Reviewer bypasses this.
   */
  if (!isReviewer) {
    const {
      data: lessons,
    } =
      await supabase
        .from(
          "learning_lessons"
        )
        .select("id")
        .eq(
          "module_id",
          moduleId
        )
        .eq(
          "published",
          true
        );

    const lessonIds =
      (lessons ?? []).map(
        (lesson) =>
          lesson.id
      );

    const {
      data: progress,
    } = lessonIds.length
      ? await supabase
          .from(
            "learning_lesson_progress"
          )
          .select(
            "lesson_id"
          )
          .eq(
            "user_id",
            user.id
          )
          .in(
            "lesson_id",
            lessonIds
          )
      : {
          data: [] as {
            lesson_id: string;
          }[],
        };

    const completed =
      new Set(
        (progress ?? []).map(
          (row) =>
            row.lesson_id
        )
      );

    if (
      !lessonIds.length ||
      !lessonIds.every(
        (id) =>
          completed.has(id)
      )
    ) {
      redirect(
        `/learning/${courseSlug}/${moduleSlug}`
      );
    }
  }

  /*
   * Use server-only admin client
   * to grade answers.
   */
  const admin =
    createAdminClient();

  let questionQuery =
    admin
      .from(
        "learning_questions"
      )
      .select(
        `
          id,
          published
        `
      )
      .eq(
        "module_id",
        moduleId
      )
      .order(
        "sort_order",
        {
          ascending: true,
        }
      );

  if (!isReviewer) {
    questionQuery =
      questionQuery.eq(
        "published",
        true
      );
  }

  const {
    data: questions,
  } = await questionQuery;

  const questionIds =
    (questions ?? []).map(
      (question) =>
        question.id
    );

  if (!questionIds.length) {
    redirect(
      `/learning/${courseSlug}/${moduleSlug}?error=no_quiz`
    );
  }

  const {
    data: keys,
  } =
    await admin
      .from(
        "learning_answer_keys"
      )
      .select(
        `
          question_id,
          correct_option_key
        `
      )
      .in(
        "question_id",
        questionIds
      );

  const keyMap =
    new Map(
      (keys ?? []).map(
        (key) => [
          key.question_id,
          key.correct_option_key,
        ]
      )
    );

  const answers:
    Record<string, string> =
    {};

  let correct = 0;

  for (
    const questionId of
    questionIds
  ) {
    const answer =
      String(
        formData.get(
          `q_${questionId}`
        ) ?? ""
      );

    answers[
      questionId
    ] = answer;

    if (
      answer &&
      answer ===
        keyMap.get(
          questionId
        )
    ) {
      correct += 1;
    }
  }

  const score =
    Math.round(
      (correct /
        questionIds.length) *
        100
    );

  const passed =
    score >=
    module.passing_score;

  /*
   * Reviewer attempts are allowed.
   * They only affect the reviewer's
   * own account.
   */
  const { error } =
    await supabase
      .from(
        "learning_quiz_attempts"
      )
      .insert({
        user_id:
          user.id,

        module_id:
          moduleId,

        score,

        passed,

        answers,
      });

  if (error) {
    redirect(
      `/learning/${courseSlug}/${moduleSlug}/quiz?error=save_failed`
    );
  }

  revalidatePath(
    "/learning"
  );

  revalidatePath(
    `/learning/${courseSlug}`
  );

  revalidatePath(
    `/learning/${courseSlug}/${moduleSlug}`
  );

  redirect(
    `/learning/${courseSlug}/${moduleSlug}/quiz?result=${
      passed
        ? "passed"
        : "failed"
    }&score=${score}`
  );
}

export default async function QuizPage({
  params,
  searchParams,
}: {
  params: Promise<{
    courseSlug: string;
    moduleSlug: string;
  }>;

  searchParams?: Promise<{
    result?: string;
    score?: string;
    error?: string;
  }>;
}) {
  const {
    courseSlug,
    moduleSlug,
  } = await params;

  const query =
    await searchParams;

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

  const isReviewer =
    (
      profile?.role ?? ""
    ).toLowerCase() ===
    "reviewer";

  /*
   * Course
   */
  let courseQuery =
    supabase
      .from(
        "learning_courses"
      )
      .select(
        `
          id,
          title,
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
   * Module
   */
  let moduleQuery =
    supabase
      .from(
        "learning_modules"
      )
      .select(
        `
          id,
          title,
          passing_score,
          published
        `
      )
      .eq(
        "course_id",
        course.id
      )
      .eq(
        "slug",
        moduleSlug
      );

  if (!isReviewer) {
    moduleQuery =
      moduleQuery.eq(
        "published",
        true
      );
  }

  const {
    data: module,
  } =
    await moduleQuery.maybeSingle();

  if (!module) {
    notFound();
  }

  /*
   * Normal students must finish
   * the lessons before testing.
   */
  if (!isReviewer) {
    const {
      data: lessons,
    } =
      await supabase
        .from(
          "learning_lessons"
        )
        .select("id")
        .eq(
          "module_id",
          module.id
        )
        .eq(
          "published",
          true
        );

    const lessonIds =
      (lessons ?? []).map(
        (lesson) =>
          lesson.id
      );

    const {
      data: progress,
    } = lessonIds.length
      ? await supabase
          .from(
            "learning_lesson_progress"
          )
          .select(
            "lesson_id"
          )
          .eq(
            "user_id",
            user.id
          )
          .in(
            "lesson_id",
            lessonIds
          )
      : {
          data: [] as {
            lesson_id: string;
          }[],
        };

    const completed =
      new Set(
        (progress ?? []).map(
          (row) =>
            row.lesson_id
        )
      );

    if (
      !lessonIds.length ||
      !lessonIds.every(
        (id) =>
          completed.has(id)
      )
    ) {
      redirect(
        `/learning/${courseSlug}/${moduleSlug}`
      );
    }
  }

  /*
   * Questions
   */
  let questionQuery =
    supabase
      .from(
        "learning_questions"
      )
      .select(
        `
          id,
          prompt,
          sort_order,
          published
        `
      )
      .eq(
        "module_id",
        module.id
      )
      .order(
        "sort_order",
        {
          ascending: true,
        }
      );

  if (!isReviewer) {
    questionQuery =
      questionQuery.eq(
        "published",
        true
      );
  }

  const {
    data: questions,
  } = await questionQuery;

  const questionIds =
    (questions ?? []).map(
      (question) =>
        question.id
    );

  const {
    data: options,
  } = questionIds.length
    ? await supabase
        .from(
          "learning_question_options"
        )
        .select(
          `
            id,
            question_id,
            option_key,
            label,
            sort_order
          `
        )
        .in(
          "question_id",
          questionIds
        )
        .order(
          "sort_order",
          {
            ascending: true,
          }
        )
    : {
        data: [] as {
          id: string;
          question_id: string;
          option_key: string;
          label: string;
          sort_order: number;
        }[],
      };

  if (query?.result) {
    const passed =
      query.result ===
      "passed";

    return (
      <main className="min-h-dvh bg-[#F5F7FA] p-6 md:p-8">
        <div className="mx-auto max-w-2xl">
          {isReviewer && (
            <div className="mb-5 flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-amber-900">
              <Eye
                size={22}
              />

              <div>
                <div className="font-bold">
                  BOARD PREVIEW
                </div>

                <div className="text-sm">
                  This result applies
                  only to the reviewer
                  account.
                </div>
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-white p-8 text-center shadow">
            {passed ? (
              <CheckCircle2
                size={64}
                className="mx-auto text-emerald-600"
              />
            ) : (
              <XCircle
                size={64}
                className="mx-auto text-rose-600"
              />
            )}

            <h1 className="mt-5 text-4xl font-bold text-[#1C1F23]">
              {passed
                ? "Module passed!"
                : "Keep working on it"}
            </h1>

            <div className="mt-3 text-6xl font-bold text-[#1C1F23]">
              {query.score}%
            </div>

            <p className="mt-4 text-slate-600">
              {isReviewer
                ? "Board preview test result."
                : passed
                  ? "The next module is now unlocked."
                  : `You need ${module.passing_score}% to pass. Review the lessons and try again.`}
            </p>

            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href={`/learning/${courseSlug}`}
                className="rounded-xl bg-[#1C1F23] px-5 py-3 font-bold text-white"
              >
                Course overview
              </Link>

              <Link
                href={`/learning/${courseSlug}/${moduleSlug}`}
                className="rounded-xl border border-slate-300 px-5 py-3 font-bold text-[#1C1F23]"
              >
                Review lessons
              </Link>

              <Link
                href={`/learning/${courseSlug}/${moduleSlug}/quiz`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#8ED4FF] px-5 py-3 font-bold text-[#1C1F23]"
              >
                <RotateCcw
                  size={18}
                />

                Try again
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#F5F7FA] p-6 md:p-8">
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/learning/${courseSlug}/${moduleSlug}`}
          className="font-semibold text-slate-600 hover:text-black"
        >
          ← Back to lessons
        </Link>

        {isReviewer && (
          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-amber-900">
            <Eye
              size={22}
            />

            <div>
              <div className="font-bold">
                BOARD PREVIEW
              </div>

              <div className="text-sm">
                Draft test questions
                are visible.
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <h1 className="text-4xl font-bold text-[#1C1F23]">
            {module.title} Test
          </h1>

          {isReviewer &&
            !module.published && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                DRAFT MODULE
              </span>
            )}
        </div>

        <p className="mt-2 text-slate-600">
          Choose the best answer
          for every question. A
          score of{" "}
          {module.passing_score}%
          or better passes this
          module.
        </p>

        {query?.error && (
          <div className="mt-5 rounded-xl bg-rose-50 p-4 font-semibold text-rose-700">
            Your attempt could not
            be saved. Please try
            again.
          </div>
        )}

        {(questions ?? [])
          .length === 0 ? (
          <div className="mt-8 rounded-2xl bg-white p-7 text-slate-600 shadow">
            No test questions have
            been created for this
            module yet.
          </div>
        ) : (
          <form
            action={submitQuiz}
            className="mt-8 space-y-6"
          >
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
              name="module_id"
              value={
                module.id
              }
            />

            {(questions ?? []).map(
              (
                question,
                index
              ) => (
                <section
                  key={
                    question.id
                  }
                  className="rounded-2xl bg-white p-6 shadow"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h2 className="text-xl font-bold text-[#1C1F23]">
                      {index +
                        1}
                      .{" "}
                      {
                        question.prompt
                      }
                    </h2>

                    {isReviewer &&
                      !question.published && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                          DRAFT
                        </span>
                      )}
                  </div>

                  <div className="mt-5 space-y-3">
                    {(options ?? [])
                      .filter(
                        (
                          option
                        ) =>
                          option.question_id ===
                          question.id
                      )
                      .map(
                        (
                          option
                        ) => (
                          <label
                            key={
                              option.id
                            }
                            className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-4 hover:bg-slate-50"
                          >
                            <input
                              required
                              type="radio"
                              name={`q_${question.id}`}
                              value={
                                option.option_key
                              }
                              className="mt-1 h-4 w-4"
                            />

                            <span className="font-medium text-slate-700">
                              {
                                option.label
                              }
                            </span>
                          </label>
                        )
                      )}
                  </div>
                </section>
              )
            )}

            <button
              type="submit"
              className="w-full rounded-xl bg-[#1C1F23] px-6 py-4 text-lg font-bold text-white hover:bg-black"
            >
              {isReviewer
                ? "Submit Preview Test"
                : "Submit test"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}