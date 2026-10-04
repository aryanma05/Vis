import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CvToolbar from "@/components/cv/CvToolbar";
import CvView from "@/components/cv/CvView";
import { isPro } from "@/lib/billing";
import { CV_TEMPLATES, isProTemplate, type CvTemplate } from "@/lib/constants";
import { buildCvViewData, effectiveTemplate } from "@/lib/cv-view";
import { showsBranding } from "@/lib/pro";
import { getProfileBase, getProfileByUsername } from "@/lib/profiles";
import { getCurrentUser } from "@/lib/session";
import { isLocale, makeT } from "@/lib/i18n";
import { getLocale, getT } from "@/lib/i18n/server";

type Props = { params: Promise<{ username: string }>; searchParams: Promise<{ mal?: string; skriv?: string; sprak?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [profile, t] = await Promise.all([getProfileBase(decodeURIComponent((await params).username)), getT()]);
  if (!profile) return { title: t("Fant ikke CV-en"), robots: { index: false } };
  return {
    title: `CV – ${profile.name}`,
    description: profile.headline ?? t("CV-en til {name} på Vis.", { name: profile.name }),
    alternates: { canonical: `/@${profile.username}/cv` },
  };
}

// Den delbare nett-CV-en. Samme side brukes til utskrift og «Lagre som PDF».
export default async function CvPage({ params, searchParams }: Props) {
  const [{ username }, { mal, skriv, sprak }] = await Promise.all([params, searchParams]);
  const [viewer, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  const t = makeT(locale);
  // CV-en kan vises på et annet språk enn resten av siden (?sprak=en).
  const cvLocale = isLocale(sprak) ? sprak : locale;
  const profile = await getProfileByUsername(decodeURIComponent(username), viewer?.id);
  if (!profile) notFound();

  const [ownerPro, branding] = await Promise.all([isPro(profile.id), showsBranding(profile.id)]);
  const requested: CvTemplate = CV_TEMPLATES.includes(mal as CvTemplate) ? (mal as CvTemplate) : profile.cvTemplate;
  // Eieren kan forhåndsvise Pro-malene uten Pro; andre ser dem bare når eieren har Pro.
  const template = profile.isOwner && isProTemplate(requested) ? requested : effectiveTemplate(requested, ownerPro);

  return (
    <main className="px-3 pb-28 pt-8 sm:px-5 md:pb-20 md:pl-28 md:pr-10 md:pt-12 print:p-0">
      <div className="mx-auto max-w-[820px]">
        <CvToolbar
          username={profile.username}
          name={profile.name}
          template={template}
          savedTemplate={profile.cvTemplate}
          isOwner={profile.isOwner}
          ownerPro={ownerPro}
          autoPrint={skriv === "1"}
          cvLocale={cvLocale}
        />
        <div className="mt-8 print:mt-0">
          <CvView data={buildCvViewData(profile, { branding, locale: cvLocale })} template={template} />
        </div>
        <p className="mt-6 text-center text-xs text-mist print:hidden">
          {t("Tips: I utskriftsvinduet, slå av «Topptekst og bunntekst» for en ren PDF.")}
        </p>
      </div>
    </main>
  );
}
