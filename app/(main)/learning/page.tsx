import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BookOpen,
  CheckCircle2,
  GraduationCap,
  Eye,
} from "lucide-react";
import { createClient } from "@/utils/supabase/server";

export default async function LearningPage() {
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
    .maybeSingle();

  const role = (
    profile?.role ?? ""
  ).toLowerCase();

  const isReviewer =
    role === "reviewer";

  /*
   * Reviewers can see both published
   * and draft courses.
   *
   * Normal users still only see
   * published courses.
   */
  let courseQuery = supabase
    .from("learning_courses")
    .select(
      `
        id,
        slug,
        title,
        description,
        published,
        sort_order
      `
    )
    .order("sort_order", {
      ascending: true,
    });

  if (!isReviewer) {
    courseQuery =
      courseQuery.eq(
        "published",
        true
      );
  }

  const {
    data: courses,
    error,
  } = await courseQuery;

  if (error) {
    return <SetupMessage />;
  }

  /*
   * Load the modules used for
   * course progress.
   */
  let moduleQuery = supabase
    .from("learning_modules")
    .select(
      `
        id,
        course_id,
        published
      `
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

  const {
    data: attempts,
  } = moduleIds.length
    ? await supabase
        .from(
          "learning_quiz_attempts"
        )
        .select(
          "module_id, passed"
        )
        .eq(
          "user_id",
          user.id
        )
        .eq(
          "passed",
          true
        )
        .in(
          "module_id",
          moduleIds
        )
    : {
        data: [] as {
          module_id: string;
          passed: boolean;
        }[],
      };

  const passed =
    new Set(
      (attempts ?? []).map(
        (attempt) =>
          attempt.module_id
      )
    );

  return (
    <main className="min-h-dvh bg-[#F5F7FA] p-6 md:p-8">
      <div className="mx-auto max-w-6xl">
        {isReviewer && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-amber-900">
            <Eye
              size={22}
              className="shrink-0"
            />

            <div>
              <div className="font-bold">
                BOARD PREVIEW
              </div>

              <div className="text-sm">
                You are viewing
                published and draft
                curriculum. Draft
                material may be
                incomplete.
              </div>
            </div>
          </div>
        )}

        <div className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#E8F6FF] px-4 py-2 text-sm font-semibold text-[#1C1F23]">
            <GraduationCap
              size={18}
            />

            REACT Learning
          </div>

          <h1 className="text-4xl font-bold text-[#1C1F23] md:text-5xl">
            Courses
          </h1>

          <p className="mt-2 max-w-3xl text-lg text-slate-600">
            {isReviewer
              ? "Review the curriculum as it will appear to students."
              : "Work through each lesson, then pass the module test to unlock what comes next."}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {(courses ?? []).map(
            (course) => {
              const courseModules =
                (
                  modules ?? []
                ).filter(
                  (module) =>
                    module.course_id ===
                    course.id
                );

              const completed =
                courseModules.filter(
                  (module) =>
                    passed.has(
                      module.id
                    )
                ).length;

              const total =
                courseModules.length;

              return (
                <Link
                  key={
                    course.id
                  }
                  href={`/learning/${course.slug}`}
                  className="group rounded-2xl bg-white p-7 shadow transition hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="rounded-xl bg-[#E8F6FF] p-3">
                      <BookOpen
                        size={30}
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {isReviewer &&
                        !course.published && (
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                            DRAFT
                          </span>
                        )}

                      {!isReviewer && (
                        <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
                          <CheckCircle2
                            size={17}
                          />

                          {completed} /{" "}
                          {total} modules
                        </div>
                      )}
                    </div>
                  </div>

                  <h2 className="mt-5 text-2xl font-bold text-[#1C1F23] group-hover:text-slate-700">
                    {course.title}
                  </h2>

                  <p className="mt-2 text-slate-600">
                    {
                      course.description
                    }
                  </p>

                  {!isReviewer && (
                    <>
                      <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-[#8ED4FF]"
                          style={{
                            width: `${
                              total
                                ? (completed /
                                    total) *
                                  100
                                : 0
                            }%`,
                          }}
                        />
                      </div>

                      <div className="mt-3 text-sm font-semibold text-slate-500">
                        {completed ===
                          total &&
                        total > 0
                          ? "Course complete"
                          : "Continue course →"}
                      </div>
                    </>
                  )}

                  {isReviewer && (
                    <div className="mt-6 text-sm font-bold text-amber-700">
                      Review course →
                    </div>
                  )}
                </Link>
              );
            }
          )}
        </div>

        {(courses ?? [])
          .length === 0 && (
          <div className="rounded-2xl bg-white p-8 text-slate-600 shadow">
            No courses are
            available yet.
          </div>
        )}
      </div>
    </main>
  );
}

function SetupMessage() {
  return (
    <main className="min-h-dvh bg-[#F5F7FA] p-8">
      <div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-8">
        <h1 className="text-2xl font-bold text-[#1C1F23]">
          Learning needs its
          database setup
        </h1>

        <p className="mt-3 text-slate-700">
          Run{" "}
          <code className="rounded bg-white px-2 py-1">
            supabase/learning.sql
          </code>{" "}
          in the Supabase SQL
          Editor, then reload this
          page.
        </p>
      </div>
    </main>
  );
}