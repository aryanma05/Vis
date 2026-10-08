import "server-only";

import { and, asc, desc, eq, ilike, inArray, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, schema } from "@/db";
import { type Commitment, COMMITMENT_LABELS, COMMITMENTS, FIELDS, type FieldKey, MAX_OPEN_PARTNER_POSTS, type PartnerStage } from "@/lib/constants";
import { log } from "@/lib/log";
import { canSendEmail, partnerAcceptedEmail, partnerRequestEmail, sendEmailInBackground } from "@/lib/mailer";
import { notify, resolvePrefs } from "@/lib/notifications";
import { isUuid } from "@/lib/projects";
import { enforce } from "@/lib/rate-limit";
import { UserFacingError } from "@/lib/result";
import { outer } from "@/lib/sql";
import type { PartnerPostInput } from "@/lib/validation";

const { partnerPost, partnerRequest, profile, project, projectImage, user } = schema;

// Samarbeid (/partnere): ideer og påbegynte prosjekter som trenger folk, og forespørslene
// fra dem som vil hjelpe. Eieren sier ja eller nei; ved ja får begge hverandres e-post.

export const REQUEST_MIN = 20;
export const REQUEST_MAX = 1500;

export type RequestStatus = (typeof schema.partnerRequestStatus.enumValues)[number];

export type PartnerPostCard = {
  id: string;
  title: string;
  description: string;
  stage: PartnerStage;
  needs: string[];
  commitments: Commitment[];
  closed: boolean;
  createdAt: Date;
  owner: { id: string; username: string; name: string; image: string | null; headline: string | null; location: string | null };
  // Prosjektet på Vis det gjelder, om det er publisert.
  project: { id: string; title: string; cover: string | null } | null;
  // Forespørsler som ikke er avslått («3 vil hjelpe»).
  interest: number;
  // Innlogget brukers egen forespørsel, om noen.
  myRequest: RequestStatus | null;
};

const notBanned = sql`coalesce(${user.banned}, false) = false`;
const isOpen = isNull(partnerPost.closedAt);

// Prosjektet vises bare når det er publisert og ikke fjernet av en moderator.
const visibleProject = and(eq(project.id, partnerPost.projectId), eq(project.status, "published"), isNull(project.removedAt));

const cardColumns = {
  id: partnerPost.id,
  title: partnerPost.title,
  description: partnerPost.description,
  stage: partnerPost.stage,
  needs: partnerPost.needs,
  commitments: partnerPost.commitments,
  closedAt: partnerPost.closedAt,
  createdAt: partnerPost.createdAt,
  ownerId: user.id,
  ownerUsername: user.username,
  ownerName: user.name,
  ownerImage: user.image,
  ownerHeadline: profile.headline,
  ownerLocation: profile.location,
  projectId: project.id,
  projectTitle: project.title,
  projectCover: sql<string | null>`(select ${projectImage.url} from ${projectImage} where ${projectImage.projectId} = ${outer(project.id)} order by ${projectImage.position} limit 1)`,
  interest: sql<number>`(select count(*)::int from ${partnerRequest} where ${partnerRequest.postId} = ${outer(partnerPost.id)} and ${partnerRequest.status} <> 'declined')`,
};

type CardRow = {
  id: string;
  title: string;
  description: string;
  stage: PartnerStage;
  needs: string[];
  commitments: Commitment[];
  closedAt: Date | null;
  createdAt: Date;
  ownerId: string;
  ownerUsername: string;
  ownerName: string;
  ownerImage: string | null;
  ownerHeadline: string | null;
  ownerLocation: string | null;
  projectId: string | null;
  projectTitle: string | null;
  projectCover: string | null;
  interest: number;
};

function toCard(r: CardRow, myRequest: RequestStatus | null = null): PartnerPostCard {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    stage: r.stage,
    needs: r.needs ?? [],
    commitments: r.commitments?.length ? r.commitments : [...COMMITMENTS],
    closed: r.closedAt !== null,
    createdAt: r.createdAt,
    owner: { id: r.ownerId, username: r.ownerUsername, name: r.ownerName, image: r.ownerImage, headline: r.ownerHeadline, location: r.ownerLocation },
    project: r.projectId ? { id: r.projectId, title: r.projectTitle!, cover: r.projectCover } : null,
    interest: r.interest,
    myRequest,
  };
}

