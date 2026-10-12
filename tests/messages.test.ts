import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, describe, test } from "node:test";

try {
  process.loadEnvFile(".env.local");
} catch {}
const skip = !process.env.DATABASE_URL && "DATABASE_URL er ikke satt";

describe("meldinger mellom venner", { skip }, () => {
  const [a, b, c] = [0, 1, 2].map(() => `test-${randomUUID()}`);

  after(async () => {
    const { db } = await import("@/db");
    const { sql } = await import("drizzle-orm");
    for (const id of [a, b, c]) await db.execute(sql`delete from "user" where id = ${id}`);
    await db.$client.end();
  });

  test("bare de som følger hverandre kan sende, og uleste telles til de er lest", async () => {
    const { db, schema } = await import("@/db");
    for (const id of [a, b, c]) {
      await db.insert(schema.user).values({ id, name: "Test", email: `${id}@test.no`, emailVerified: true, username: id.slice(0, 30) });
    }
    const { getMessages, listConversations, markMessagesRead, sendMessage } = await import("@/lib/messages");
    const { getUnreadCount } = await import("@/lib/notifications");

    await db.insert(schema.follow).values({ followerId: a, followingId: b });
    await assert.rejects(sendMessage(a, b, "hei"), /følge hverandre/);

    await db.insert(schema.follow).values([
      { followerId: b, followingId: a },
      { followerId: a, followingId: c },
      { followerId: c, followingId: a },
    ]);
    await assert.rejects(sendMessage(a, b, "   "), /Skriv en melding/);
    await sendMessage(a, b, "hei");
    await sendMessage(b, a, "hallo tilbake");
    await sendMessage(b, a, "er du der?");

    assert.equal(await getUnreadCount(a), 1, "ett varsel per avsender, ikke ett per melding");
    const inbox = await listConversations(a);
    assert.deepEqual(inbox.map((f) => f.id), [b, c], "samtalen med meldinger først");
    assert.equal(inbox[0].lastBody, "er du der?");
    assert.equal(inbox[0].lastMine, false);
    assert.equal(inbox[0].unread, 2);
    assert.equal(inbox[1].lastBody, null);

    await markMessagesRead(a, b);
    assert.equal(await getUnreadCount(a), 0, "varselet er lest når samtalen er åpnet");
    assert.equal((await listConversations(a))[0].unread, 0);
    assert.deepEqual(
      (await getMessages(a, b)).map((m) => [m.body, m.mine]),
      [
        ["hei", true],
        ["hallo tilbake", false],
        ["er du der?", false],
      ],
    );
  });
});
