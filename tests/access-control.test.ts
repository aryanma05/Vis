import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";

// Tilgangskontroll mellom brukere: bruker B (og en som ikke er logget inn) prøver å lese,
// endre og slette det bruker A eier. Alt går mot lib-funksjonene som Server Actions og
// ruter bruker, med ekte database.
//
// Denne filen leser IKKE .env.local, fordi den databasen kan være produksjon. Den kjører
// bare når DATABASE_URL er satt i miljøet og peker til en lokal database (som i CI), eller
// når TEST_DATABASE_OK=1 er satt for en egen testdatabase.
function testDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) return "DATABASE_URL er ikke satt";
  if (process.env.TEST_DATABASE_OK === "1") return false;
  try {
    const host = new URL(url).hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") return false;
  } catch {}
  return "DATABASE_URL er ikke en lokal testdatabase (sett TEST_DATABASE_OK=1 for en egen testdatabase)";
}
const skip = testDatabase();

const PDF = new TextEncoder().encode("%PDF-1.4\n1 0 obj <<>> endobj\ntrailer <<>>\n%%EOF\n");

describe("tilgangskontroll mellom brukere", { skip }, () => {
  const a = `test-${randomUUID()}`;
  const b = `test-${randomUUID()}`;
  const users = [a, b];
  const ghostEmail = `test-${randomUUID()}@test.no`;
  let draftId = "";
  let publishedId = "";
  let imageId = "";
  let commentId = "";

  before(async () => {
    const { db, schema } = await import("@/db");
    for (const id of users) {
      await db.insert(schema.user).values({ id, name: `Test ${id.slice(-4)}`, email: `${id}@test.no`, emailVerified: true, username: id.slice(0, 30) });
    }
    const { createProject } = await import("@/lib/projects");
    const { projectInput } = await import("@/lib/validation");
    draftId = await createProject(a, projectInput.parse({ title: "Hemmelig utkast", status: "draft" }));
    publishedId = await createProject(a, projectInput.parse({ title: "Publisert", status: "published" }));
    const [image] = await db.insert(schema.projectImage).values({ projectId: publishedId, url: "https://example.com/bilde.png", position: 0 }).returning({ id: schema.projectImage.id });
    imageId = image.id;
  });

  after(async () => {
    const { db } = await import("@/db");
    const { sql } = await import("drizzle-orm");
    const { identifierKey } = await import("@/lib/auth-rules");
    for (const id of users) {
      await db.execute(sql`delete from rate_bucket where key like ${`%${id}%`}`);
      await db.execute(sql`delete from "user" where id = ${id}`);
    }
    await db.execute(sql`delete from rate_bucket where key = ${`loginAccount:${identifierKey(ghostEmail)}`}`);
    await db.execute(sql`delete from "user" where email = ${ghostEmail}`);
    await db.$client.end();
  });

  test("et utkast kan ikke leses av andre eller uten innlogging", async () => {
    const { getProjectById, getProjectsByOwner } = await import("@/lib/projects");
    assert.equal(await getProjectById(draftId, b), null);
    assert.equal(await getProjectById(draftId, null), null);
    assert.ok(await getProjectById(draftId, a), "eieren ser utkastet");
    const visible = await getProjectsByOwner(a, b);
    assert.ok(!visible.some((p) => p.id === draftId), "utkastet vises ikke på profilen for andre");
  });

  test("B kan ikke endre, publisere, feste eller slette A sitt prosjekt", async () => {
    const projects = await import("@/lib/projects");
    const { projectInput } = await import("@/lib/validation");
    const input = projectInput.parse({ title: "Overtatt", status: "published" });
    await assert.rejects(projects.updateProject(b, draftId, input), /Fant ikke prosjektet/);
    await assert.rejects(projects.setProjectStatus(b, draftId, "published"), /Fant ikke prosjektet/);
    await assert.rejects(projects.setProjectPinned(b, publishedId, true), /Fant ikke prosjektet/);
    await assert.rejects(projects.deleteProject(b, publishedId), /Fant ikke prosjektet/);
    await assert.rejects(projects.replaceProjectDescription(b, publishedId, "<script>"), /Fant ikke prosjektet/);
    const still = await projects.getProjectById(draftId, a);
    assert.equal(still?.title, "Hemmelig utkast");
    assert.equal(still?.status, "draft");
  });

  test("B kan ikke slette, sortere eller endre bildene til A", async () => {
    const projects = await import("@/lib/projects");
    await assert.rejects(projects.deleteProjectImage(b, imageId), /Fant ikke bildet/);
    await assert.rejects(projects.updateImageAlt(b, imageId, "endret"), /Fant ikke bildet/);
    await assert.rejects(projects.reorderProjectImages(b, publishedId, [imageId]), /Fant ikke prosjektet/);
    await assert.rejects(projects.addProjectImages(b, publishedId, []), /Fant ikke prosjektet/);
    const project = await projects.getProjectById(publishedId, null);
    assert.equal(project?.images.length, 1);
  });

  test("oppdateringer: B kan ikke legge til eller slette på A sitt prosjekt", async () => {
    const { addProjectUpdate, deleteProjectUpdate, listProjectUpdates } = await import("@/lib/project-updates");
    await assert.rejects(addProjectUpdate(b, publishedId, "Falsk nyhet"), /Fant ikke/);
    await addProjectUpdate(a, publishedId, "Versjon 2 er ute");
    const [update] = await listProjectUpdates(publishedId);
    await assert.rejects(deleteProjectUpdate(b, update.id), /Fant ikke oppdateringen/);
    assert.equal((await listProjectUpdates(publishedId)).length, 1);
  });

  test("kommentarer: ingen på utkast, og B kan ikke endre eller slette A sine", async () => {
    const comments = await import("@/lib/comments");
    await assert.rejects(comments.addComment(b, draftId, "Hei"), /Fant ikke prosjektet/);
    commentId = await comments.addComment(a, publishedId, "Min egen kommentar");
    await assert.rejects(comments.editComment(b, commentId, "Endret av B"), /Fant ikke kommentaren/);
    await assert.rejects(comments.deleteComment(b, commentId), /Fant ikke kommentaren/);
    const list = await comments.listComments(publishedId, b);
    assert.ok(JSON.stringify(list).includes("Min egen kommentar"));
  });

  test("private samlinger er private, og B kan ikke endre eller slette dem", async () => {
    const collections = await import("@/lib/collections");
    const id = await collections.createCollection(a, { title: "Privat", isPublic: false });
    assert.equal(await collections.getCollection(id, b), null);
    assert.equal(await collections.getCollection(id, null), null);
    assert.ok(await collections.getCollection(id, a));
    await assert.rejects(collections.updateCollection(b, id, { title: "Offentlig nå", isPublic: true }), /Fant ikke samlingen/);
    await assert.rejects(collections.setCollectionItem(b, id, publishedId, true));
    await collections.deleteCollection(b, id);
    assert.equal((await collections.getCollection(id, a))?.isPublic, false, "samlingen finnes fortsatt og er privat");
  });

  test("samarbeid: B kan ikke endre, lukke eller slette A sin utlysning", async () => {
    const posts = await import("@/lib/partner-posts");
    const { partnerPostInput } = await import("@/lib/validation");
    const input = partnerPostInput.parse({ title: "Trenger hjelp", description: "Et prosjekt som trenger en designer til forsiden.", needs: "Design", commitments: ["del"] });
    const id = await posts.createPartnerPost(a, input);
    await assert.rejects(posts.updatePartnerPost(b, id, { ...input, title: "Kapret" }), /Fant ikke prosjektet/);
    await assert.rejects(posts.setPartnerPostClosed(b, id, true), /Fant ikke prosjektet/);
    await assert.rejects(posts.deletePartnerPost(b, id), /Fant ikke prosjektet/);
    const post = await posts.getPartnerPost(id, b);
    assert.equal(post?.title, "Trenger hjelp");
    assert.deepEqual(post?.requests, [], "B ser ikke forespørslene");
    assert.equal(post?.ownerEmail, null, "B ser ikke e-posten til A");
  });

  test("varsler: B kan ikke markere A sine varsler som lest", async () => {
    const { db, schema } = await import("@/db");
    const { markRead } = await import("@/lib/notifications");
    const [row] = await db.insert(schema.notification).values({ userId: a, actorId: b, type: "follow" }).returning({ id: schema.notification.id });
    await markRead(b, row.id);
    const { eq } = await import("drizzle-orm");
    const [after] = await db.select({ readAt: schema.notification.readAt }).from(schema.notification).where(eq(schema.notification.id, row.id));
    assert.equal(after.readAt, null);
  });

  test("en ny CV er privat, og filen kan ikke åpnes uten innlogging før eieren gjør den synlig", async () => {
    const cv = await import("@/lib/cv-document");
    const { GET } = await import("@/app/filer/[...key]/route");
    const result = await cv.uploadCvDocument(a, new File([PDF], "cv.pdf", { type: "application/pdf" }));
    assert.equal(result.isPublic, false);

    assert.equal(await cv.getCvDocument(a, b), null, "B ser ikke CV-en");
    assert.equal(await cv.getCvDocument(a, null), null, "ikke uten innlogging heller");
    assert.ok(await cv.getCvDocument(a, a), "eieren ser den");

    assert.ok(result.url.startsWith("/filer/"), "CV-er lagres alltid der tilgangen kan styres");
    const fetchFile = () => GET(new Request(`http://localhost:3000${result.url}`), { params: Promise.resolve({ key: result.url.slice("/filer/".length).split("/") }) });
    assert.equal((await fetchFile()).status, 404, "direkte lenke til en privat CV virker ikke");

    await cv.setCvDocumentVisibility(a, true);
    const open = await fetchFile();
    assert.equal(open.status, 200);
    assert.equal(open.headers.get("x-content-type-options"), "nosniff");

    await cv.setCvDocumentVisibility(a, false);
    const hidden = await fetchFile();
    assert.equal(hidden.status, 404, "en gammel lenke slutter å virke når CV-en skjules");

    // B sine kall påvirker bare B sin egen CV.
    await cv.deleteCvDocument(b);
    await cv.setCvDocumentVisibility(b, true);
    assert.ok(await cv.getCvDocument(a, a));
    assert.equal((await cv.getCvDocument(a, a))?.isPublic, false);
  });

  test("dataeksporten krever innlogging", async () => {
    const { GET } = await import("@/app/api/mine-data/route");
    const res = await GET(new Request("http://localhost:3000/api/mine-data"));
    assert.equal(res.status, 401);
  });

  test("Better Auth sine admin-endepunkter svarer 404, også over HTTP", async () => {
    const { GET, POST } = await import("@/app/api/auth/[...all]/route");
    const list = await GET(new Request("http://localhost:3000/api/auth/admin/list-users"));
    assert.equal(list.status, 404);
    const impersonate = await POST(
      new Request("http://localhost:3000/api/auth/admin/impersonate-user", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ userId: a }),
      }),
    );
    assert.equal(impersonate.status, 404);
  });

  test("registrering med ekstra felt (bilde, rolle) avvises", async () => {
    const { auth } = await import("@/lib/auth");
    await assert.rejects(
      auth.api.signUpEmail({ body: { name: "Ny", email: ghostEmail, password: "passord-123", image: "https://sporing.example/p.gif" } }),
      (error: { body?: { code?: string } }) => error.body?.code === "INVALID_REQUEST",
    );
    const { db, schema } = await import("@/db");
    const { eq } = await import("drizzle-orm");
    assert.equal((await db.select().from(schema.user).where(eq(schema.user.email, ghostEmail))).length, 0);
  });

  test("innlogging stoppes per konto etter ti forsøk, uansett IP", async () => {
    const { auth } = await import("@/lib/auth");
    const attempt = () => auth.api.signInEmail({ body: { email: ghostEmail, password: "feil-passord" } });
    for (let i = 0; i < 10; i++) {
      await assert.rejects(attempt(), (error: { body?: { code?: string } }) => error.body?.code !== "ACCOUNT_THROTTLED");
    }
    await assert.rejects(attempt(), (error: { body?: { code?: string } }) => error.body?.code === "ACCOUNT_THROTTLED");
  });
});
