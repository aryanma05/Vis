import Link from "next/link";
import { ArrowIcon } from "@/components/icons";

export default function EditNav({ active, username }: { active: "profil" | "cv" | "konto"; username: string }) {
  const item = (href: string, label: string, isActive: boolean) => (
    <Link
      href={href}
      className={`-mb-px border-b-2 pb-4 text-sm font-medium transition ${
        isActive ? "border-primary text-fg" : "border-transparent text-mist hover:text-fg"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="border-b border-line">
      <div className="mx-auto max-w-5xl px-6 pt-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mist/70">Innstillinger</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-5xl">Rediger profil</h1>
          </div>
          <Link
            href={`/@${username}${active === "cv" ? "?fane=cv" : ""}`}
            className="group mb-1 inline-flex items-center gap-2 text-sm text-mist hover:text-fg"
          >
            Se profilen <ArrowIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </Link>
        </div>
        <nav className="mt-10 flex gap-8">
          {item("/profil/rediger", "Profil", active === "profil")}
          {item("/profil/rediger/cv", "CV", active === "cv")}
          {item("/profil/rediger/konto", "Konto og personvern", active === "konto")}
        </nav>
      </div>
    </div>
  );
}
