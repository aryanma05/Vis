import { Skeleton } from "@/components/ui/misc";

export default function ProfileLoading() {
  return (
    <main aria-busy="true" aria-label="Laster profilen" className="pb-28 md:pl-24">
      <div className="mx-auto max-w-7xl px-5 pt-2 md:px-10 md:pt-8">
        <Skeleton className="h-40 w-full rounded-[28px] md:h-60" />
      </div>
      <div className="mx-auto grid max-w-7xl gap-10 px-5 md:px-10 lg:grid-cols-[340px_1fr]">
        <div className="-mt-14 lg:-mt-20">
          <Skeleton className="relative z-10 ml-4 size-[120px] rounded-full ring-4 ring-ink md:ml-6" />
          <Skeleton className="mt-5 h-8 w-2/3" />
          <Skeleton className="mt-2 h-4 w-1/3" />
          <Skeleton className="mt-5 h-5 w-full" />
          <Skeleton className="mt-6 h-10 w-full" />
          <Skeleton className="mt-7 h-16 w-full rounded-2xl" />
        </div>
        <div className="lg:pt-6">
          <Skeleton className="h-8 w-72" />
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="aspect-[4/3] w-full rounded-[22px]" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
