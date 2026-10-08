import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";

try {
  process.loadEnvFile(".env.local");
} catch {}
const skip = !process.env.DATABASE_URL && "DATABASE_URL er ikke satt";

describe("bedrift: søknader, lagrede søk, team og utfordringer", { skip }, () => {
  const owner = `test-${randomUUID()}`;
  const candidate = `test-${randomUUID()}`;
  const outsider = `test-${randomUUID()}`;
  let companyId = "";
  let jobId = "";
  let projectId = "";

  before(async () => {
    const { db, schema } = await import("@/db");
    for (const id of [owner, candidate, outsider]) {
      await db.insert(schema.user).values({ id, name: `Test ${id.slice(-4)}`, email: `${id}@test.no`, emailVerified: true, username: id.slice(0, 30) });
    }
    const { createCompany } = await import("@/lib/companies");
    companyId = (await createCompany(owner, { name: `Testfirma ${owner.slice(-6)}`, acceptTerms: true })).id;
    const { createJob } = await import("@/lib/jobs");
    jobId = await createJob(owner, companyId, { title: "Frontend-utvikler", applyMode: "vis" }, true);
    const [p] = await db
      .insert(schema.project)
      .values({ ownerId: candidate, title: "Sykkelkart", status: "published", publishedAt: new Date(), role: "Frontend" })
      .returning({ id: schema.project.id });
    projectId = p.id;
  });

  after(async () => {
    const { db } = await import("@/db");
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`delete from company where id = ${companyId}`);
    await db.execute(sql`delete from plan_grant where owner_id = ${companyId}`);
    for (const id of [owner, candidate, outsider]) await db.execute(sql`delete from "user" where id = ${id}`);
    await db.$client.end();
  });

  const applicant = () => ({ id: candidate, name: "Kari Kandidat", username: candidate.slice(0, 30), email: `${candidate}@test.no`, emailVerified: true });

  test("stillinger med «Søk med Vis-profilen» trenger ingen lenke, andre gjør det", async () => {
    const { createJob } = await import("@/lib/jobs");
    await assert.rejects(createJob(owner, companyId, { title: "Designer", applyMode: "ekstern" }, false), /søknadslenke/);
  });

  test("kandidaten søker med profilen og ett prosjekt, og kan ikke søke to ganger", async () => {
    const { applyToJob, getMyApplication, listApplications } = await import("@/lib/applications");
    const { id } = await applyToJob(applicant(), jobId, { message: "Hei!", projectIds: [projectId, randomUUID()] });
    await assert.rejects(applyToJob(applicant(), jobId, {}), /allerede søkt/);
    assert.equal((await getMyApplication(candidate, jobId))?.status, "ny");

    const [row] = await listApplications(owner, companyId);
    assert.equal(row.id, id);
    assert.equal(row.candidate.email, `${candidate}@test.no`, "e-posten deles når man søker");
    assert.deepEqual(row.highlights.map((h) => h.id), [projectId], "bare egne, publiserte prosjekter tas med");
    await assert.rejects(listApplications(outsider, companyId), /tilgang/);
  });

  test("eieren av bedriften kan ikke søke hos seg selv", async () => {
    const { applyToJob } = await import("@/lib/applications");
    await assert.rejects(applyToJob({ id: owner, name: "Eier", username: owner.slice(0, 30), email: "x@test.no" }, jobId, {}), /egen bedrift/);
  });

  test("å flytte søkere krever Bedrift, og kandidaten får varsel", async () => {
    const { listApplications, setApplicationStatus } = await import("@/lib/applications");
    const [row] = await listApplications(owner, companyId);
    await assert.rejects(setApplicationStatus(owner, row.id, "intervju"), /Bedrift/);

    const { grantPlan } = await import("@/lib/billing");
    await grantPlan(owner, "company", companyId, 30, "test");
    await setApplicationStatus(owner, row.id, "intervju");

    const { listNotifications } = await import("@/lib/notifications");
    const notes = await listNotifications(candidate);
    const update = notes.find((n) => n.type === "application" && n.data.event === "status");
    assert.equal(update?.data.status, "intervju");
    assert.ok(update?.data.companyName?.startsWith("Testfirma"));
    const ownerNotes = await listNotifications(owner);
    assert.ok(ownerNotes.some((n) => n.type === "application" && n.data.event === "new"), "bedriften fikk varsel om søknaden");
  });

  test("kandidaten kan trekke søknaden og søke på nytt", async () => {
    const { applyToJob, getMyApplication, withdrawApplication } = await import("@/lib/applications");
    const mine = await getMyApplication(candidate, jobId);
    await assert.rejects(withdrawApplication(outsider, mine!.id), /Fant ikke/);
    await withdrawApplication(candidate, mine!.id);
    assert.equal((await getMyApplication(candidate, jobId))?.status, "trukket");
    await applyToJob(applicant(), jobId, {});
    assert.equal((await getMyApplication(candidate, jobId))?.status, "ny");
  });

  test("lagrede søk finner kandidater som blir synlige etterpå", async () => {
    const { createSavedSearch, listSavedSearches } = await import("@/lib/saved-searches");
    await assert.rejects(createSavedSearch(owner, companyId, "Alle", {}), /minst ett filter/);
    const search = await createSavedSearch(owner, companyId, "Sykkelfolk", { q: "Kandidat" });
    assert.equal((await listSavedSearches(owner, companyId)).find((s) => s.id === search)?.fresh, 0);

    const { db, schema } = await import("@/db");
    const { eq } = await import("drizzle-orm");
    await db.update(schema.user).set({ name: "Kari Kandidat" }).where(eq(schema.user.id, candidate));
    const { setProfileFlags } = await import("@/lib/pro");
    await setProfileFlags(candidate, { visibleToCompanies: true });
    assert.equal((await listSavedSearches(owner, companyId)).find((s) => s.id === search)?.fresh, 1);

    const { searchCandidates } = await import("@/lib/talent");
    const [found] = await searchCandidates(owner, companyId, { q: "Kandidat" });
    assert.equal(found.id, candidate);
    assert.equal(found.showcase[0]?.id, projectId, "prosjektene vises i kandidatsøket");
  });

  test("teamet vises på bedriftssiden etter en godtatt invitasjon, og man kan fjerne seg selv", async () => {
    const { isEmployee, listTeam, removeEmployee } = await import("@/lib/companies");
    const { acceptInvite, inviteToCompany } = await import("@/lib/company-invites");
    await assert.rejects(inviteToCompany(outsider, companyId, { target: candidate.slice(0, 30), kind: "employee" }), /tilgang/);
    const { id } = await inviteToCompany(owner, companyId, { target: candidate.slice(0, 30), kind: "employee", title: "Frontend" });
    assert.equal(await isEmployee(candidate, companyId), false, "ingen vises før de har sagt ja");
    await acceptInvite(candidate, { inviteId: id });
    const team = await listTeam(companyId);
    assert.deepEqual(team.map((m) => [m.userId, m.admin]).sort(), [[candidate, false], [owner, true]].sort());
    await removeEmployee(candidate, companyId, candidate);
    assert.equal(await isEmployee(candidate, companyId), false);
  });

  test("utfordringer besvares med et eget, publisert prosjekt", async () => {
    const { createChallenge, listEntries, setEntryHighlighted, submitEntry } = await import("@/lib/challenges");
    const challengeId = await createChallenge(owner, companyId, { title: "Lag et sykkelkart" }, true);
    await assert.rejects(submitEntry(outsider, challengeId, projectId), /publiserte prosjekter/);
    const entry = await submitEntry(candidate, challengeId, projectId, "Brukte Leaflet");
    assert.equal(entry.updated, false);
    assert.equal((await submitEntry(candidate, challengeId, projectId)).updated, true, "et nytt svar bytter det gamle");

    await setEntryHighlighted(owner, entry.id, true);
    const [first] = await listEntries(challengeId);
    assert.equal(first.highlighted, true);
    assert.equal(first.project.id, projectId);
  });
});
