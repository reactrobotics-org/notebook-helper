import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

import QuizEditorForm from "@/components/QuizEditorForm";

type IncomingQuestion = {
  id: string | null;
  prompt: string;
  published: boolean;
  sort_order: number;
  correct_option_key: string;

  options: {
    id: string | null;
    option_key: string;
    label: string;
    sort_order: number;
  }[];
};

async function requireAdmin() {
  const supabase = await createClient();

  const { data: claimsData } =
    await supabase.auth.getClaims();

  const userId =
    claimsData?.claims?.sub;

  if (!userId) {
    redirect("/login");
  }

  const { data: profile } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

  if (
    (profile?.role ?? "").toLowerCase() !==
    "admin"
  ) {
    redirect("/dashboard");
  }

  return userId;
}

async function saveQuiz(
  formData: FormData
) {
  "use server";

  await requireAdmin();

  const admin =
    createAdminClient();

  const courseSlug = String(
    formData.get("course_slug") ?? ""
  );

  const moduleSlug = String(
    formData.get("module_slug") ?? ""
  );

  const moduleId = String(
    formData.get("module_id") ?? ""
  );

  const questionsJson = String(
    formData.get("questions_json") ?? "[]"
  );

  if (
    !courseSlug ||
    !moduleSlug ||
    !moduleId
  ) {
    return;
  }

  let questions: IncomingQuestion[];

  try {
    questions =
      JSON.parse(questionsJson);
  } catch {
    throw new Error(
      "Unable to read quiz questions."
    );
  }

  const cleanedQuestions =
    questions.filter(
      (question) =>
        question.prompt.trim() !== ""
    );

  for (const question of cleanedQuestions) {
    const correctKey =
      question.correct_option_key.toLowerCase();

    if (
      !["a", "b", "c", "d"].includes(
        correctKey
      )
    ) {
      throw new Error(
        "Every question must have a correct answer."
      );
    }

    const labels =
      question.options.map(
        (option) =>
          option.label.trim()
      );

    const filledLabels =
  labels.filter(
    (label) => label !== ""
  );

    if (
    filledLabels.length < 2
    ) {
    throw new Error(
        "Every question must have at least two answer choices."
    );
    }
  }

  const {
    data: existingQuestions,
    error: existingError,
  } = await admin
    .from("learning_questions")
    .select("id")
    .eq(
      "module_id",
      moduleId
    );

  if (existingError) {
    throw new Error(
      `Unable to load existing questions: ${existingError.message}`
    );
  }

  const existingIds =
    new Set(
      (existingQuestions ?? []).map(
        (question) =>
          question.id
      )
    );

  const incomingIds =
    new Set(
      cleanedQuestions
        .map(
          (question) =>
            question.id
        )
        .filter(
          (id): id is string =>
            Boolean(id)
        )
    );

  const deletedIds =
    [...existingIds].filter(
      (id) =>
        !incomingIds.has(id)
    );

  if (deletedIds.length > 0) {
    const { error } =
      await admin
        .from(
          "learning_questions"
        )
        .delete()
        .in(
          "id",
          deletedIds
        );

    if (error) {
      throw new Error(
        `Unable to delete questions: ${error.message}`
      );
    }
  }

  for (const question of cleanedQuestions) {
    let questionId =
      question.id;

    if (questionId) {
      const { error } =
        await admin
          .from(
            "learning_questions"
          )
          .update({
            prompt:
              question.prompt.trim(),

            published:
              question.published,

            sort_order:
              question.sort_order,
          })
          .eq(
            "id",
            questionId
          )
          .eq(
            "module_id",
            moduleId
          );

      if (error) {
        throw new Error(
          `Unable to update question: ${error.message}`
        );
      }
    } else {
      const {
        data: newQuestion,
        error,
      } = await admin
        .from(
          "learning_questions"
        )
        .insert({
          module_id:
            moduleId,

          prompt:
            question.prompt.trim(),

          published:
            question.published,

          sort_order:
            question.sort_order,
        })
        .select("id")
        .single();

      if (
        error ||
        !newQuestion
      ) {
        throw new Error(
          `Unable to create question: ${
            error?.message ??
            "Unknown error"
          }`
        );
      }

      questionId =
        newQuestion.id;
    }

    const {
      error: deleteOptionsError,
    } = await admin
      .from(
        "learning_question_options"
      )
      .delete()
      .eq(
        "question_id",
        questionId
      );

    if (deleteOptionsError) {
      throw new Error(
        `Unable to update answer choices: ${deleteOptionsError.message}`
      );
    }

    const optionsToInsert =
        question.options
            .filter(
            (option) =>
                option.label.trim() !== ""
            )
            .map(
            (option) => ({
                question_id:
                questionId,

                option_key:
                option.option_key.toLowerCase(),

                label:
                option.label.trim(),

                sort_order:
                option.sort_order,
            })
            );

    const {
      error: insertOptionsError,
    } = await admin
      .from(
        "learning_question_options"
      )
      .insert(
        optionsToInsert
      );

    if (insertOptionsError) {
      throw new Error(
        `Unable to save answer choices: ${insertOptionsError.message}`
      );
    }

    const {
      error: answerKeyError,
    } = await admin
      .from(
        "learning_answer_keys"
      )
      .upsert(
        {
          question_id:
            questionId,

          correct_option_key:
            question.correct_option_key.toLowerCase(),
        },
        {
          onConflict:
            "question_id",
        }
      );

    if (answerKeyError) {
      throw new Error(
        `Unable to save correct answer: ${answerKeyError.message}`
      );
    }
  }

  revalidatePath(
    `/admin/learning/${courseSlug}/${moduleSlug}/quiz`
  );

  revalidatePath(
    `/learning/${courseSlug}/${moduleSlug}/quiz`
  );

  revalidatePath(
    `/learning/${courseSlug}/${moduleSlug}`
  );

  revalidatePath(
    "/admin/learning"
  );

  redirect(
    `/admin/learning/${courseSlug}/${moduleSlug}/quiz?saved=1`
  );
}