function cardQuery() {
  return db
    .select(cardColumns)
    .from(partnerPost)
    .innerJoin(user, eq(user.id, partnerPost.ownerId))
    .leftJoin(profile, eq(profile.userId, user.id))
    .leftJoin(project, visibleProject);
}

// Innlogget brukers forespørsler til en liste utlysninger.
async function myRequests(viewerId: string | null | undefined, postIds: string[]) {
  if (!viewerId || postIds.length === 0) return new Map<string, RequestStatus>();
  const rows = await db
    .select({ postId: partnerRequest.postId, status: partnerRequest.status })
    .from(partnerRequest)
    .where(and(eq(partnerRequest.senderId, viewerId), inArray(partnerRequest.postId, postIds)));
  return new Map(rows.map((r) => [r.postId, r.status]));
}

/* -------------------------------------------------------------------------- */
/*  Lese                                                                      */
/* -------------------------------------------------------------------------- */

// Åpne utlysninger på /partnere, nyeste først. Søket treffer tittel, beskrivelse, hva de
// trenger hjelp med, prosjektet og hvem som har lagt det ut.
export async function listPartnerPosts({
  query = "",
  location,
  field,
  viewerId,
  limit = 48,
}: {
  query?: string;
  location?: string | null;
  field?: FieldKey | null;
  viewerId?: string | null;
  limit?: number;
} = {}): Promise<PartnerPostCard[]> {
  const conditions: SQL[] = [isOpen, notBanned];

  const q = query.trim().replace(/[%_]/g, "");
  if (q) {
    const like = `%${q}%`;
    conditions.push(
      or(
        ilike(partnerPost.title, like),
        ilike(partnerPost.description, like),
        sql`${partnerPost.needs}::text ilike ${like}`,
        ilike(user.name, like),
        ilike(user.username, like),
        ilike(project.title, like),
      )!,
    );
  }
  if (location?.trim()) conditions.push(ilike(profile.location, `%${location.trim().replace(/[%_]/g, "")}%`));
  if (field && FIELDS[field]) {
    const words = FIELDS[field].words;
    conditions.push(
      or(
        ...words.map((w) => ilike(partnerPost.title, `%${w}%`)),
        ...words.map((w) => ilike(partnerPost.description, `%${w}%`)),
        ...words.map((w) => sql`${partnerPost.needs}::text ilike ${`%${w}%`}`),
      )!,
    );
  }

  const rows = await cardQuery()
    .where(and(...conditions))
    .orderBy(desc(partnerPost.createdAt))
    .limit(limit);
  const mine = await myRequests(viewerId, rows.map((r) => r.id));
  return rows.map((r) => toCard(r, mine.get(r.id) ?? null));
}

// Åpne utlysninger fra én person, til «Trenger hjelp med» på profilen.
export async function listOpenPostsByOwner(ownerId: string, viewerId?: string | null, limit = 3) {
  const rows = await cardQuery()
    .where(and(eq(partnerPost.ownerId, ownerId), isOpen, notBanned))
    .orderBy(desc(partnerPost.createdAt))
    .limit(limit);
  const mine = await myRequests(viewerId, rows.map((r) => r.id));
  return rows.map((r) => toCard(r, mine.get(r.id) ?? null));
}

// Den åpne utlysningen for et prosjekt, så prosjektsiden kan vise at det trengs folk.
export async function getOpenPostForProject(projectId: string) {
  const [row] = await db
    .select({ id: partnerPost.id, needs: partnerPost.needs })
    .from(partnerPost)
    .innerJoin(user, eq(user.id, partnerPost.ownerId))
    .where(and(eq(partnerPost.projectId, projectId), isOpen, notBanned))
    .orderBy(desc(partnerPost.createdAt))
    .limit(1);
  return row ?? null;
}

export type PartnerRequestItem = {
  id: string;
  commitment: Commitment;
  message: string;
  status: RequestStatus;
  createdAt: Date;
  sender: { id: string; username: string; name: string; image: string | null; headline: string | null; email: string };
};

