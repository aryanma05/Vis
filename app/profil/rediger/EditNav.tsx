import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Tabs } from "@/components/ui/tabs";
import { getT } from "@/lib/i18n/server";

export default async function EditNav({ active, username }: { active: "profil" | "cv" | "konto"; username: string }) {
  const t = await getT();
  return (
    <div className="border-b border-line">
      <div className="mx-auto max-w-6xl px-5 pt-10 md:px-10 md:pt-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="caption">{t("Innstillinger")}</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">
              {active === "profil" ? t("Profil og visittkort") : active === "cv" ? "CV" : t("Konto og varsler")}
            </h1>
          </div>
          <Link
            href={`/@${username}${active === "cv" ? "?fane=cv" : ""}`}
            className="group mb-1 inline-flex items-center gap-1.5 text-sm text-mist transition hover:text-fg"
          >
            {t("Se profilen")} <ArrowUpRight className="size-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>
        <div className="mt-8">
          <Tabs
            label={t("Innstillinger")}
            active={active}
            items={[
              { key: "profil", label: t("Profil"), href: "/profil/rediger" },
              { key: "cv", label: "CV", href: "/profil/rediger/cv" },
              { key: "konto", label: t("Konto og varsler"), href: "/profil/rediger/konto" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
