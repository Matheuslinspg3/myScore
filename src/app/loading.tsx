export default function Loading() {
  return (
    <main className="min-h-dvh bg-[#f5f6f8] p-5 sm:p-8 lg:pl-72">
      <div className="mx-auto max-w-6xl animate-pulse space-y-5">
        <div className="h-10 w-48 rounded-xl bg-slate-200" />
        <div className="h-64 rounded-[1.6rem] bg-slate-900" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="h-32 rounded-2xl bg-white" key={index} />
          ))}
        </div>
      </div>
    </main>
  );
}
