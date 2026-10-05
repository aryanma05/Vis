import { Skeleton } from "@/components/ui/misc";
import { getT } from "@/lib/i18n/server";

// Vises mens neste side hentes. Et rolig skjelett i stedet for en spinner over hele skjermen.
export default async function Loading() {
  const t = await getT();
  return (
    <main aria-busy="true" aria-label={t("Laster")} className="px-5 pb-28 pt-10 md:pl-28 md:pr-10 md:pt-16">
      <div className="fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden">
        <div className="loading-bar h-full w-1/3 bg-sea" />
      </div>
      <div className="mx-auto max-w-7xl">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-5 h-12 w-2/3 max-w-xl" />
        <Skeleton className="mt-4 h-4 w-1/2 max-w-md" />
        <div className="mt-14 grid grid-cols-1 gap-x-5 gap-y-9 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i}>
              <Skeleton className="aspect-[4/3] w-full rounded-[22px]" />
              <Skeleton className="mt-4 h-4 w-2/3" />
              <Skeleton className="mt-2 h-3 w-1/3" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