// Én utlysning. Eieren får forespørslene (med avsenderens e-post, som i «Kontakt meg»),
// den som har sendt en får sin egen, og e-posten til eieren når de har fått ja.
export async function getPartnerPost(id: string, viewerId?: string | null) {
  if (!isUuid(id)) return null;
  const [row] = await db
    .select({ ...cardColumns, linkedProjectId: partnerPost.projectId, banned: user.banned, ownerEmail: user.email })
    .from(partnerPost)
    .innerJoin(user, eq(user.id, partnerPost.ownerId))
    .leftJoin(profile, eq(profile.userId, user.id))
    .leftJoin(project, visibleProject)
    .where(eq(partnerPost.id, id))
    .limit(1);
  if (!row) return null;
  const isOwner = viewerId === row.ownerId;
  if (row.banned && !isOwner) return null;

  let requests: PartnerRequestItem[] = [];
  let mine: { id: string; status: RequestStatus; commitment: Commitment; message: string; createdAt: Date } | null = null;

  if (isOwner) {
    const rows = await db
      .select({
        id: partnerRequest.id,
        commitment: partnerRequest.commitment,
        message: partnerRequest.message,
        status: partnerRequest.status,
        createdAt: partnerRequest.createdAt,
        senderId: user.id,
        senderUsername: user.username,
        senderName: user.name,
        senderImage: user.image,
        senderHeadline: profile.headline,
        senderEmail: user.email,
      })
      .from(partnerRequest)
      .innerJoin(user, eq(user.id, partnerRequest.senderId))
      .leftJoin(profile, eq(profile.userId, user.id))
      .where(and(eq(partnerRequest.postId, id), notBanned))
      .orderBy(sql`case ${partnerRequest.status} when 'pending' then 0 when 'accepted' then 1 else 2 end`, desc(partnerRequest.createdAt));
    requests = rows.map((r) => ({
      id: r.id,
      commitment: r.commitment,
      message: r.message,
      status: r.status,
      createdAt: r.createdAt,
      sender: { id: r.senderId, username: r.senderUsername, name: r.senderName, image: r.senderImage, headline: r.senderHeadline, email: r.senderEmail },
    }));
  } else if (viewerId) {
    [mine = null] = await db
      .select({
        id: partnerRequest.id,
        status: partnerRequest.status,
        commitment: partnerRequest.commitment,
        message: partnerRequest.message,
        createdAt: partnerRequest.createdAt,
      })
      .from(partnerRequest)
      .where(and(eq(partnerRequest.postId, id), eq(partnerRequest.senderId, viewerId)))
      .limit(1);
  }

  return {
    ...toCard(row, mine?.status ?? null),
    isOwner,
    // Til redigering: også når prosjektet er et utkast.
    linkedProjectId: row.linkedProjectId,
    requests,
    mine,
    // Eierens e-post deles bare med dem som har fått ja.
    ownerEmail: mine?.status === "accepted" ? row.ownerEmail : null,
  };
}

export type PartnerPostDetail = NonNullable<Awaited<ReturnType<typeof getPartnerPost>>>;

// Det innlogget bruker har lagt ut, med ubesvarte forespørsler. Åpne først.
export async function listMyPosts(userId: string) {
  return db
    .select({
      id: partnerPost.id,
      title: partnerPost.title,
      closed: sql<boolean>`${partnerPost.closedAt} is not null`,
      pending: sql<number>`(select count(*)::int from ${partnerRequest} where ${partnerRequest.postId} = ${outer(partnerPost.id)} and ${partnerRequest.status} = 'pending')`,
    })
    .from(partnerPost)
    .where(eq(partnerPost.ownerId, userId))
    .orderBy(sql`${partnerPost.closedAt} is not null`, desc(partnerPost.createdAt))
    .limit(20);
}

