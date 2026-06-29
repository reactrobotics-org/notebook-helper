export default function ImagesPage() {
  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-4xl rounded-lg bg-white p-8 shadow">
        <h1 className="text-3xl font-bold">Images</h1>

        <p className="mt-2 text-gray-600">
          Capture robot progress with photos and notes.
        </p>

        <a
  href="/images/new"
  className="mt-6 inline-block rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
>
  Add Image
</a>
      </div>
    </main>
  );
}