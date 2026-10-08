import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";

try {
  process.loadEnvFile(".env.local");
} catch {}
// E-postene skrives til konsollen (ingen e-posttjeneste), så testen kan lese lenken i dem.
delete process.env.BREVO_API_KEY;
delete process.env.RESEND_API_KEY;
const skip = !process.env.DATABASE_URL && "DATABASE_URL er ikke satt";

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

describe("invitasjoner, roller og tilgang", { skip }, () => {
  const owner = `test-${randomUUID()}`;
  const adminUser = `test-${randomUUID()}`;
  const recruiter = `test-${randomUUID()}`;
  const mailUser = `test-${randomUUID()}`;
  const wrongUser = `test-${randomUUID()}`;
  const unverified = `test-${randomUUID()}`;
  const outsider = `test-${randomUUID()}`;
  const fillers = Array.from({ length: 24 }, () => `test-${randomUUID()}`);
  const users = [owner, adminUser, recruiter, mailUser, wrongUser, unverified, outsider];
  const companies: string[] = [];
  let companyId = "";
  const username = (id: string) => id.slice(0, 30);
  const emailOf = (id: string) => `${id}@test.no`;

  // E-poster fra sendEmail (lib/mailer.ts) uten e-posttjeneste.
  const mails: string[] = [];
  const info = console.info;

  async function tokenFor(to: string) {
    for (let i = 0; i < 100; i++) {
      for (let j = mails.length - 1; j >= 0; j--) {
        if (!mails[j].includes(`Til: ${to}`)) continue;
        const match = mails[j].match(/\/invitasjon\/([A-Za-z0-9_-]{43})/);
        if (match) return match[1];
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`fant ingen invitasjon til ${to}`);
  }

  async function inviteRow(id: string) {
    const { db, schema } = await import("@/db");
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(schema.companyInvite).where(eq(schema.companyInvite.id, id));
    return row;
  }

  before(async () => {
    console.info = (...args: unknown[]) => {
      const text = args.map(String).join(" ");
      if (text.includes("[e-post]")) mails.push(text);
      else info(...args);
    };
    const { db, schema } = await import("@/db");
    for (const id of [...users, ...fillers]) {
      await db.insert(schema.user).values({ id, name: `Test ${id.slice(-4)}`, email: emailOf(id), emailVerified: id !== unverified, username: username(id) });
    }
    const { createCompany } = await import("@/lib/companies");
    companyId = (await createCompany(owner, { name: `Invitasjon ${owner.slice(-6)}`, acceptTerms: true })).id;
    companies.push(companyId);
  });

  after(async () => {
    console.info = info;
    const { db } = await import("@/db");
    const { sql } = await import("drizzle-orm");
    for (const id of companies) {
      await db.execute(sql`delete from company where id = ${id}`);
      await db.execute(sql`delete from plan_grant where owner_id = ${id}`);
    }
    for (const id of [...users, ...fillers]) await db.execute(sql`delete from "user" where id = ${id}`);
    await db.$client.end();
  });

  test("createCompany krever databehandleravtalen og bekreftet e-post, og eieren vises i teamet", async () => {
    const { createCompany, getCompanyById, listTeam } = await import("@/lib/companies");
    await assert.rejects(createCompany(owner, { name: "Uten avtale" }), /databehandleravtalen/);
    await assert.rejects(createCompany(unverified, { name: "Ubekreftet", acceptTerms: true }), /Bekreft e-postadressen/);
    const co = await getCompanyById(companyId);
    assert.ok(co?.termsAcceptedAt, "avtalen er godtatt");
    assert.equal(co?.termsVersion, "2026-10");
    assert.equal(co?.termsAcceptedById, owner);
    assert.deepEqual((await listTeam(companyId)).map((m) => [m.userId, m.admin]), [[owner, true]], "den som lager siden vises med en gang");
  });

  test("med @brukernavn: ingen tilgang før invitasjonen er godtatt, og bare én gang", async () => {
    const { db, schema } = await import("@/db");
    const { and, eq } = await import("drizzle-orm");
    const { getMembership } = await import("@/lib/companies");
    const { acceptInvite, inviteToCompany, listMyInvites } = await import("@/lib/company-invites");
    const { listNotifications } = await import("@/lib/notifications");

    const { id } = await inviteToCompany(owner, companyId, { target: `@${username(adminUser)}`, kind: "member", role: "admin" });
    assert.equal(await getMembership(adminUser, companyId), null, "ingen medlemsrad før man har sagt ja");
    const notes = await listNotifications(adminUser);
    assert.ok(notes.some((n) => n.type === "company_invite" && n.data.inviteId === id), "invitasjonen kommer som varsel");
    assert.deepEqual((await listMyInvites(adminUser)).map((i) => i.id), [id]);
    await assert.rejects(inviteToCompany(owner, companyId, { target: username(adminUser), kind: "member", role: "member" }), /allerede en invitasjon/);
    await assert.rejects(acceptInvite(outsider, { inviteId: id }), /Fant ikke invitasjonen/, "andre kan ikke bruke invitasjonen");

    await acceptInvite(adminUser, { inviteId: id });
    const [row] = await db
      .select({ role: schema.companyMember.role, showOnPage: schema.companyMember.showOnPage, invitedById: schema.companyMember.invitedById })
      .from(schema.companyMember)
      .where(and(eq(schema.companyMember.companyId, companyId), eq(schema.companyMember.userId, adminUser)));
    assert.deepEqual(row, { role: "admin", showOnPage: false, invitedById: owner });
    await assert.rejects(acceptInvite(adminUser, { inviteId: id }), /ikke lenger gyldig/, "en invitasjon kan bare brukes én gang");

    const audit = await db.select({ action: schema.companyAudit.action }).from(schema.companyAudit).where(eq(schema.companyAudit.companyId, companyId));
    assert.ok(audit.some((a) => a.action === "invite.sent") && audit.some((a) => a.action === "invite.accepted"), "invitasjonen logges");
    assert.ok((await listNotifications(owner)).some((n) => n.type === "company_access" && n.data.event === "accepted"), "den som inviterte får beskjed");
  });

  test("en administrator kan ikke gi administratortilgang; rekrutterere kan ikke invitere", async () => {
    const { getMembership } = await import("@/lib/companies");
    const { acceptInvite, inviteToCompany } = await import("@/lib/company-invites");
    await assert.rejects(inviteToCompany(adminUser, companyId, { target: username(recruiter), kind: "member", role: "admin" }), /Bare eieren/);
    const { id } = await inviteToCompany(adminUser, companyId, { target: username(recruiter), kind: "member", role: "member" });
    await acceptInvite(recruiter, { inviteId: id });
    assert.equal(await getMembership(recruiter, companyId), "member");
    await assert.rejects(inviteToCompany(recruiter, companyId, { target: username(outsider), kind: "member", role: "reviewer" }), /Rollen din gir ikke tilgang/);
    await assert.rejects(inviteToCompany(owner, companyId, { target: username(owner), kind: "member", role: "member" }), /deg selv/);
    await assert.rejects(inviteToCompany(owner, companyId, { target: username(recruiter), kind: "member", role: "member" }), /allerede tilgang/);
  });

  test("roller endres bare av den som har lov, og endringen logges", async () => {
    const { db, schema } = await import("@/db");
    const { and, eq } = await import("drizzle-orm");
    const { changeMemberRole, getMembership, removeCompanyMember } = await import("@/lib/companies");
    await assert.rejects(changeMemberRole(adminUser, companyId, recruiter, "admin"), /Bare eieren/);
    await assert.rejects(changeMemberRole(recruiter, companyId, adminUser, "reviewer"), /Rollen din gir ikke tilgang/);
    await assert.rejects(removeCompanyMember(adminUser, companyId, owner), /Eieren kan ikke fjernes/);
    await changeMemberRole(adminUser, companyId, recruiter, "reviewer");
    assert.equal(await getMembership(recruiter, companyId), "reviewer");
    await changeMemberRole(owner, companyId, recruiter, "member");
    const rows = await db
      .select({ meta: schema.companyAudit.meta })
      .from(schema.companyAudit)
      .where(and(eq(schema.companyAudit.companyId, companyId), eq(schema.companyAudit.action, "member.role_changed")));
    assert.equal(rows.length, 2);
  });

  test("på e-post lagres bare sha256 av lenken, og bare riktig, bekreftet adresse kan godta", async () => {
    const { getMembership } = await import("@/lib/companies");
    const { acceptInvite, getInviteByToken, inviteToCompany } = await import("@/lib/company-invites");
    const { id } = await inviteToCompany(owner, companyId, { target: emailOf(mailUser).toUpperCase(), kind: "member", role: "reviewer" });
    const token = await tokenFor(emailOf(mailUser));
    const row = await inviteRow(id);
    assert.equal(row.email, emailOf(mailUser), "adressen lagres med små bokstaver");
    assert.match(row.tokenHash ?? "", /^[0-9a-f]{64}$/);
    assert.equal(row.tokenHash, sha256(token), "hashen er sha256 av lenken");
    assert.ok(!JSON.stringify(row).includes(token), "selve lenken finnes ikke i databasen");
    assert.equal(row.invitedUserId, null);

    const shown = await getInviteByToken(token);
    assert.ok(shown && !JSON.stringify(shown).includes(emailOf(mailUser)), "hele adressen vises ikke");
    assert.match(shown!.emailMasked, /•••@test\.no$/);
    assert.equal((await getInviteByToken(token, wrongUser))?.viewer, "other");
    assert.equal((await getInviteByToken(token, mailUser))?.viewer, "match");
    assert.equal(await getInviteByToken("x".repeat(43)), null);

    await assert.rejects(acceptInvite(wrongUser, { token }), /annen e-postadresse/);
    await assert.rejects(acceptInvite(wrongUser, { inviteId: id }), /Fant ikke invitasjonen/);

    // Riktig adresse, men ikke bekreftet.
    await inviteToCompany(owner, companyId, { target: emailOf(unverified), kind: "member", role: "reviewer" });
    const other = await tokenFor(emailOf(unverified));
    assert.equal((await getInviteByToken(other, unverified))?.viewer, "unverified");
    await assert.rejects(acceptInvite(unverified, { token: other }), /Bekreft e-postadressen/);
    assert.equal(await getMembership(unverified, companyId), null);

    await acceptInvite(mailUser, { token });
    assert.equal(await getMembership(mailUser, companyId), "reviewer");
    await assert.rejects(acceptInvite(mailUser, { token }), /ikke lenger gyldig/);
  });

  test("avslåtte, trukkede og utløpte invitasjoner kan ikke godtas", async () => {
    const { db, schema } = await import("@/db");
    const { eq, sql } = await import("drizzle-orm");
    const { getMembership, isEmployee } = await import("@/lib/companies");
    const { acceptInvite, declineInvite, expireInvites, inviteToCompany, revokeInvite } = await import("@/lib/company-invites");

    const declined = await inviteToCompany(owner, companyId, { target: username(outsider), kind: "employee", title: "Designer" });
    await declineInvite(outsider, { inviteId: declined.id });
    await assert.rejects(acceptInvite(outsider, { inviteId: declined.id }), /ikke lenger gyldig/);

    const revoked = await inviteToCompany(adminUser, companyId, { target: username(outsider), kind: "member", role: "reviewer" });
    await assert.rejects(revokeInvite(recruiter, revoked.id), /Rollen din gir ikke tilgang/);
    await revokeInvite(adminUser, revoked.id);
    await assert.rejects(acceptInvite(outsider, { inviteId: revoked.id }), /ikke lenger gyldig/);
    const notes = await db.select().from(schema.notification).where(eq(schema.notification.userId, outsider));
    assert.ok(!notes.some((n) => n.type === "company_invite" && n.data?.inviteId === revoked.id), "varselet om en trukket invitasjon fjernes");

    const expired = await inviteToCompany(owner, companyId, { target: username(outsider), kind: "employee" });
    await db.update(schema.companyInvite).set({ expiresAt: sql`now() - interval '1 minute'` }).where(eq(schema.companyInvite.id, expired.id));
    await assert.rejects(acceptInvite(outsider, { inviteId: expired.id }), /ikke lenger gyldig/);
    assert.ok((await expireInvites()) >= 1);
    assert.equal((await inviteRow(expired.id)).status, "expired");
    assert.equal(await getMembership(outsider, companyId), null);
    assert.equal(await isEmployee(outsider, companyId), false);

    // Med lenken kan man avslå uten å logge inn.
    const stranger = `ukjent-${randomUUID()}@test.no`;
    const viaMail = await inviteToCompany(owner, companyId, { target: stranger, kind: "member", role: "member" });
    await declineInvite(null, { token: await tokenFor(stranger) });
    assert.equal((await inviteRow(viaMail.id)).status, "declined");

    // Besvarte invitasjoner eldre enn 90 dager slettes.
    await db.update(schema.companyInvite).set({ respondedAt: sql`now() - interval '100 days'` }).where(eq(schema.companyInvite.id, declined.id));
    await expireInvites();
    assert.equal(await inviteRow(declined.id), undefined);
  });

  test("send på nytt gir en ny lenke, og den gamle slutter å virke", async () => {
    const { getInviteByToken, inviteToCompany, resendInvite } = await import("@/lib/company-invites");
    const to = `ny-${randomUUID()}@test.no`;
    const { id } = await inviteToCompany(owner, companyId, { target: to, kind: "member", role: "member" });
    const first = await tokenFor(to);
    const before = (await inviteRow(id)).tokenHash;
    mails.length = 0;
    await resendInvite(owner, id);
    const second = await tokenFor(to);
    assert.notEqual(second, first);
    assert.notEqual((await inviteRow(id)).tokenHash, before, "hashen er byttet");
    assert.equal((await inviteRow(id)).tokenHash, sha256(second));
    assert.equal(await getInviteByToken(first), null, "den gamle lenken virker ikke");
    assert.equal((await getInviteByToken(second))?.status, "pending");
    await assert.rejects(resendInvite(owner, id), /sendt på nytt nylig/);
    await assert.rejects(resendInvite(recruiter, id), /Rollen din gir ikke tilgang/);
  });

  test("ventende invitasjoner teller med i plassene, og plassene sjekkes igjen når man godtar", async () => {
    const { db, schema } = await import("@/db");
    const { MAX_MEMBERS } = await import("@/lib/companies");
    const { acceptInvite, countSeats, inviteToCompany } = await import("@/lib/company-invites");
    const co = randomUUID();
    companies.push(co);
    await db.insert(schema.company).values({ id: co, slug: `plasser-${co.slice(0, 8)}`, name: "Plassfirma", createdById: owner, termsAcceptedAt: new Date() });
    await db.insert(schema.companyMember).values({ companyId: co, userId: owner, role: "owner" });
    const expiresAt = new Date(Date.now() + 86_400_000);
    await db.insert(schema.companyInvite).values(
      Array.from({ length: MAX_MEMBERS - 2 }, (_, i) => ({ companyId: co, kind: "member" as const, role: "member" as const, email: `plass-${i}-${co}@test.no`, expiresAt })),
    );
    const { id } = await inviteToCompany(owner, co, { target: username(outsider), kind: "member", role: "member" });
    assert.deepEqual(await countSeats(co), { used: 1, pending: MAX_MEMBERS - 1, max: MAX_MEMBERS });
    await assert.rejects(inviteToCompany(owner, co, { target: username(wrongUser), kind: "member", role: "member" }), /Ventende invitasjoner teller med/);

    // Fylles plassene før personen svarer, stopper godkjenningen.
    await db.insert(schema.companyMember).values(fillers.map((userId) => ({ companyId: co, userId, role: "reviewer" as const })));
    await assert.rejects(acceptInvite(outsider, { inviteId: id }), /ikke flere ledige plasser/);
    assert.equal((await inviteRow(id)).status, "pending", "invitasjonen står fortsatt");
  });

  test("teamet på bedriftssiden viser bare de som har sagt ja til å vises", async () => {
    const { listTeam, setShowOnPage } = await import("@/lib/companies");
    const { acceptInvite, inviteToCompany } = await import("@/lib/company-invites");
    const ids = async () => (await listTeam(companyId)).map((m) => m.userId);
    assert.ok(!(await ids()).includes(adminUser), "medlemmer vises ikke uten å ha valgt det");
    await setShowOnPage(adminUser, companyId, true);
    assert.ok((await ids()).includes(adminUser));
    await assert.rejects(setShowOnPage(outsider, companyId, true), /ikke med i bedriften/);

    const { id } = await inviteToCompany(owner, companyId, { target: username(wrongUser), kind: "employee", title: "Frontend" });
    assert.ok(!(await ids()).includes(wrongUser), "ingen vises før de har godtatt");
    await acceptInvite(wrongUser, { inviteId: id });
    const team = await listTeam(companyId);
    assert.deepEqual(
      team.filter((m) => m.userId === wrongUser).map((m) => [m.title, m.admin]),
      [["Frontend", false]],
    );
  });

  test("eieren kan ikke forlate bedriften; andre kan, og eieren får beskjed", async () => {
    const { getMembership, leaveCompany } = await import("@/lib/companies");
    const { listNotifications } = await import("@/lib/notifications");
    await assert.rejects(leaveCompany(owner, companyId), /Overfør eierskapet/);
    await leaveCompany(recruiter, companyId);
    assert.equal(await getMembership(recruiter, companyId), null);
    assert.ok((await listNotifications(owner)).some((n) => n.type === "company_access" && n.data.event === "left"));
  });

  test("nytt navn fjerner bekreftelsen, og det logges", async () => {
    const { db, schema } = await import("@/db");
    const { and, eq } = await import("drizzle-orm");
    const { getCompanyById, updateCompany } = await import("@/lib/companies");
    await db.update(schema.company).set({ verifiedAt: new Date(), verifiedDomain: "test.no" }).where(eq(schema.company.id, companyId));
    const current = await getCompanyById(companyId);
    assert.deepEqual(await updateCompany(adminUser, companyId, { name: current!.name, about: "Samme navn" }), { verificationReset: false });
    assert.ok((await getCompanyById(companyId))?.verifiedAt, "andre endringer beholder bekreftelsen");
    assert.deepEqual(await updateCompany(owner, companyId, { name: `Nytt navn ${owner.slice(-6)}` }), { verificationReset: true });
    const after = await getCompanyById(companyId);
    assert.equal(after?.verifiedAt, null);
    assert.equal(after?.verifiedDomain, null);
    const rows = await db
      .select()
      .from(schema.companyAudit)
      .where(and(eq(schema.companyAudit.companyId, companyId), eq(schema.companyAudit.action, "company.verification_reset")));
    assert.equal(rows.length, 1);
    await assert.rejects(updateCompany(mailUser, companyId, { name: "Vurderer" }), /Rollen din gir ikke tilgang/);
  });

  test("«Krev tofaktor» er for eieren, krever Bedrift og at eieren selv har tofaktor", async () => {
    const { db, schema } = await import("@/db");
    const { eq } = await import("drizzle-orm");
    const { setCompanySecurity } = await import("@/lib/companies");
    await assert.rejects(setCompanySecurity(adminUser, companyId, { require2fa: true }), /Rollen din gir ikke tilgang/);
    await assert.rejects(setCompanySecurity(owner, companyId, { require2fa: true }), /Bedrift/);
    const { grantPlan } = await import("@/lib/billing");
    await grantPlan(owner, "company", companyId, 30, "test");
    await assert.rejects(setCompanySecurity(owner, companyId, { require2fa: true }), /tofaktor for din egen konto/);
    await db.update(schema.user).set({ twoFactorEnabled: true }).where(eq(schema.user.id, owner));
    await setCompanySecurity(owner, companyId, { require2fa: true });
    assert.equal((await db.select({ on: schema.company.require2fa }).from(schema.company).where(eq(schema.company.id, companyId)))[0].on, true);
    await setCompanySecurity(owner, companyId, { require2fa: false });
  });

  test("eierskapet overføres først når mottakeren godtar", async () => {
    const { getMembership } = await import("@/lib/companies");
    const { acceptInvite, createOwnerTransfer } = await import("@/lib/company-invites");
    await assert.rejects(createOwnerTransfer(adminUser, companyId, mailUser), /Rollen din gir ikke tilgang/);
    await assert.rejects(createOwnerTransfer(owner, companyId, outsider), /ikke med i bedriften/);
    const { id } = await createOwnerTransfer(owner, companyId, adminUser);
    assert.equal(await getMembership(owner, companyId), "owner", "ingenting skjer før det er godtatt");
    assert.equal(await getMembership(adminUser, companyId), "admin");
    await assert.rejects(acceptInvite(mailUser, { inviteId: id }), /Fant ikke invitasjonen/);
    await acceptInvite(adminUser, { inviteId: id });
    assert.equal(await getMembership(adminUser, companyId), "owner");
    assert.equal(await getMembership(owner, companyId), "admin", "den gamle eieren blir administrator");
  });
});
