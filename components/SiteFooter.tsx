import Link from "next/link";
import { Wordmark } from "@/components/Logo";

const LINKS = [
  { href: "/om", label: "Om Vis" },
  { href: "/sok", label: "Utforsk" },
  { href: "/retningslinjer", label: "Retningslinjer" },
  { href: "/vilkar", label: "Vilkår" },
  { href: "/personvern", label: "Personvern" },
];

export default function SiteFooter() {
  return (
    <footer className="pb-28 md:pb-0 md:pl-24 print:hidden">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-4 border-t border-line px-5 py-8 text-sm text-mist md:px-10">
        <Link href="/" aria-label="Vis – forsiden">
          <Wordmark className="text-xl" />
        </Link>
        <nav aria-label="Om nettstedet" className="flex flex-wrap gap-x-5 gap-y-2">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="transition hover:text-fg">
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="md:ml-auto">© {new Date().getFullYear()} Vis</p>
      </div>
    </footer>
  );
}
