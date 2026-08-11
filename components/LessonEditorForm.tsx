"use client";

import { useState } from "react";
import RichTextEditor from "@/components/RichTextEditor";

type LessonEditorFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  courseSlug: string;
  moduleSlug: string;
  lessonSlug: string;
  lesson: {
    id: string;
    title: string;
    summary: string | null;
    content: string;
    sort_order: number;
    published: boolean;
  };
};

function legacyContentToHtml(content: string) {
  if (!content || content.trim().startsWith("<")) return content;

  const escapeHtml = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");

  return content
    .split("\n\n")
    .filter(Boolean)
    .map((block) => {
      if (block.startsWith("## ")) {
        return `<h2>${escapeHtml(block.slice(3))}</h2>`;
      }

      if (block.startsWith("- ")) {
        const items = block
          .split("\n")
          .map((item) => `<li>${escapeHtml(item.replace(/^- /, ""))}</li>`)
          .join("");

        return `<ul>${items}</ul>`;
      }

      return `<p>${escapeHtml(block).replaceAll("\n", "<br>")}</p>`;
    })
    .join("");
}

export default function LessonEditorForm({
  action,
  courseSlug,
  moduleSlug,
  lessonSlug,
  lesson,
}: LessonEditorFormProps) {
  const [content, setContent] = useState(() =>
    legacyContentToHtml(lesson.content)
  );

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="lesson_id" value={lesson.id} />

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
        name="lesson_slug"
        value={lessonSlug}
      />

      <input
        type="hidden"
        name="content"
        value={content}
      />

      <div className="grid gap-5 md:grid-cols-[1fr_160px]">
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-700">
            Lesson title
          </span>

          <input
            name="title"
            defaultValue={lesson.title}
            required
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-sky-500"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-700">
            Order
          </span>

          <input
            name="sort_order"
            type="number"
            min="0"
            defaultValue={lesson.sort_order}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-sky-500"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-bold text-slate-700">
          Short summary
        </span>

        <textarea
          name="summary"
          defaultValue={lesson.summary ?? ""}
          rows={3}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-sky-500"
        />
      </label>

      <div>
        <div className="mb-2 text-sm font-bold text-slate-700">
          Lesson content
        </div>

        <RichTextEditor
          value={content}
          onChange={setContent}
          placeholder="Write the lesson here..."
          enableImages
          enableAI={false}
        />
      </div>

      <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <input
          name="published"
          type="checkbox"
          value="true"
          defaultChecked={lesson.published}
          className="h-5 w-5"
        />

        <span>
          <span className="block font-bold text-slate-800">
            Published
          </span>

          <span className="block text-sm text-slate-600">
            Students can see this lesson when the course and module are
            published.
          </span>
        </span>
      </label>

      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded-xl bg-[#1C1F23] px-6 py-3 font-bold text-white transition hover:bg-black"
        >
          Save lesson
        </button>
      </div>
    </form>
  );
}