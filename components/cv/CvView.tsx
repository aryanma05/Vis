import type { CSSProperties } from "react";
import type { CvTemplate } from "@/lib/constants";
import { formatPeriod } from "@/lib/format";

// CV-en som et papirark, i en av tre maler. Brukes på profilen, på den delbare
// nett-CV-en (/@brukernavn/cv) og når man skriver ut / lagrer som PDF.

export type CvViewData = {
  name: string;
  headline: string | null;
  location: string | null;
  website: string | null;
  profileUrl: string;
  links: { label: string; url: string }[];
  summary: string | null;
  experience: { id: string; title: string; organization: string; location: string | null; startDate: string | null; endDate: string | null; description: string | null }[];
  education: { id: string; institution: string; degree: string | null; fieldOfStudy: string | null; startDate: string | null; endDate: string | null; description: string | null }[];
  skills: string[];
  projects: { title: string; summary: string | null; tags: string[]; url: string }[];
  accent: string;
};

const host = (url: string) => {
  try {
    return new URL(url).host.replace(/^www\./, "") + new URL(url).pathname.replace(/\/$/, "");
  } catch {
    return url;
  }
};

function Lines({ text, className = "" }: { text: string | null; className?: string }) {
  if (!text) return null;
  const lines = text
    .split("\n")
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
  if (lines.length === 1) return <p className={className}>{lines[0]}</p>;
  return (
    <ul className={`list-disc space-y-0.5 pl-4 marker:text-[#94a3b8] ${className}`}>
      {lines.map((l, i) => (
        <li key={i}>{l}</li>
      ))}
    </ul>
  );
}

function Contact({ data, className = "", vertical = false }: { data: CvViewData; className?: string; vertical?: boolean }) {
  const items = [data.location, data.profileUrl, data.website ? host(data.website) : null, ...data.links.map((l) => `${l.label}: ${host(l.url)}`)].filter(Boolean) as string[];
  return (
    <p className={`${vertical ? "flex flex-col gap-1" : "flex flex-wrap gap-x-3 gap-y-0.5"} ${className}`}>
      {items.map((item, i) => (
        <span key={i} className="break-all">
          {item}
        </span>
      ))}
    </p>
  );
}

const paper =
  "cv-paper mx-auto w-full max-w-[820px] bg-white text-[#0f172a] shadow-[0_40px_90px_-40px_rgb(0_0_0/0.75)] ring-1 ring-black/5 [print-color-adjust:exact] [-webkit-print-color-adjust:exact]";

export default function CvView({ data, template }: { data: CvViewData; template: CvTemplate }) {
  const style = { "--cv-accent": data.accent, fontFamily: "var(--font-schibsted), system-ui, sans-serif" } as CSSProperties;
  if (template === "moderne") return <Modern data={data} style={style} />;
  if (template === "kompakt") return <Compact data={data} style={style} />;
  return <Classic data={data} style={style} />;
}

function EmptyNote() {
  return <p className="text-sm text-[#64748b]">Ingen erfaring eller utdanning er lagt til ennå.</p>;
}

/* -------------------------------------------------------------------------- */
/*  Klassisk: én kolonne med etiketter i margen                               */
/* -------------------------------------------------------------------------- */

