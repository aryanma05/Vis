import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Tabs } from "@/components/ui/tabs";

export default function EditNav({ active, username }: { active: "profil" | "cv" | "konto"; username: string }) {
  return (
    <div className="border-b border-line">
      <div className="mx-auto max-w-6xl px-5 pt-10 md:px-10 md:pt-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label-mono">Innstillinger</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">
              {active === "profil" ? "Profil og visittkort" : active === "cv" ? "CV" : "Konto og varsler"}
            </h1>
          </div>
          <Link
            href={`/@${username}${active === "cv" ? "?fane=cv" : ""}`}
            className="group mb-1 inline-flex items-center gap-1.5 text-sm text-mist transition hover:text-fg"
          >
            Se profilen <ArrowUpRight className="size-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>
        <div className="mt-8">
          <Tabs
            label="Innstillinger"
            active={active}
            items={[
              { key: "profil", label: "Profil", href: "/profil/rediger" },
              { key: "cv", label: "CV", href: "/profil/rediger/cv" },
              { key: "konto", label: "Konto og varsler", href: "/profil/rediger/konto" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
