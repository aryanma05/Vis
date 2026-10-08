import "server-only";

import { and, asc, count, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit } from "@/lib/audit";
import { hasBusiness } from "@/lib/billing";
import { requireBusiness } from "@/lib/companies";
import { requireCompanyPermission } from "@/lib/company-access";
import { TEMPLATE_KIND_LABELS, type TemplateKind } from "@/lib/company-labels";
import { findSensitiveTerms } from "@/lib/fair-hiring";
import { notificationEmail, type Email } from "@/lib/mailer";
import { isUuid } from "@/lib/projects";
import { UserFacingError } from "@/lib/result";
import {
  DEFAULT_TEMPLATES,
  MAX_TEMPLATES,
  RESPONSE_DAYS,
  TEMPLATE_BODY_MAX,
  TEMPLATE_KINDS,
  TEMPLATE_NAME_MAX,
  TEMPLATE_SUBJECT_MAX,
  type TemplateText,
} from "@/lib/template-render";

export { DEFAULT_TEMPLATES, MERGE_FIELDS, renderMessage, renderSubject, renderTemplate, RESPONSE_DAYS, TEMPLATE_KINDS } from "@/lib/template-render";

const { company, companyMessageTemplate } = schema;

// Svarmaler (Bedrift) og «Takk for søknaden» (alle planer). Standardmalene ligger i koden
// (lib/template-render.ts) og er alltid med; egne maler lagres per bedrift. Den nyeste egne
// malen av en type brukes når ingen er valgt, så bedriftens egen tekst blir standarden.

export type MessageTemplate = { id: string; kind: TemplateKind; name: string; subject: string; body: string; builtIn: boolean; updatedAt: Date | null };

// Standardmalene har id-en «standard:<type>», så de kan velges like enkelt som egne maler.
const STANDARD = "standard:";
export const standardTemplateId = (kind: TemplateKind) => `${STANDARD}${kind}`;
const isKind = (value: unknown): value is TemplateKind => (TEMPLATE_KINDS as readonly unknown[]).includes(value);

const templateColumns = {
  id: companyMessageTemplate.id,
  kind: companyMessageTemplate.kind,
  name: companyMessageTemplate.name,
  subject: companyMessageTemplate.subject,
  body: companyMessageTemplate.body,
  updatedAt: companyMessageTemplate.updatedAt,
};

// Alle malene bedriften kan velge: standardmalene først, så egne (nyeste først per type).
export async function listTemplates(viewerId: string, companyId: string): Promise<MessageTemplate[]> {
  await requireCompanyPermission(viewerId, companyId, "applications.move");
  const rows = await db
    .select(templateColumns)
    .from(companyMessageTemplate)
    .where(eq(companyMessageTemplate.companyId, companyId))
    .orderBy(asc(companyMessageTemplate.kind), desc(companyMessageTemplate.updatedAt))
    .limit(MAX_TEMPLATES);
  return [
    ...TEMPLATE_KINDS.map((kind) => ({ id: standardTemplateId(kind), kind, ...DEFAULT_TEMPLATES[kind], builtIn: true, updatedAt: null })),
    ...rows.map((r) => ({ ...r, builtIn: false })),
  ];
}

// Malen som skal sendes: den valgte (må tilhøre bedriften), ellers den nyeste egne av typen
// (bare med Bedrift), ellers standardmalen. Tilgangen er sjekket av den som kaller.
export async function pickTemplate(companyId: string, kind: TemplateKind, templateId?: string | null): Promise<TemplateText & { custom: boolean }> {
  const id = templateId ? String(templateId) : "";
  if (id.startsWith(STANDARD)) {
    const chosen = id.slice(STANDARD.length);
    if (!isKind(chosen)) throw new UserFacingError("Fant ikke malen.");
    return { ...DEFAULT_TEMPLATES[chosen], custom: false };
  }
  if (id) {
    if (!isUuid(id)) throw new UserFacingError("Fant ikke malen.");
    const [row] = await db
      .select(templateColumns)
      .from(companyMessageTemplate)
      .where(and(eq(companyMessageTemplate.id, id), eq(companyMessageTemplate.companyId, companyId)))
      .limit(1);
    if (!row) throw new UserFacingError("Fant ikke malen.");
    return { name: row.name, subject: row.subject, body: row.body, custom: true };
  }
  if (await hasBusiness(companyId)) {
    const [row] = await db
      .select(templateColumns)
      .from(companyMessageTemplate)
      .where(and(eq(companyMessageTemplate.companyId, companyId), eq(companyMessageTemplate.kind, kind)))
      .orderBy(desc(companyMessageTemplate.updatedAt))
      .limit(1);
    if (row) return { name: row.name, subject: row.subject, body: row.body, custom: true };
  }
  return { ...DEFAULT_TEMPLATES[kind], custom: false };
}

