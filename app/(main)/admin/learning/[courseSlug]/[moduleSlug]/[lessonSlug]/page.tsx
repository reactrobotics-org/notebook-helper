import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import LessonEditorForm from "@/components/LessonEditorForm";

async function saveLesson(formData: FormData) {
  "use server";

  const lessonId = String(formData.get("lesson_id") ?? "");

  const courseSlug = String(
    formData.get("course_slug") ?? ""
  );

  const moduleSlug = String(
    formData.get("module_slug") ?? ""
  );

  const lessonSlug = String(
    formData.get("lesson_slug") ?? ""
  );

  const title = String(
    formData.get("title") ?? ""
  ).trim();

  const summary = String(
    formData.get("summary") ?? ""
  ).trim();

  const content = String(
    formData.get("content") ?? ""
  );

  const sortOrder = Number(
    formData.get("sort_order") ?? 0
  );

  const published =
    formData.get("published") === "true";

  if (!lessonId || !title) {
    return;
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("learning_lessons")
    .update({
      title,
      summary: summary || null,
      content,
      sort_order: Number.isFinite(sortOrder)
        ? sortOrder
        : 0,
      published,
    })
    .eq("id", lessonId);

  if (error) {
    throw new Error(
      `Unable to save lesson: ${error.message}`
    );
  }

  // Refresh every Learning page that can display
  // information about this lesson.
  revalidatePath("/learning");
  revalidatePath(`/learning/${courseSlug}`);
  revalidatePath(
    `/learning/${courseSlug}/${moduleSlug}`
  );

  // Also refresh the admin pages.
  revalidatePath("/admin/learning");

  revalidatePath(
    `/admin/learning/${courseSlug}/${moduleSlug}/${lessonSlug}`
  );

  redirect("/admin/learning?saved=1");
}

export default async function EditLearningLessonPage({
  params,
}: {
  params: Promise<{
    courseSlug: string;
    moduleSlug: string;
    lessonSlug: string;
  }>;
}) {
  const {
    courseSlug,
    moduleSlug,
    lessonSlug,
  } = await params;

  const supabase = await createClient();

  const { data: course } = await supabase
    .from("learning_courses")
    .select("id, slug, title")
    .eq("slug", courseSlug)
    .single();

  if (!course) {
    notFound();
  }

  const { data: module } = await supabase
    .from("learning_modules")
    .select("id, slug, title")
    .eq("course_id", course.id)
    .eq("slug", moduleSlug)
    .single();

  if (!module) {
    notFound();
  }

  const { data: lesson } = await supabase
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
    .eq("module_id", module.id)
    .eq("slug", lessonSlug)
    .single();

  if (!lesson) {
    notFound();
  }

  return (
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
            {course.title} / {module.title}
          </div>

          <h2 className="mt-1 text-3xl font-bold text-[#1C1F23]">
            Edit {lesson.title}
          </h2>

          <p className="mt-2 text-slate-600">
            Changes are saved directly to Supabase.
          </p>
        </div>

        <LessonEditorForm
          action={saveLesson}
          courseSlug={courseSlug}
          moduleSlug={moduleSlug}
          lessonSlug={lessonSlug}
          lesson={lesson}
        />
      </div>
    </div>
  );
}