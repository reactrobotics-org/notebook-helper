import Link from "next/link";
import { revalidatePath } from "next/cache";
import {
  notFound,
  redirect,
} from "next/navigation";
import {
  CheckCircle2,
  Circle,
  LockKeyhole,
} from "lucide-react";
import { createClient } from "@/utils/supabase/server";

function renderLessonContent(
  content: string
) {
  if (
    content.trim().startsWith("<")
  ) {
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

  return blocks.map(
    (block, index) => {
      if (
        block.startsWith("## ")
      ) {
        return (
          <h3
            key={index}
            className="pt-2 text-xl font-bold text-[#1C1F23]"
          >
            {block.slice(3)}
          </h3>
        );
      }

      if (
        block.startsWith("- ")
      ) {
        return (
          <ul
            key={index}
            className="list-disc space-y-2 pl-6"
          >
            {block
              .split("\n")
              .map((item) => (
                <li key={item}>
                  {item.replace(
                    /^- /,
                    ""
                  )}
                </li>
              ))}
          </ul>
        );
      }

      return (
        <p key={index}>
          {block}
        </p>
      );
    }
  );
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

  if (
    !lessonId ||
    !courseSlug ||
    !moduleSlug
  ) {
    return;
  }

  const supabase =
    await createClient();

  const { data: claimsData } =
    await supabase.auth.getClaims();

  const userId =
    claimsData?.claims?.sub;

  if (!userId) {
    redirect("/login");
  }

  const { error } = await supabase
    .from(
      "learning_lesson_progress"
    )
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
}

export default async function ModulePage({
  params,
}: {
  params: Promise<{
    courseSlug: string;
    moduleSlug: string;
  }>;
}) {
  const {
    courseSlug,
    moduleSlug,
  } = await params;

  const supabase =
    await createClient();

  const { data: claimsData } =
    await supabase.auth.getClaims();

  const userId =
    claimsData?.claims?.sub;

  if (!userId) {
    redirect("/login");
  }

  const {
    data: moduleData,
    error: moduleError,
  } = await supabase
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
        learning_courses!inner (
          id,
          slug,
          title
        )
      `
    )
    .eq("slug", moduleSlug)
    .eq("published", true)
    .eq(
      "learning_courses.slug",
      courseSlug
    )
    .eq(
      "learning_courses.published",
      true
    )
    .maybeSingle();

  if (
    moduleError ||
    !moduleData
  ) {
    notFound();
  }

  const courseRelation =
    moduleData.learning_courses;

  const course = Array.isArray(
    courseRelation
  )
    ? courseRelation[0]
    : courseRelation;

  if (!course) {
    notFound();
  }

  const [
    { data: previousModules },
    { data: lessons },
  ] = await Promise.all([
    supabase
      .from("learning_modules")
      .select("id")
      .eq(
        "course_id",
        moduleData.course_id
      )
      .eq("published", true)
      .lt(
        "sort_order",
        moduleData.sort_order
      )
      .order("sort_order", {
        ascending: false,
      })
      .limit(1),

    supabase
      .from("learning_lessons")
      .select(
        `
          id,
          slug,
          title,
          summary,
          content,
          sort_order
        `
      )
      .eq(
        "module_id",
        moduleData.id
      )
      .eq("published", true)
      .order("sort_order", {
        ascending: true,
      }),
  ]);

  const previousModuleId =
    previousModules?.[0]?.id ??
    null;

  const lessonIds = (
    lessons ?? []
  ).map(
    (lesson) => lesson.id
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
          .select("lesson_id")
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
      .order("created_at", {
        ascending: false,
      }),

    previousModuleId
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

  if (
    previousModuleId &&
    !previousPass?.length
  ) {
    redirect(
      `/learning/${courseSlug}`
    );
  }

  const completed = new Set(
    (progress ?? []).map(
      (row) =>
        row.lesson_id
    )
  );

  const allComplete =
    lessonIds.length > 0 &&
    lessonIds.every((id) =>
      completed.has(id)
    );

  const passed = (
    attempts ?? []
  ).some(
    (attempt) =>
      attempt.passed
  );

  const best = (
    attempts ?? []
  ).reduce(
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

        <div className="mt-5 rounded-2xl bg-[#1C1F23] p-7 text-white shadow">
          <h1 className="text-3xl font-bold md:text-4xl">
            {moduleData.title}
          </h1>

          {moduleData.description && (
            <p className="mt-2 max-w-3xl text-slate-300">
              {
                moduleData.description
              }
            </p>
          )}

          <div className="mt-4 text-sm font-semibold text-slate-300">
            Pass the module test
            with{" "}
            {
              moduleData.passing_score
            }
            % or better to unlock
            the next module.
          </div>
        </div>

        <div className="mt-8 space-y-6">
          {(lessons ?? []).map(
            (
              lesson,
              lessonIndex
            ) => {
              const isComplete =
                completed.has(
                  lesson.id
                );

              return (
                <section
                  key={
                    lesson.id
                  }
                  className="rounded-2xl bg-white p-7 shadow"
                >
                  <div className="flex items-start gap-4">
                    {isComplete ? (
                      <CheckCircle2 className="mt-1 shrink-0 text-emerald-600" />
                    ) : (
                      <Circle className="mt-1 shrink-0 text-slate-400" />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold uppercase tracking-wide text-slate-400">
                        Lesson{" "}
                        {
                          lessonIndex +
                          1
                        }
                      </div>

                      <h2 className="mt-1 text-2xl font-bold text-[#1C1F23]">
                        {
                          lesson.title
                        }
                      </h2>

                      {lesson.summary && (
                        <p className="mt-2 font-medium text-slate-600">
                          {
                            lesson.summary
                          }
                        </p>
                      )}

                      <div className="mt-5 space-y-4 text-base leading-7 text-slate-700">
                        {renderLessonContent(
                          lesson.content
                        )}
                      </div>

                      {!isComplete ? (
                        <form
                          action={
                            completeLesson
                          }
                          className="mt-6"
                        >
                          <input
                            type="hidden"
                            name="lesson_id"
                            value={
                              lesson.id
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

                          <button className="rounded-xl bg-[#8ED4FF] px-5 py-3 font-bold text-[#1C1F23] transition hover:bg-[#74C7FA]">
                            Mark lesson
                            complete
                          </button>
                        </form>
                      ) : (
                        <div className="mt-6 font-semibold text-emerald-700">
                          ✓ Lesson
                          complete
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              );
            }
          )}
        </div>

        <section className="mt-8 rounded-2xl bg-white p-7 shadow">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[#1C1F23]">
                Module Test
              </h2>

              <p className="mt-1 text-slate-600">
                {passed
                  ? `Passed · Best score ${best}%`
                  : allComplete
                    ? "All lessons complete. You are ready to test."
                    : "Complete every lesson before taking the test."}
              </p>
            </div>

            {allComplete ? (
              <Link
                href={`/learning/${courseSlug}/${moduleSlug}/quiz`}
                className="rounded-xl bg-[#1C1F23] px-6 py-3 text-center font-bold text-white hover:bg-black"
              >
                {passed
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