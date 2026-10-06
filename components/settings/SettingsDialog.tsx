"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { BellRing, ChevronRight, ShieldCheck, UserPen } from "lucide-react";
import ThemeSwitch from "@/components/nav/ThemeSwitch";
import { useChangeLocale, useT } from "@/components/LocaleProvider";
import { useDisplayPref } from "@/components/settings/display-prefs";
import { OPEN_SETTINGS_EVENT } from "@/components/settings/settings-events";
import Dialog from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/misc";
import Switch from "@/components/ui/switch";
import { Segmented } from "@/components/ui/tabs";
import type { DisplayPref } from "@/lib/display-prefs";
import type { Locale } from "@/lib/i18n";

// Språknavnene skrives alltid på sitt eget språk, så man finner sitt eget uansett.
const LANGUAGES: { value: Locale; label: ReactNode }[] = [
  { value: "nb", label: <span lang="nb">Norsk</span> },
  { value: "en", label: <span lang="en">English</span> },
];

const DISPLAY: { name: DisplayPref; label: string; description: string }[] = [
  { name: "motion", label: "Reduser bevegelse", description: "Færre animasjoner. Ingenting hopper, glir eller spretter." },
  { name: "transparency", label: "Tettere flater", description: "Glasset blir tett, så teksten står tydeligere mot bakgrunnen." },
  { name: "contrast", label: "Mer kontrast", description: "Tydeligere tekst, streker og kanter." },
];

const ACCOUNT = [
  { href: "/profil/rediger", label: "Rediger profil", description: "Navn, bilde, banner og kjæledyr", Icon: UserPen },
  { href: "/profil/rediger/konto#varsler", label: "E-postvarsler", description: "Velg hva du får e-post om", Icon: BellRing },
  { href: "/profil/rediger/konto", label: "Konto og sikkerhet", description: "Abonnement, passord og to-trinns innlogging", Icon: ShieldCheck },
];

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-5 first:border-t-0 first:pt-0">
      <h3 className="caption mb-3">{title}</h3>
      {children}
    </section>
  );
}

function DisplaySwitch({ name, label, description }: (typeof DISPLAY)[number]) {
  const t = useT();
  const pref = useDisplayPref(name);
  return (
    <Switch
      checked={pref.on}
      disabled={pref.system}
      onChange={pref.set}
      label={t(label)}
      description={pref.system ? t("Slått på i innstillingene på enheten din.") : t(description)}
    />
  );
}

// Innstillingene: språk, tema og tilgjengelighet for denne nettleseren, og snarveier til
// kontoinnstillingene for den som er logget inn. Åpnes med openSettings() fra
// tannhjulet i menyen, profilmenyen eller søkepaletten.
export default function SettingsDialog({ loggedIn }: { loggedIn: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const { chosen, setLocale, switching } = useChangeLocale();

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_SETTINGS_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, onOpen);
  }, []);

  return (
    <Dialog open={open} onClose={() => setOpen(false)} title={t("Innstillinger")} description={t("Lagres i denne nettleseren.")}>
      <div className="space-y-5">
        <Group title={t("Språk")}>
          <div className="flex flex-wrap items-center gap-3">
            <Segmented label={t("Språk")} options={LANGUAGES} value={chosen} onChange={setLocale} />
            <span aria-live="polite" className={`text-[13px] text-mist transition-opacity ${switching ? "opacity-100" : "opacity-0"}`}>
              {switching ? t("Bytter språk …") : ""}
            </span>
          </div>
        </Group>

        <Group title={t("Utseende")}>
          <div className="max-w-sm">
            <ThemeSwitch labels />
          </div>
        </Group>

        <Group title={t("Tilgjengelighet")}>
          <div className="space-y-4">
            {DISPLAY.map((pref) => (
              <DisplaySwitch key={pref.name} {...pref} />
            ))}
          </div>
        </Group>

        {loggedIn && (
          <Group title={t("Konto")}>
            <ul className="-mx-2">
              {ACCOUNT.map(({ href, label, description, Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-2xl px-2 py-2.5 transition hover:bg-fill focus-visible:bg-fill"
                  >
                    <span className="glass-chip flex size-9 shrink-0 items-center justify-center rounded-full text-mist">
                      <Icon className="size-[17px]" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-fg">{t(label)}</span>
                      <span className="block truncate text-[13px] text-mist">{t(description)}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-mist" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </Group>
        )}

        <p className="hidden items-center gap-1.5 border-t border-line pt-5 text-[13px] text-mist md:flex">
          {t("Søk fra hvor som helst med")} <Kbd>⌘K</Kbd> {t("eller")} <Kbd>/</Kbd>
        </p>
      </div>
    </Dialog>
  );
}
