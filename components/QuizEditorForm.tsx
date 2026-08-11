"use client";

import { useState } from "react";

type OptionKey = "a" | "b" | "c" | "d";

type QuizOption = {
  id?: string;
  option_key: OptionKey;
  label: string;
};

type QuizQuestion = {
  id?: string;
  prompt: string;
  published: boolean;
  correct_option_key: OptionKey;
  options: QuizOption[];
};

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  courseSlug: string;
  moduleSlug: string;
  moduleId: string;
  passingScore: number;
  initialQuestions: QuizQuestion[];
};

const OPTION_KEYS: OptionKey[] = [
  "a",
  "b",
  "c",
  "d",
];

function createBlankQuestion(): QuizQuestion {
  return {
    prompt: "",
    published: true,
    correct_option_key: "a",

    options: OPTION_KEYS.map(
      (key) => ({
        option_key: key,
        label: "",
      })
    ),
  };
}

export default function QuizEditorForm({
  action,
  courseSlug,
  moduleSlug,
  moduleId,
  passingScore,
  initialQuestions,
}: Props) {
  const [
    questions,
    setQuestions,
  ] = useState<QuizQuestion[]>(
    initialQuestions.length
      ? initialQuestions
      : [createBlankQuestion()]
  );

  function updateQuestion(
    index: number,
    changes: Partial<QuizQuestion>
  ) {
    setQuestions((current) =>
      current.map(
        (
          question,
          questionIndex
        ) =>
          questionIndex === index
            ? {
                ...question,
                ...changes,
              }
            : question
      )
    );
  }

  function updateOption(
    questionIndex: number,
    optionKey: OptionKey,
    label: string
  ) {
    setQuestions((current) =>
      current.map(
        (
          question,
          currentQuestionIndex
        ) => {
          if (
            currentQuestionIndex !==
            questionIndex
          ) {
            return question;
          }

          return {
            ...question,

            options:
              question.options.map(
                (option) =>
                  option.option_key ===
                  optionKey
                    ? {
                        ...option,
                        label,
                      }
                    : option
              ),
          };
        }
      )
    );
  }

  function addQuestion() {
    setQuestions((current) => [
      ...current,
      createBlankQuestion(),
    ]);
  }

  function removeQuestion(
    index: number
  ) {
    const question =
      questions[index];

    const confirmed =
      window.confirm(
        `Delete question ${
          index + 1
        }${
          question.prompt
            ? `: "${question.prompt}"`
            : ""
        }?`
      );

    if (!confirmed) {
      return;
    }

    setQuestions((current) =>
      current.filter(
        (_, questionIndex) =>
          questionIndex !== index
      )
    );
  }

  function moveQuestion(
    index: number,
    direction: -1 | 1
  ) {
    const newIndex =
      index + direction;

    if (
      newIndex < 0 ||
      newIndex >=
        questions.length
    ) {
      return;
    }

    setQuestions((current) => {
      const copy = [...current];

      const [question] =
        copy.splice(index, 1);

      copy.splice(
        newIndex,
        0,
        question
      );

      return copy;
    });
  }

  const serializedQuestions =
    JSON.stringify(
      questions.map(
        (
          question,
          questionIndex
        ) => ({
          id:
            question.id ?? null,

          prompt:
            question.prompt,

          published:
            question.published,

          sort_order:
            questionIndex + 1,

          correct_option_key:
            question.correct_option_key,

          options:
                OPTION_KEYS.map(
                (
                key,
                optionIndex
                ) => {
                const existing =
                    question.options.find(
                    (option) =>
                        option.option_key ===
                        key
                    );

                return {
                    id:
                    existing?.id ??
                    null,

                    option_key:
                    key,

                    label:
                    existing?.label ??
                    "",

                    sort_order:
                    optionIndex + 1,
                };
                }
                ).filter(
                    (option) =>
                    option.label.trim() !== ""
                ),
        })
      )
    );

  return (
    <form
      action={action}
      className="space-y-6"
    >
      <input
        type="hidden"
        name="course_slug"
        value={courseSlug}
      />

      <input
        type="hidden"
        name="module_slug"
        value={moduleSlug}
      />

      <input
        type="hidden"
        name="module_id"
        value={moduleId}
      />

      <input
        type="hidden"
        name="questions_json"
        value={
          serializedQuestions
        }
      />

      <div className="rounded-2xl border border-sky-200 bg-[#EEF8FF] p-5">
        <div className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Passing score
        </div>

        <div className="mt-1 text-3xl font-bold text-[#1C1F23]">
          {passingScore}%
        </div>
      </div>

      <div className="space-y-6">
        {questions.map(
          (
            question,
            questionIndex
          ) => (
            <section
              key={
                question.id ??
                `new-${questionIndex}`
              }
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-5 flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-bold uppercase tracking-wide text-slate-400">
                    Question{" "}
                    {questionIndex +
                      1}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={
                      questionIndex ===
                      0
                    }
                    onClick={() =>
                      moveQuestion(
                        questionIndex,
                        -1
                      )
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ↑ Up
                  </button>

                  <button
                    type="button"
                    disabled={
                      questionIndex ===
                      questions.length -
                        1
                    }
                    onClick={() =>
                      moveQuestion(
                        questionIndex,
                        1
                      )
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ↓ Down
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      removeQuestion(
                        questionIndex
                      )
                    }
                    className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">
                  Question
                </span>

                <textarea
                  value={
                    question.prompt
                  }
                  onChange={(
                    event
                  ) =>
                    updateQuestion(
                      questionIndex,
                      {
                        prompt:
                          event.target
                            .value,
                      }
                    )
                  }
                  rows={3}
                  placeholder="Enter the question..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-sky-500"
                />
              </label>

              <div className="mt-6 space-y-3">
                <div className="text-sm font-bold text-slate-700">
                  Answer choices
                </div>

                {OPTION_KEYS.map(
                  (key) => {
                    const option =
                      question.options.find(
                        (item) =>
                          item.option_key ===
                          key
                      );

                    const isCorrect =
                      question.correct_option_key ===
                      key;

                    return (
                      <div
                        key={key}
                        className={`flex items-center gap-3 rounded-xl border p-4 ${
                          isCorrect
                            ? "border-emerald-400 bg-emerald-50"
                            : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`correct_${questionIndex}`}
                          checked={
                            isCorrect
                          }
                          onChange={() =>
                            updateQuestion(
                              questionIndex,
                              {
                                correct_option_key:
                                  key,
                              }
                            )
                          }
                          className="h-5 w-5 shrink-0"
                        />

                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1C1F23] font-bold text-white">
                          {key.toUpperCase()}
                        </div>

                        <input
                          value={
                            option?.label ??
                            ""
                          }
                          onChange={(
                            event
                          ) =>
                            updateOption(
                              questionIndex,
                              key,
                              event.target
                                .value
                            )
                          }
                          placeholder={`Answer ${key.toUpperCase()}`}
                          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-sky-500"
                        />

                        {isCorrect && (
                          <span className="hidden shrink-0 text-sm font-bold text-emerald-700 sm:block">
                            Correct
                          </span>
                        )}
                      </div>
                    );
                  }
                )}
              </div>

              <label className="mt-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <input
                  type="checkbox"
                  checked={
                    question.published
                  }
                  onChange={(
                    event
                  ) =>
                    updateQuestion(
                      questionIndex,
                      {
                        published:
                          event.target
                            .checked,
                      }
                    )
                  }
                  className="h-5 w-5"
                />

                <span>
                  <span className="block font-bold text-slate-800">
                    Published
                  </span>

                  <span className="block text-sm text-slate-600">
                    Students can
                    see this
                    question on
                    the module
                    test.
                  </span>
                </span>
              </label>
            </section>
          )
        )}
      </div>

      <button
        type="button"
        onClick={addQuestion}
        className="w-full rounded-xl border-2 border-dashed border-sky-300 bg-sky-50 px-5 py-4 font-bold text-sky-800 hover:bg-sky-100"
      >
        + Add Question
      </button>

      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded-xl bg-[#1C1F23] px-7 py-3 font-bold text-white transition hover:bg-black"
        >
          Save Module Test
        </button>
      </div>
    </form>
  );
}