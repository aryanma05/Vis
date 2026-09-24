import Link from "next/link";
import { Wordmark } from "@/components/Logo";

const COLUMNS = [
  {
    title: "Vis",
    links: [
      { href: "/om", label: "Om Vis" },
      { href: "/sok", label: "Utforsk prosjekter" },
      { href: "/sok?type=personer", label: "Finn folk" },
      { href: "/sok?sort=trending", label: "Trender" },
    ],
  },
  {
    title: "Kom i gang",
    links: [
      { href: "/register", label: "Lag profil" },
      { href: "/ny", label: "Del et prosjekt" },
      { href: "/profil/rediger/cv", label: "Importer CV" },
      { href: "/logg-inn", label: "Logg inn" },
    ],
  },
  {
    title: "Trygghet",
    links: [
      { href: "/retningslinjer", label: "Retningslinjer" },
      { href: "/vilkar", label: "Vilkår for bruk" },
      { href: "/personvern", label: "Personvern" },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="border-t border-line bg-ink-2/60 pb-28 md:pb-0 md:pl-24 print:hidden">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-14 md:grid-cols-[1.3fr_2fr] md:px-10">
        <div>
          <Wordmark className="text-3xl" />
          <p className="mt-4 max-w-xs text-sm leading-6 text-mist">
            Visittkort, CV og prosjekter på ett sted. Laget for folk som lager digitalt i Norden.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="label-mono">{col.title}</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-mist transition hover:text-fg">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 border-t border-line/70 px-6 py-6 text-xs text-mist/80 md:px-10">
        <p>© {new Date().getFullYear()} Vis · Laget i Norge</p>
        <p className="font-mono">vis.no/@deg</p>
      </div>
    </footer>
  );
}
