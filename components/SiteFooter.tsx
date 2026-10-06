import { Suspense } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/Logo";
import LanguageSwitch from "@/components/nav/LanguageSwitch";
import { getT } from "@/lib/i18n/server";

const LINKS = [
  { href: "/om", label: "Om Vis" },
  { href: "/sok", label: "Utforsk" },
  { href: "/partnere", label: "Finn partnere" },
  { href: "/stillinger", label: "Stillinger" },
  { href: "/bedrifter", label: "For bedrifter" },
  { href: "/priser", label: "Priser" },
  { href: "/utviklere", label: "Utviklere" },
  { href: "/retningslinjer", label: "Retningslinjer" },
  { href: "/vilkar", label: "Vilkår" },
  { href: "/personvern", label: "Personvern" },
];

export default async function SiteFooter() {
  const t = await getT();
  return (
    <footer className="pb-28 md:pb-0 md:pl-24 print:hidden">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-4 border-t border-line px-5 py-8 text-sm text-mist md:px-10">
        <Link href="/" aria-label={t("Vis – forsiden")}>
          <Wordmark className="text-xl" />
        </Link>
        <nav aria-label={t("Om nettstedet")} className="flex flex-wrap gap-x-5 gap-y-2">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="transition hover:text-fg">
              {t(l.label)}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-6 md:ml-auto">
          <Suspense>
            <LanguageSwitch />
          </Suspense>
          <p>© {new Date().getFullYear()} Vis</p>
        </div>
      </div>
    </footer>
  );
}