export default async function AdminQuizPage({
  params,
  searchParams,
}: {
  params: Promise<{
    courseSlug: string;
    moduleSlug: string;
  }>;

  searchParams?: Promise<{
    saved?: string;
  }>;
}) {
  const {
    courseSlug,
    moduleSlug,
  } = await params;

  const query =
    await searchParams;

  await requireAdmin();

  const admin =
    createAdminClient();

  const {
    data: course,
    error: courseError,
  } = await admin
    .from(
      "learning_courses"
    )
    .select(
      "id, slug, title"
    )
    .eq(
      "slug",
      courseSlug
    )
    .maybeSingle();

  if (
    courseError ||
    !course
  ) {
    notFound();
  }

  const {
    data: module,
    error: moduleError,
  } = await admin
    .from(
      "learning_modules"
    )
    .select(
      `
        id,
        slug,
        title,
        passing_score
      `
    )
    .eq(
      "course_id",
      course.id
    )
    .eq(
      "slug",
      moduleSlug
    )
    .maybeSingle();

  if (
    moduleError ||
    !module
  ) {
    notFound();
  }

  const {
    data: questions,
    error: questionError,
  } = await admin
    .from(
      "learning_questions"
    )
    .select(
      `
        id,
        prompt,
        published,
        sort_order
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

  if (questionError) {
    throw new Error(
      `Unable to load quiz questions: ${questionError.message}`
    );
  }

  const questionIds =
    (questions ?? []).map(
      (question) =>
        question.id
    );

  const [
    {
      data: options,
      error: optionError,
    },
    {
      data: answerKeys,
      error: answerKeyError,
    },
  ] = questionIds.length
    ? await Promise.all([
        admin
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
          ),

        admin
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
          ),
      ])
    : [
        {
          data: [],
          error: null,
        },
        {
          data: [],
          error: null,
        },
      ];

  if (optionError) {
    throw new Error(
      `Unable to load quiz answer choices: ${optionError.message}`
    );
  }

  if (answerKeyError) {
    throw new Error(
      `Unable to load quiz answer keys: ${answerKeyError.message}`
    );
  }

  const answerKeyMap =
    new Map(
      (answerKeys ?? []).map(
        (answer) => [
          answer.question_id,
          answer.correct_option_key.toLowerCase(),
        ]
      )
    );

  const initialQuestions =
    (questions ?? []).map(
      (question) => ({
        id:
          question.id,

        prompt:
          question.prompt,

        published:
          question.published,

        correct_option_key:
          answerKeyMap.get(
            question.id
          ) ?? "a",

        options:
          (
            options ?? []
          )
            .filter(
              (option) =>
                option.question_id ===
                question.id
            )
            .map(
              (option) => ({
                id:
                  option.id,

                option_key:
                  option.option_key.toLowerCase(),

                label:
                  option.label,
              })
            ),
      })
    );

  return (
    <main className="min-h-dvh bg-[#F5F7FA] p-6 md:p-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/admin/learning"
          className="font-semibold text-slate-600 hover:text-black"
        >
          ← Learning administration
        </Link>

        <div className="mt-5 rounded-2xl bg-white p-7 shadow">
          <div className="mb-6 border-b border-slate-200 pb-5">
            <div className="text-sm font-bold uppercase tracking-wide text-slate-400">
              {course.title}
            </div>

            <h1 className="mt-1 text-3xl font-bold text-[#1C1F23]">
              {module.title} Module Test
            </h1>

            <p className="mt-2 text-slate-600">
              Edit questions, answers, and the correct answer for this module test.
            </p>
          </div>

          {query?.saved ===
            "1" && (
            <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 font-semibold text-emerald-800">
              Module test saved.
            </div>
          )}

          <QuizEditorForm
            action={saveQuiz}
            courseSlug={
              courseSlug
            }
            moduleSlug={
              moduleSlug
            }
            moduleId={
              module.id
            }
            passingScore={
              module.passing_score
            }
            initialQuestions={
              initialQuestions
            }
          />
        </div>
      </div>
    </main>
  );
}