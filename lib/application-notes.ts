import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit } from "@/lib/audit";
import { requireBusiness } from "@/lib/companies";
import { requireCompanyPermission } from "@/lib/company-access";
import { can } from "@/lib/company-permissions";
import { findSensitiveTerms } from "@/lib/fair-hiring";
import { notify } from "@/lib/notifications";
import { isUuid } from "@/lib/projects";
import { enforce } from "@/lib/rate-limit";
import { UserFacingError } from "@/lib/result";

const { applicationNote, companyMember, job, jobApplication, user } = schema;

// Notater på en søker (Bedrift). Ett notat per rad med forfatter og tid, så ingen skriver over
// hverandre. @brukernavn virker bare for folk i bedriften, og de får et varsel. Kandidaten kan be
// om innsyn, så notatene er med i dataeksporten deres.

export const NOTE_MAX = 2000;

async function applicationCompany(applicationId: string) {
  if (!isUuid(applicationId)) throw new UserFacingError("Fant ikke søknaden.");
  const [row] = await db
    .select({ companyId: job.companyId, jobId: job.id, jobTitle: job.title, status: jobApplication.status, candidateId: jobApplication.userId })
    .from(jobApplication)
    .innerJoin(job, eq(job.id, jobApplication.jobId))
    .where(eq(jobApplication.id, applicationId))
    .limit(1);
  if (!row) throw new UserFacingError("Fant ikke søknaden.");
  return row;
}

export async function listNotes(viewerId: string, applicationId: string) {
  const app = await applicationCompany(applicationId);
  const role = await requireCompanyPermission(viewerId, app.companyId, "applications.view");
  const notes = await db
    .select({ id: applicationNote.id, body: applicationNote.body, createdAt: applicationNote.createdAt, editedAt: applicationNote.editedAt, authorId: applicationNote.authorId, name: user.name, username: user.username, image: user.image })
    .from(applicationNote)
    .leftJoin(user, eq(user.id, applicationNote.authorId))
    .where(eq(applicationNote.applicationId, applicationId))
    .orderBy(asc(applicationNote.createdAt));
  const admin = can(role, "members.manage");
  return notes.map((n) => ({ ...n, canDelete: n.authorId === viewerId || admin }));
}

// Medlemmene som kan nevnes (til forslag i skrivefeltet).
export async function listMentionable(viewerId: string, companyId: string) {
  await requireCompanyPermission(viewerId, companyId, "members.view");
  return db
    .select({ id: user.id, name: user.name, username: user.username })
    .from(companyMember)
    .innerJoin(user, eq(user.id, companyMember.userId))
    .where(eq(companyMember.companyId, companyId))
    .orderBy(asc(user.name));
}

export async function addNote(viewerId: string, applicationId: string, body: string) {
  const app = await applicationCompany(applicationId);
  await requireCompanyPermission(viewerId, app.companyId, "notes.write");
  await requireBusiness(app.companyId);
  if (app.status === "trukket") throw new UserFacingError("Kandidaten har trukket søknaden.");
  const text = body.trim().slice(0, NOTE_MAX);
  if (!text) throw new UserFacingError("Notatet er tomt.");
  await enforce("applicationNote", viewerId);

  // @brukernavn → medlemmer i bedriften. Andre navn blir stående som tekst.
  const usernames = [...new Set([...text.matchAll(/@([a-z0-9_-]{2,30})/gi)].map((m) => m[1].toLowerCase()))];
  const mentioned = usernames.length
    ? await db
        .select({ id: user.id })
        .from(companyMember)
        .innerJoin(user, eq(user.id, companyMember.userId))
        .where(and(eq(companyMember.companyId, app.companyId), inArray(user.username, usernames)))
    : [];
  const mentionIds = mentioned.map((m) => m.id).filter((id) => id !== viewerId);

  const [row] = await db.insert(applicationNote).values({ applicationId, authorId: viewerId, body: text, mentionIds }).returning({ id: applicationNote.id });
  await audit({ companyId: app.companyId, actorId: viewerId, action: "application.note", targetType: "application", targetId: applicationId, subjectUserId: app.candidateId, label: app.jobTitle });
  for (const userId of mentionIds) {
    await notify({ userId, actorId: viewerId, type: "application", data: { event: "mention", applicationId, jobId: app.jobId, jobTitle: app.jobTitle } });
  }
  return { id: row.id, warnings: findSensitiveTerms(text) };
}

export async function deleteNote(viewerId: string, noteId: string) {
  if (!isUuid(noteId)) throw new UserFacingError("Fant ikke notatet.");
  const [note] = await db.select({ applicationId: applicationNote.applicationId, authorId: applicationNote.authorId }).from(applicationNote).where(eq(applicationNote.id, noteId)).limit(1);
  if (!note) throw new UserFacingError("Fant ikke notatet.");
  const app = await applicationCompany(note.applicationId);
  const role = await requireCompanyPermission(viewerId, app.companyId, "applications.view");
  if (note.authorId !== viewerId && !can(role, "members.manage")) throw new UserFacingError("Du kan bare slette dine egne notater.");
  await db.delete(applicationNote).where(eq(applicationNote.id, noteId));
  return app.companyId;
}
