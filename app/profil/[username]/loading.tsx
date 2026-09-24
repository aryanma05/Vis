import { Skeleton } from "@/components/ui/misc";

export default function ProfileLoading() {
  return (
    <main aria-busy="true" aria-label="Laster profilen" className="pb-28 md:pl-24">
      <div className="blueprint h-36 border-b border-line md:h-52" />
      <div className="mx-auto grid max-w-7xl gap-10 px-5 md:px-10 lg:grid-cols-[340px_1fr]">
        <div className="-mt-16 lg:-mt-20">
          <Skeleton className="size-32 rounded-[32px]" />
          <Skeleton className="mt-5 h-8 w-2/3" />
          <Skeleton className="mt-2 h-4 w-1/3" />
          <Skeleton className="mt-5 h-5 w-full" />
          <Skeleton className="mt-6 h-10 w-full" />
          <Skeleton className="mt-7 h-16 w-full rounded-2xl" />
        </div>
        <div className="lg:pt-8">
          <Skeleton className="h-8 w-72" />
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="aspect-[4/3] w-full rounded-[20px]" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