// Forespørslene innlogget bruker har sendt, nyeste først.
export async function listMySentRequests(userId: string) {
  const owner = alias(user, "owner");
  return db
    .select({
      id: partnerRequest.id,
      status: partnerRequest.status,
      postId: partnerPost.id,
      postTitle: partnerPost.title,
      ownerName: owner.name,
    })
    .from(partnerRequest)
    .innerJoin(partnerPost, eq(partnerPost.id, partnerRequest.postId))
    .innerJoin(owner, eq(owner.id, partnerPost.ownerId))
    .where(eq(partnerRequest.senderId, userId))
    .orderBy(desc(partnerRequest.createdAt))
    .limit(20);
}

// Egne prosjekter man kan knytte en utlysning til.
export async function listOwnProjectsForPicker(userId: string) {
  return db
    .select({ id: project.id, title: project.title })
    .from(project)
    .where(and(eq(project.ownerId, userId), isNull(project.removedAt)))
    .orderBy(desc(project.updatedAt))
    .limit(100);
}

/* -------------------------------------------------------------------------- */
/*  Legge ut og endre                                                         */
/* -------------------------------------------------------------------------- */

async function countOpen(userId: string, except?: string) {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(partnerPost)
    .where(and(eq(partnerPost.ownerId, userId), isOpen, except ? ne(partnerPost.id, except) : undefined));
  return n;
}

// En idé har ikke noe prosjekt ennå. Et påbegynt prosjekt kan peke på et av eierens egne.
async function resolveProject(userId: string, input: PartnerPostInput) {
  if (input.stage !== "pabegynt" || !input.projectId) return null;
  if (!isUuid(input.projectId)) throw new UserFacingError("Fant ikke prosjektet.");
  const [row] = await db
    .select({ id: project.id })
    .from(project)
    .where(and(eq(project.id, input.projectId), eq(project.ownerId, userId), isNull(project.removedAt)))
    .limit(1);
  if (!row) throw new UserFacingError("Fant ikke prosjektet.");
  return row.id;
}

function values(input: PartnerPostInput, projectId: string | null) {
  return {
    title: input.title,
    description: input.description,
    stage: input.stage,
    projectId,
    needs: input.needs,
    commitments: input.commitments,
  };
}

export async function createPartnerPost(userId: string, input: PartnerPostInput) {
  if ((await countOpen(userId)) >= MAX_OPEN_PARTNER_POSTS) {
    throw new UserFacingError("Du kan ha opptil {n} åpne prosjekter. Lukk et før du legger ut et nytt.", { n: MAX_OPEN_PARTNER_POSTS });
  }
  const projectId = await resolveProject(userId, input);
  await enforce("partnerPost", userId);
  const [row] = await db
    .insert(partnerPost)
    .values({ ownerId: userId, ...values(input, projectId) })
    .returning({ id: partnerPost.id });
  log.info("partner.post.created", { userId, postId: row.id });
  return row.id;
}

async function requireOwnPost(userId: string, id: string) {
  if (!isUuid(id)) throw new UserFacingError("Fant ikke prosjektet.");
  const [row] = await db
    .select({ id: partnerPost.id, closedAt: partnerPost.closedAt })
    .from(partnerPost)
    .where(and(eq(partnerPost.id, id), eq(partnerPost.ownerId, userId)))
    .limit(1);
  if (!row) throw new UserFacingError("Fant ikke prosjektet.");
  return row;
}

export async function updatePartnerPost(userId: string, id: string, input: PartnerPostInput) {
  await requireOwnPost(userId, id);
  const projectId = await resolveProject(userId, input);
  await db.update(partnerPost).set(values(input, projectId)).where(eq(partnerPost.id, id));
}

// Lukk når du har funnet folk (ingen nye forespørsler), eller åpne igjen.
export async function setPartnerPostClosed(userId: string, id: string, closed: boolean) {
  const post = await requireOwnPost(userId, id);
  if (!closed && post.closedAt && (await countOpen(userId, id)) >= MAX_OPEN_PARTNER_POSTS) {
    throw new UserFacingError("Du kan ha opptil {n} åpne prosjekter. Lukk et før du legger ut et nytt.", { n: MAX_OPEN_PARTNER_POSTS });
  }
  await db
    .update(partnerPost)
    .set({ closedAt: closed ? (post.closedAt ?? new Date()) : null })
    .where(eq(partnerPost.id, id));
}