export type TemplateInput = { id?: string | null; kind: string; name?: string | null; subject: string; body: string };

// Lagrer en ny eller endret mal (Bedrift). Gir advarsler hvis teksten nevner noe man ikke
// skal vurdere kandidater på (lib/fair-hiring.ts); ingenting blokkeres.
export async function saveTemplate(actorId: string, companyId: string, input: TemplateInput) {
  await requireCompanyPermission(actorId, companyId, "templates.manage");
  await requireBusiness(companyId);
  if (!isKind(input.kind)) throw new UserFacingError("Ukjent maltype.");
  const kind = input.kind;
  const name = (String(input.name ?? "").replace(/\s+/g, " ").trim() || TEMPLATE_KIND_LABELS[kind]).slice(0, TEMPLATE_NAME_MAX);
  const subject = String(input.subject ?? "").replace(/\s+/g, " ").trim();
  const body = String(input.body ?? "").replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!subject) throw new UserFacingError("Malen trenger et emne.");
  if (subject.length > TEMPLATE_SUBJECT_MAX) throw new UserFacingError("Emnet kan ha maks {n} tegn.", { n: TEMPLATE_SUBJECT_MAX });
  if (!body) throw new UserFacingError("Malen trenger en tekst.");
  if (body.length > TEMPLATE_BODY_MAX) throw new UserFacingError("Teksten kan ha maks {n} tegn.", { n: TEMPLATE_BODY_MAX });

  let id: string;
  if (input.id) {
    if (!isUuid(String(input.id))) throw new UserFacingError("Fant ikke malen.");
    const updated = await db
      .update(companyMessageTemplate)
      .set({ kind, name, subject, body })
      .where(and(eq(companyMessageTemplate.id, String(input.id)), eq(companyMessageTemplate.companyId, companyId)))
      .returning({ id: companyMessageTemplate.id });
    if (updated.length === 0) throw new UserFacingError("Fant ikke malen.");
    id = updated[0].id;
  } else {
    const [{ n }] = await db.select({ n: count() }).from(companyMessageTemplate).where(eq(companyMessageTemplate.companyId, companyId));
    if (Number(n) >= MAX_TEMPLATES) throw new UserFacingError("Dere kan ha opptil {n} maler.", { n: MAX_TEMPLATES });
    const [row] = await db.insert(companyMessageTemplate).values({ companyId, kind, name, subject, body, createdById: actorId }).returning({ id: companyMessageTemplate.id });
    id = row.id;
  }
  await audit({ companyId, actorId, action: "template.saved", targetType: "template", targetId: id, label: name, meta: { kind, created: !input.id } });
  return { id, warnings: findSensitiveTerms(`${subject}\n${body}`) };
}

// Sletting krever ikke Bedrift, så man kan rydde etter at abonnementet er avsluttet.
export async function deleteTemplate(actorId: string, templateId: string) {
  if (!isUuid(templateId)) throw new UserFacingError("Fant ikke malen.");
  const [row] = await db
    .select({ companyId: companyMessageTemplate.companyId, name: companyMessageTemplate.name, kind: companyMessageTemplate.kind })
    .from(companyMessageTemplate)
    .where(eq(companyMessageTemplate.id, templateId))
    .limit(1);
  if (!row) throw new UserFacingError("Fant ikke malen.");
  await requireCompanyPermission(actorId, row.companyId, "templates.manage");
  await db.delete(companyMessageTemplate).where(and(eq(companyMessageTemplate.id, templateId), eq(companyMessageTemplate.companyId, row.companyId)));
  await audit({ companyId: row.companyId, actorId, action: "template.deleted", targetType: "template", targetId: templateId, label: row.name, meta: { kind: row.kind } });
  return row.companyId;
}

// «Automatisk svar» (alle planer): «Takk for søknaden» når noen søker, med svartid i dager.
export async function setCompanyMessaging(actorId: string, companyId: string, { autoReply, responseDays }: { autoReply: boolean; responseDays: number }) {
  await requireCompanyPermission(actorId, companyId, "templates.manage");
  const days = Number(responseDays);
  if (!(RESPONSE_DAYS as readonly number[]).includes(days)) throw new UserFacingError("Svartiden må være 7, 10, 14 eller 21 dager.");
  await db.update(company).set({ autoReply: Boolean(autoReply), responseDays: days }).where(eq(company.id, companyId));
  await audit({ companyId, actorId, action: "company.updated", targetType: "company", targetId: companyId, meta: { autoReply: Boolean(autoReply), responseDays: days } });
}

// E-posten med en ferdig flettet mal. Teksten er ren tekst, og mailer escaper den.
export function templateEmail(to: string, message: { subject: string; body: string }, { path, button }: { path: string; button: string }): Email {
  return notificationEmail({ to, subject: message.subject, heading: message.subject, intro: message.body, path, button });
}
