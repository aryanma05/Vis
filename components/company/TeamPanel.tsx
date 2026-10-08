import { MessagesSquare } from "lucide-react";
import NotesThread from "@/components/company/NotesThread";
import { listMentionable, listNotes } from "@/lib/application-notes";
import { can, type CompanyRole } from "@/lib/company-permissions";
import { getT } from "@/lib/i18n/server";

// Samarbeid på en søker (sidepanelet på søkersiden): notater med @nevning.
// Vurderingskort kommer senere (se veikartet).
export default async function TeamPanel({ applicationId, companyId, viewerId, role, business }: { applicationId: string; companyId: string; jobId: string; viewerId: string; role: CompanyRole; business: boolean }) {
  const t = await getT();
  const [notes, members] = await Promise.all([listNotes(viewerId, applicationId), listMentionable(viewerId, companyId)]);
  return (
    <section className="rounded-[22px] glass-card p-5">
      <h2 className="caption flex items-center gap-2">
        <MessagesSquare className="size-4" /> {t("Notater fra teamet")}
        {notes.length > 0 && <span className="rounded-full bg-fill px-2 text-xs text-mist">{notes.length}</span>}
      </h2>
      <div className="mt-3">
        {business || notes.length > 0 ? (
          <NotesThread
            applicationId={applicationId}
            notes={notes}
            members={members.filter((m) => m.id !== viewerId).map(({ username, name }) => ({ username, name }))}
            canWrite={business && can(role, "notes.write")}
          />
        ) : (
          <p className="text-sm text-mist">{t("Notater krever Bedrift.")}</p>
        )}
      </div>
    </section>
  );
}
