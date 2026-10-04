import { Skeleton } from "@/components/ui/misc";
import { getT } from "@/lib/i18n/server";

export default async function ProjectLoading() {
  const t = await getT();
  return (
    <main aria-busy="true" aria-label={t("Laster prosjektet")} className="px-5 pb-28 pt-8 md:pl-28 md:pr-10 md:pt-12">
      <div className="mx-auto max-w-7xl">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-6 h-16 w-3/4 max-w-3xl" />
        <Skeleton className="mt-5 h-6 w-1/2 max-w-xl" />
        <div className="mt-8 flex gap-2">
          <Skeleton className="h-10 w-24 rounded-full" />
          <Skeleton className="h-10 w-24 rounded-full" />
          <Skeleton className="h-10 w-32 rounded-full" />
        </div>
        <Skeleton className="mt-10 aspect-[16/8] w-full rounded-[28px]" />
      </div>
    </main>
  );
}
