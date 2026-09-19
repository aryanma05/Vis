import { formatPeriod } from "@/lib/format";
import type { Cv } from "@/lib/cv";

// Strukturert CV. "wide" brukes når det ikke finnes noe CV-dokument ved siden av.
export default function CvTimeline({ cv, wide = false }: { cv: Cv; wide?: boolean }) {
  const row = wide ? "grid gap-2 md:grid-cols-[180px_1fr] md:gap-10" : "";
  const heading = "font-mono text-[11px] uppercase tracking-[0.2em] text-mist/60";

  return (
    <div className={wide ? "space-y-16" : "space-y-12"}>
      {cv.experience.length > 0 && (
        <section>
          <h3 className={heading}>Erfaring</h3>
          <ol className="mt-5 divide-y divide-line border-y border-line">
            {cv.experience.map((e) => (
              <li key={e.id} className={`py-5 ${row}`}>
                <p className="font-mono text-xs text-mist/70 md:pt-1">{formatPeriod(e.startDate, e.endDate)}</p>
                <div>
                  <p className="font-medium text-white">{e.title}</p>
                  <p className="text-sm text-ice">
                    {e.organization}
                    {e.location && <span className="text-mist/60"> · {e.location}</span>}
                  </p>
                  {e.description && <p className="mt-2 whitespace-pre-line text-sm leading-6 text-mist">{e.description}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {cv.education.length > 0 && (
        <section>
          <h3 className={heading}>Utdanning</h3>
          <ol className="mt-5 divide-y divide-line border-y border-line">
            {cv.education.map((e) => (
              <li key={e.id} className={`py-5 ${row}`}>
                <p className="font-mono text-xs text-mist/70 md:pt-1">{formatPeriod(e.startDate, e.endDate)}</p>
                <div>
                  <p className="font-medium text-white">{e.institution}</p>
                  {(e.degree || e.fieldOfStudy) && (
                    <p className="text-sm text-ice">{[e.degree, e.fieldOfStudy].filter(Boolean).join(", ")}</p>
                  )}
                  {e.description && <p className="mt-2 whitespace-pre-line text-sm leading-6 text-mist">{e.description}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {cv.skills.length > 0 && (
        <section>
          <h3 className={heading}>Ferdigheter</h3>
          <p className="mt-5 leading-8 text-mist">
            {cv.skills.map((s, i) => (
              <span key={s}>
                <span className="text-white">{s}</span>
                {i < cv.skills.length - 1 && <span className="mx-2 text-mist/40">/</span>}
              </span>
            ))}
          </p>
        </section>
      )}
    </div>
  );
}