// Forespørslene og varslene om dem slettes sammen med utlysningen.
export async function deletePartnerPost(userId: string, id: string) {
  await requireOwnPost(userId, id);
  await db.delete(partnerPost).where(eq(partnerPost.id, id));
}

/* -------------------------------------------------------------------------- */
/*  Forespørsler                                                              */
/* -------------------------------------------------------------------------- */

type Sender = { id: string; name: string; email: string; username: string; emailVerified?: boolean | null };

// «Jeg vil hjelpe»: lagrer forespørselen, varsler eieren og sender den på e-post med
// avsenderens adresse som svaradresse. Eierens e-post deles først når de sier ja.
export async function sendPartnerRequest(sender: Sender, postId: string, input: { commitment: string; message: string }) {
  const message = input.message.trim().replace(/\n{3,}/g, "\n\n");
  if (message.length < REQUEST_MIN) throw new UserFacingError("Skriv litt mer (minst {n} tegn), så de vet hvem du er og hva du kan.", { n: REQUEST_MIN });
  if (message.length > REQUEST_MAX) throw new UserFacingError("Meldingen kan være maks {n} tegn.", { n: REQUEST_MAX });
  if (!(COMMITMENTS as readonly string[]).includes(input.commitment)) throw new UserFacingError("Velg hvor mye du vil bidra.");
  const commitment = input.commitment as Commitment;
  if (sender.emailVerified === false) throw new UserFacingError("Bekreft e-postadressen din før du kontakter andre.");
  if (!isUuid(postId)) throw new UserFacingError("Fant ikke prosjektet.");

  const [post] = await db
    .select({
      id: partnerPost.id,
      title: partnerPost.title,
      commitments: partnerPost.commitments,
      closedAt: partnerPost.closedAt,
      ownerId: user.id,
      ownerEmail: user.email,
      ownerEmailVerified: user.emailVerified,
      ownerBanned: user.banned,
      prefs: profile.notificationPrefs,
    })
    .from(partnerPost)
    .innerJoin(user, eq(user.id, partnerPost.ownerId))
    .leftJoin(profile, eq(profile.userId, user.id))
    .where(eq(partnerPost.id, postId))
    .limit(1);
  if (!post || post.ownerBanned) throw new UserFacingError("Fant ikke prosjektet.");
  if (post.ownerId === sender.id) throw new UserFacingError("Dette er ditt eget prosjekt.");
  if (post.closedAt) throw new UserFacingError("Prosjektet tar ikke imot flere forespørsler.");
  if (post.commitments.length > 0 && !post.commitments.includes(commitment)) {
    throw new UserFacingError("Velg en av måtene prosjektet ønsker hjelp på.");
  }

  const [existing] = await db
    .select({ id: partnerRequest.id })
    .from(partnerRequest)
    .where(and(eq(partnerRequest.postId, postId), eq(partnerRequest.senderId, sender.id)))
    .limit(1);
  if (existing) throw new UserFacingError("Du har allerede sendt en forespørsel om dette prosjektet.");

  await enforce("partnerRequest", sender.id);

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(partnerRequest)
      .values({ postId, senderId: sender.id, commitment, message })
      .onConflictDoNothing()
      .returning({ id: partnerRequest.id });
    // To klikk samtidig: den andre treffer den unike indeksen.
    if (!row) throw new UserFacingError("Du har allerede sendt en forespørsel om dette prosjektet.");
    await notify({ userId: post.ownerId, actorId: sender.id, type: "partner_request", partnerRequestId: row.id }, tx);
    return row;
  });

  if (canSendEmail && post.ownerEmailVerified && resolvePrefs(post.prefs).partner !== false) {
    sendEmailInBackground(
      partnerRequestEmail({
        to: post.ownerEmail,
        senderName: sender.name,
        senderEmail: sender.email,
        senderUsername: sender.username,
        postTitle: post.title,
        commitment: COMMITMENT_LABELS[commitment].label.toLowerCase(),
        message,
        path: `/partnere/${postId}#foresporsler`,
      }),
    );
  }
  log.info("partner.request.sent", { senderId: sender.id, postId, commitment });
  return created.id;
}

