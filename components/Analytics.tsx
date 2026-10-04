import Script from "next/script";

// Valgfri besøksstatistikk uten informasjonskapsler (Plausible eller Umami). Slås på med
// miljøvariabler, og personvernsiden nevner det automatisk når det er på.
export default function Analytics() {
  const plausible = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  if (plausible) {
    return (
      <Script
        defer
        data-domain={plausible}
        src={process.env.NEXT_PUBLIC_PLAUSIBLE_SRC || "https://plausible.io/js/script.js"}
        strategy="afterInteractive"
      />
    );
  }
  const umami = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
  if (umami) {
    return (
      <Script
        defer
        data-website-id={umami}
        src={process.env.NEXT_PUBLIC_UMAMI_SRC || "https://cloud.umami.is/script.js"}
        strategy="afterInteractive"
      />
    );
  }
  return null;
}

export const analyticsProvider = () =>
  process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN ? "Plausible" : process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID ? "Umami" : null;