function Classic({ data, style }: { data: CvViewData; style: CSSProperties }) {
  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <section className="cv-section grid gap-2 border-t border-[#e2e8f0] py-5 sm:grid-cols-[130px_1fr] sm:gap-6">
      <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">{label}</h2>
      <div className="min-w-0">{children}</div>
    </section>
  );
  return (
    <article className={`${paper} px-7 py-10 sm:px-14 sm:py-14`} style={style}>
      <header className="pb-7">
        <h1 className="text-[34px] font-extrabold leading-none tracking-[-0.03em]">{data.name}</h1>
        {data.headline && <p className="mt-2.5 text-[17px] text-[#334155]">{data.headline}</p>}
        <Contact data={data} className="mt-3 text-[12.5px] text-[#64748b]" />
      </header>
      {data.summary && (
        <Row label="Profil">
          <p className="whitespace-pre-line text-[13.5px] leading-6 text-[#1e293b]">{data.summary}</p>
        </Row>
      )}
      {data.experience.length > 0 && (
        <Row label="Erfaring">
          <ol className="space-y-4">
            {data.experience.map((e) => (
              <li key={e.id} className="cv-entry">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <p className="text-[14px] font-semibold">
                    {e.title}, <span className="font-normal text-[#334155]">{e.organization}</span>
                  </p>
                  <p className="text-[12px] tabular-nums text-[#64748b]">{formatPeriod(e.startDate, e.endDate)}</p>
                </div>
                {e.location && <p className="text-[12px] text-[#64748b]">{e.location}</p>}
                <Lines text={e.description} className="mt-1.5 text-[13px] leading-[1.55] text-[#334155]" />
              </li>
            ))}
          </ol>
        </Row>
      )}
      {data.education.length > 0 && (
        <Row label="Utdanning">
          <ol className="space-y-3">
            {data.education.map((e) => (
              <li key={e.id} className="cv-entry">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <p className="text-[14px] font-semibold">{e.institution}</p>
                  <p className="text-[12px] tabular-nums text-[#64748b]">{formatPeriod(e.startDate, e.endDate)}</p>
                </div>
                {(e.degree || e.fieldOfStudy) && <p className="text-[13px] text-[#334155]">{[e.degree, e.fieldOfStudy].filter(Boolean).join(", ")}</p>}
                <Lines text={e.description} className="mt-1 text-[13px] leading-[1.55] text-[#334155]" />
              </li>
            ))}
          </ol>
        </Row>
      )}
      {data.skills.length > 0 && (
        <Row label="Ferdigheter">
          <p className="text-[13.5px] leading-6 text-[#1e293b]">{data.skills.join(" · ")}</p>
        </Row>
      )}
      {data.projects.length > 0 && (
        <Row label="Prosjekter">
          <ul className="space-y-2.5">
            {data.projects.map((p) => (
              <li key={p.url} className="cv-entry text-[13px] leading-[1.55]">
                <span className="font-semibold">{p.title}</span>
                {p.summary && <span className="text-[#334155]"> – {p.summary}</span>}
                {p.tags.length > 0 && <span className="block text-[11.5px] text-[#64748b]">{p.tags.slice(0, 5).join(", ")}</span>}
              </li>
            ))}
          </ul>
        </Row>
      )}
      {data.experience.length + data.education.length === 0 && !data.summary && <EmptyNote />}
      <footer className="mt-6 border-t border-[#e2e8f0] pt-4 text-[11px] text-[#94a3b8]">Hele profilen og prosjektene: {data.profileUrl}</footer>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/*  Moderne: sidekolonne i aksentfargen                                       */
/* -------------------------------------------------------------------------- */

function Modern({ data, style }: { data: CvViewData; style: CSSProperties }) {
  const H = ({ children }: { children: React.ReactNode }) => (
    <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-[#0f172a]">{children}</h2>
  );
  return (
    <article className={`${paper} grid overflow-hidden sm:grid-cols-[34%_1fr]`} style={style}>
      <aside className="px-7 py-10 sm:px-8 sm:py-12" style={{ background: "color-mix(in srgb, var(--cv-accent) 22%, white)" }}>
        <h1 className="text-[28px] font-extrabold leading-[1.05] tracking-[-0.03em]">{data.name}</h1>
        {data.headline && <p className="mt-2 text-[14px] leading-snug text-[#1e293b]">{data.headline}</p>}
        <div className="mt-7">
          <H>Kontakt</H>
          <Contact data={data} vertical className="text-[12px] leading-5 text-[#1e293b]" />
        </div>
        {data.skills.length > 0 && (
          <div className="mt-7">
            <H>Ferdigheter</H>
            <ul className="flex flex-wrap gap-1.5">
              {data.skills.map((s) => (
                <li key={s} className="rounded-md bg-white/70 px-2 py-0.5 text-[11.5px] text-[#0f172a]">
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
        {data.education.length > 0 && (
          <div className="mt-7">
            <H>Utdanning</H>
            <ol className="space-y-3">
              {data.education.map((e) => (
                <li key={e.id} className="cv-entry text-[12.5px] leading-5">
                  <p className="font-semibold">{e.institution}</p>
                  {(e.degree || e.fieldOfStudy) && <p className="text-[#1e293b]">{[e.degree, e.fieldOfStudy].filter(Boolean).join(", ")}</p>}
                  <p className="tabular-nums text-[#475569]">{formatPeriod(e.startDate, e.endDate)}</p>
                </li>
              ))}
            </ol>
          </div>
        )}
      </aside>
      <div className="px-7 py-10 sm:px-10 sm:py-12">
        {data.summary && (
          <section className="cv-section mb-8">
            <H>Profil</H>
            <p className="whitespace-pre-line text-[13.5px] leading-6 text-[#1e293b]">{data.summary}</p>
          </section>
        )}
        {data.experience.length > 0 && (
          <section className="cv-section mb-8">
            <H>Erfaring</H>
            <ol className="relative space-y-5 border-l-2 pl-5" style={{ borderColor: "color-mix(in srgb, var(--cv-accent) 55%, white)" }}>
              {data.experience.map((e) => (
                <li key={e.id} className="cv-entry relative">
                  <span className="absolute -left-[27px] top-1.5 size-3 rounded-full border-2 border-white" style={{ background: "color-mix(in srgb, var(--cv-accent) 80%, #0f172a)" }} />
                  <p className="text-[12px] tabular-nums text-[#64748b]">{formatPeriod(e.startDate, e.endDate)}</p>
                  <p className="text-[14.5px] font-semibold">{e.title}</p>
                  <p className="text-[13px] text-[#334155]">
                    {e.organization}
                    {e.location && ` · ${e.location}`}
                  </p>
                  <Lines text={e.description} className="mt-1.5 text-[13px] leading-[1.55] text-[#334155]" />
                </li>
              ))}
            </ol>
          </section>
        )}
        {data.projects.length > 0 && (
          <section className="cv-section">
            <H>Utvalgte prosjekter</H>
            <ul className="grid gap-3 sm:grid-cols-2">
              {data.projects.map((p) => (
                <li key={p.url} className="cv-entry rounded-lg border border-[#e2e8f0] p-3 text-[12.5px] leading-5">
                  <p className="font-semibold">{p.title}</p>
                  {p.summary && <p className="mt-0.5 text-[#334155]">{p.summary}</p>}
                  {p.tags.length > 0 && <p className="mt-1 text-[11px] text-[#64748b]">{p.tags.slice(0, 4).join(" · ")}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}
        {data.experience.length + data.education.length === 0 && !data.summary && <EmptyNote />}
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/*  Kompakt: tett, to kolonner, får plass til mye                              */
/* -------------------------------------------------------------------------- */

function Compact({ data, style }: { data: CvViewData; style: CSSProperties }) {
  const H = ({ children }: { children: React.ReactNode }) => (
    <h2 className="mb-2 border-b-2 pb-1 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ borderColor: "var(--cv-accent)" }}>
      {children}
    </h2>
  );
  return (
    <article className={`${paper} px-7 py-9 sm:px-11 sm:py-11`} style={style}>
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#0f172a] pb-4">
        <div>
          <h1 className="text-[26px] font-extrabold leading-none tracking-[-0.03em]">{data.name}</h1>
          {data.headline && <p className="mt-1.5 text-[13.5px] text-[#334155]">{data.headline}</p>}
        </div>
        <Contact data={data} vertical className="text-right text-[11px] leading-4 text-[#475569]" />
      </header>
      {data.summary && <p className="mt-4 whitespace-pre-line text-[12.5px] leading-5 text-[#1e293b]">{data.summary}</p>}
      <div className="mt-5 grid gap-6 sm:grid-cols-[1.35fr_1fr]">
        <div>
          {data.experience.length > 0 && (
            <section className="cv-section">
              <H>Erfaring</H>
              <ol className="space-y-3">
                {data.experience.map((e) => (
                  <li key={e.id} className="cv-entry text-[12px] leading-[1.45]">
                    <p className="flex justify-between gap-3">
                      <span className="font-semibold">{e.title}</span>
                      <span className="shrink-0 tabular-nums text-[#64748b]">{formatPeriod(e.startDate, e.endDate)}</span>
                    </p>
                    <p className="text-[#334155]">
                      {e.organization}
                      {e.location && `, ${e.location}`}
                    </p>
                    <Lines text={e.description} className="mt-1 text-[#334155]" />
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
        <div className="space-y-5">
          {data.education.length > 0 && (
            <section className="cv-section">
              <H>Utdanning</H>
              <ol className="space-y-2">
                {data.education.map((e) => (
                  <li key={e.id} className="cv-entry text-[12px] leading-[1.45]">
                    <p className="font-semibold">{e.institution}</p>
                    <p className="text-[#334155]">{[e.degree, e.fieldOfStudy].filter(Boolean).join(", ")}</p>
                    <p className="tabular-nums text-[#64748b]">{formatPeriod(e.startDate, e.endDate)}</p>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {data.skills.length > 0 && (
            <section className="cv-section">
              <H>Ferdigheter</H>
              <p className="text-[12px] leading-5 text-[#1e293b]">{data.skills.join(", ")}</p>
            </section>
          )}
          {data.projects.length > 0 && (
            <section className="cv-section">
              <H>Prosjekter</H>
              <ul className="space-y-1.5">
                {data.projects.map((p) => (
                  <li key={p.url} className="cv-entry text-[12px] leading-[1.45]">
                    <span className="font-semibold">{p.title}</span>
                    {p.summary && <span className="text-[#334155]"> – {p.summary}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
      {data.experience.length + data.education.length === 0 && !data.summary && <div className="mt-6"><EmptyNote /></div>}
    </article>
  );
}