// Eieren sier ja eller nei. Ja kan også gis etter et nei, om man ombestemmer seg.
// Ved ja får avsenderen et varsel og en e-post med eierens adresse som svaradresse.
export async function respondToPartnerRequest(ownerId: string, requestId: string, accept: boolean) {
  if (!isUuid(requestId)) throw new UserFacingError("Fant ikke forespørselen.");
  const owner = alias(user, "owner");
  const sender = alias(user, "sender");
  const [row] = await db
    .select({
      status: partnerRequest.status,
      postId: partnerPost.id,
      postTitle: partnerPost.title,
      ownerId: partnerPost.ownerId,
      ownerName: owner.name,
      ownerEmail: owner.email,
      senderId: sender.id,
      senderEmail: sender.email,
      senderEmailVerified: sender.emailVerified,
      prefs: profile.notificationPrefs,
    })
    .from(partnerRequest)
    .innerJoin(partnerPost, eq(partnerPost.id, partnerRequest.postId))
    .innerJoin(owner, eq(owner.id, partnerPost.ownerId))
    .innerJoin(sender, eq(sender.id, partnerRequest.senderId))
    .leftJoin(profile, eq(profile.userId, sender.id))
    .where(eq(partnerRequest.id, requestId))
    .limit(1);
  if (!row || row.ownerId !== ownerId) throw new UserFacingError("Fant ikke forespørselen.");
  if (accept ? row.status === "accepted" : row.status !== "pending") throw new UserFacingError("Du har allerede svart på denne forespørselen.");

  await db.transaction(async (tx) => {
    await tx
      .update(partnerRequest)
      .set({ status: accept ? "accepted" : "declined", respondedAt: new Date() })
      .where(eq(partnerRequest.id, requestId));
    if (accept) await notify({ userId: row.senderId, actorId: ownerId, type: "partner_accepted", partnerRequestId: requestId }, tx);
  });

  if (accept && canSendEmail && row.senderEmailVerified && resolvePrefs(row.prefs).partner !== false) {
    sendEmailInBackground(
      partnerAcceptedEmail({
        to: row.senderEmail,
        ownerName: row.ownerName,
        ownerEmail: row.ownerEmail,
        postTitle: row.postTitle,
        path: `/partnere/${row.postId}`,
      }),
    );
  }
  log.info("partner.request.answered", { ownerId, requestId, accept });
  return row.postId;
}

// Avsenderen trekker forespørselen (eller seg selv etter et ja). Et nei står, så man
// ikke kan sende på nytt til noen som allerede har takket nei.
export async function withdrawPartnerRequest(senderId: string, requestId: string) {
  if (!isUuid(requestId)) throw new UserFacingError("Fant ikke forespørselen.");
  const removed = await db
    .delete(partnerRequest)
    .where(and(eq(partnerRequest.id, requestId), eq(partnerRequest.senderId, senderId), ne(partnerRequest.status, "declined")))
    .returning({ postId: partnerRequest.postId });
  if (removed.length === 0) throw new UserFacingError("Fant ikke forespørselen.");
  return removed[0].postId;
}

// Til dataeksporten (lib/account.ts).
export async function exportPartnerData(userId: string) {
  const [posts, requests] = await Promise.all([
    db
      .select({
        title: partnerPost.title,
        description: partnerPost.description,
        stage: partnerPost.stage,
        needs: partnerPost.needs,
        commitments: partnerPost.commitments,
        closedAt: partnerPost.closedAt,
        createdAt: partnerPost.createdAt,
      })
      .from(partnerPost)
      .where(eq(partnerPost.ownerId, userId))
      .orderBy(asc(partnerPost.createdAt)),
    db
      .select({
        post: partnerPost.title,
        commitment: partnerRequest.commitment,
        message: partnerRequest.message,
        status: partnerRequest.status,
        createdAt: partnerRequest.createdAt,
      })
      .from(partnerRequest)
      .innerJoin(partnerPost, eq(partnerPost.id, partnerRequest.postId))
      .where(eq(partnerRequest.senderId, userId))
      .orderBy(asc(partnerRequest.createdAt)),
  ]);
  return { posts, requestsSent: requests };
}
