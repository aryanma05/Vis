"use client";

import { useT } from "@/components/LocaleProvider";

// «valgfritt» ved feltnavn. Egen klientkomponent, så Field kan brukes både på
// serveren og i nettleseren.
export default function OptionalLabel() {
  const t = useT();
  return <span className="ml-1.5 font-normal text-mist">{t("valgfritt")}</span>;
}
