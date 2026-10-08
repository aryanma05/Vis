import "server-only";

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, schema } from "@/db";
import { cancelAllSubscriptions } from "@/lib/billing";
import { releaseCompaniesOf } from "@/lib/companies";
import { AUDIT_ACTION_LABELS, type AuditAction } from "@/lib/company-labels";
import { getCv } from "@/lib/cv";
import { deleteStoredFiles, storageKeyFromUrl } from "@/lib/storage";

const {
  account,
  apiKey,
  applicationNote,
  applicationReview,
  collection,
  collectionItem,
  comment,
  company,
  companyAudit,
  companyBlock,
  companyMember,
  contactRequest,
  cvDocument,
  follow,
  planGrant,
  profile,
  profileVisit,
  project,
  projectImage,
  projectTag,
  projectUpdate,
  reaction,
  subscription,
  tag,
  talentList,
  talentListMember,
  user,
  userAchievement,
} = schema;

// Kjøres før kontoen slettes: avslutt Pro hos Stripe og gi bedriftene en ny eier. Feiler
// Stripe, stoppes slettingen, så ingen betaler for en konto som ikke finnes.
export async function prepareAccountDeletion(userId: string) {
  await cancelAllSubscriptions("user", userId);
  await releaseCompaniesOf(userId);
}

// Har brukeren et passord (og ikke bare GitHub-innlogging)?
export async function hasPassword(userId: string) {
  const [row] = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "credential")))
    .limit(1);
  return Boolean(row);
}

// Sletter alle filene til en bruker før kontoen slettes. Radene i databasen (også filer
// lagret der) forsvinner av seg selv når brukeren slettes, men filer i Vercel Blob må
// fjernes her.
export async function deleteAllFilesOfUser(userId: string) {
  const [owner] = await db.select({ image: user.image }).from(user).where(eq(user.id, userId)).limit(1);
  const [own] = await db.select({ banner: profile.banner }).from(profile).where(eq(profile.userId, userId)).limit(1);
  const images = await db
    .select({ key: projectImage.storageKey })
    .from(projectImage)
    .innerJoin(project, eq(project.id, projectImage.projectId))
    .where(eq(project.ownerId, userId));
  const [cv] = await db
    .select({ fileKey: cvDocument.fileKey, pages: cvDocument.pages })
    .from(cvDocument)
    .where(eq(cvDocument.userId, userId))
    .limit(1);

  const keys = [
    owner?.image ? storageKeyFromUrl(owner.image) : null,
    own?.banner?.type === "image" ? storageKeyFromUrl(own.banner.url) : null,
    ...images.map((i) => i.key),
    cv?.fileKey,
    ...(cv?.pages.map((p) => p.key) ?? []),
  ];
  await deleteStoredFiles(keys);
}

// Det kontosiden viser. Leses fra databasen (ikke fra økten), så en nettopp bekreftet
// e-post vises som bekreftet med en gang.
export async function getAccountInfo(userId: string) {
  const [row] = await db
    .select({ email: user.email, emailVerified: user.emailVerified, createdAt: user.createdAt, twoFactorEnabled: user.twoFactorEnabled })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!row) return null;
  const providers = await db.select({ provider: account.providerId }).from(account).where(eq(account.userId, userId));
  const linked = new Set(providers.map((p) => p.provider));
  return { ...row, hasPassword: linked.has("credential"), github: linked.has("github"), google: linked.has("google") };
}

// Alt vi har lagret om brukeren, som JSON (retten til innsyn og dataportabilitet i GDPR).
export async function exportUserData(userId: string) {
  const [owner] = await db
    .select({
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      username: user.username,
      displayUsername: user.displayUsername,
      image: user.image,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  const [profileRow] = await db
    .select({
      headline: profile.headline,
      bio: profile.bio,
      location: profile.location,
      websiteUrl: profile.websiteUrl,
      links: profile.links,
      readme: profile.readme,
      lookingFor: profile.lookingFor,
      openTo: profile.openTo,
      customSections: profile.customSections,
      accentColor: profile.accentColor,
      banner: profile.banner,
      pet: profile.pet,
      cvTemplate: profile.cvTemplate,
      notificationPrefs: profile.notificationPrefs,
      visibleToCompanies: profile.visibleToCompanies,
      studyProgram: profile.studyProgram,
      graduationYear: profile.graduationYear,
    })
    .from(profile)
    .where(eq(profile.userId, userId))
    .limit(1);

  const projects = await db
    .select({
      id: project.id,
      title: project.title,
      summary: project.summary,
      description: project.description,
      repoUrl: project.repoUrl,
      demoUrl: project.demoUrl,
      videoUrl: project.videoUrl,
      role: project.role,
      projectDate: project.projectDate,
      status: project.status,
      pinned: project.pinned,
      viewCount: project.viewCount,
      createdAt: project.createdAt,
    })
    .from(project)
    .where(eq(project.ownerId, userId))
    .orderBy(asc(project.createdAt));
  const ids = projects.map((p) => p.id);
  const [images, tags] = ids.length
    ? await Promise.all([
        db
          .select({ projectId: projectImage.projectId, url: projectImage.url, alt: projectImage.alt })
          .from(projectImage)
          .where(inArray(projectImage.projectId, ids))
          .orderBy(asc(projectImage.position)),
        db
          .select({ projectId: projectTag.projectId, name: tag.name })
          .from(projectTag)
          .innerJoin(tag, eq(tag.id, projectTag.tagId))
          .where(inArray(projectTag.projectId, ids)),
      ])
    : [[], []];

  const following = alias(user, "following");
  const follower = alias(user, "follower");
  const [cv, [cvDoc], comments, accounts, followingRows, followerRows, reactions] = await Promise.all([
    getCv(userId),
    db
      .select({ fileName: cvDocument.fileName, fileUrl: cvDocument.fileUrl, isPublic: cvDocument.isPublic, updatedAt: cvDocument.updatedAt })
      .from(cvDocument)
      .where(eq(cvDocument.userId, userId))
      .limit(1),
    db
      .select({ projectId: comment.projectId, body: comment.body, createdAt: comment.createdAt })
      .from(comment)
      .where(eq(comment.authorId, userId))
      .orderBy(asc(comment.createdAt)),
    db.select({ provider: account.providerId, createdAt: account.createdAt }).from(account).where(eq(account.userId, userId)),
    db
      .select({ username: following.username, since: follow.createdAt })
      .from(follow)
      .innerJoin(following, eq(following.id, follow.followingId))
      .where(eq(follow.followerId, userId)),
    db
      .select({ username: follower.username, since: follow.createdAt })
      .from(follow)
      .innerJoin(follower, eq(follower.id, follow.followerId))
      .where(eq(follow.followingId, userId)),
    db
      .select({ projectId: reaction.projectId, type: reaction.type, createdAt: reaction.createdAt })
      .from(reaction)
      .where(eq(reaction.userId, userId)),
  ]);

  const sender = alias(user, "sender");
  const recipient = alias(user, "recipient");
  const visited = alias(user, "visited");
  const [contactsSent, contactsReceived, collections, collectionItems, updates, subscriptions, grants, companies, apiKeys, visits] = await Promise.all([
    db
      .select({ to: recipient.username, company: company.name, reason: contactRequest.reason, message: contactRequest.message, createdAt: contactRequest.createdAt })
      .from(contactRequest)
      .innerJoin(recipient, eq(recipient.id, contactRequest.recipientId))
      .leftJoin(company, eq(company.id, contactRequest.companyId))
      .where(eq(contactRequest.senderId, userId))
      .orderBy(asc(contactRequest.createdAt)),
    db
      .select({ from: sender.username, company: company.name, reason: contactRequest.reason, message: contactRequest.message, createdAt: contactRequest.createdAt })
      .from(contactRequest)
      .innerJoin(sender, eq(sender.id, contactRequest.senderId))
      .leftJoin(company, eq(company.id, contactRequest.companyId))
      .where(eq(contactRequest.recipientId, userId))
      .orderBy(asc(contactRequest.createdAt)),
    db
      .select({ id: collection.id, title: collection.title, description: collection.description, isPublic: collection.isPublic })
      .from(collection)
      .where(eq(collection.ownerId, userId)),
    db
      .select({ collectionId: collectionItem.collectionId, projectId: collectionItem.projectId, addedAt: collectionItem.addedAt })
      .from(collectionItem)
      .innerJoin(collection, eq(collection.id, collectionItem.collectionId))
      .where(eq(collection.ownerId, userId)),
    db
      .select({ projectId: projectUpdate.projectId, body: projectUpdate.body, createdAt: projectUpdate.createdAt })
      .from(projectUpdate)
      .innerJoin(project, eq(project.id, projectUpdate.projectId))
      .where(eq(project.ownerId, userId)),
    db
      .select({ plan: subscription.plan, status: subscription.status, interval: subscription.interval, currentPeriodEnd: subscription.currentPeriodEnd })
      .from(subscription)
      .where(and(eq(subscription.ownerType, "user"), eq(subscription.ownerId, userId))),
    db
      .select({ plan: planGrant.plan, until: planGrant.until })
      .from(planGrant)
      .where(and(eq(planGrant.ownerType, "user"), eq(planGrant.ownerId, userId))),
    db
      .select({ company: company.name, slug: company.slug, role: companyMember.role, since: companyMember.createdAt })
      .from(companyMember)
      .innerJoin(company, eq(company.id, companyMember.companyId))
      .where(eq(companyMember.userId, userId)),
    db
      .select({ name: apiKey.name, prefix: apiKey.prefix, lastUsedAt: apiKey.lastUsedAt, revokedAt: apiKey.revokedAt, createdAt: apiKey.createdAt })
      .from(apiKey)
      .where(eq(apiKey.userId, userId)),
    db
      .select({ profile: visited.username, visits: profileVisit.visits, lastSeenAt: profileVisit.lastSeenAt })
      .from(profileVisit)
      .innerJoin(visited, eq(visited.id, profileVisit.profileUserId))
      .where(eq(profileVisit.viewerId, userId))
      .orderBy(desc(profileVisit.lastSeenAt)),
  ]);

  // Det bedrifter har lagret om deg: lister med notater, hva de har gjort med dataene dine
  // (aktivitetsloggen, uten hvem i bedriften), notater og vurderinger på søknadene dine, og
  // bedriftene du har blokkert. Hvem i bedriften som skrev, er kollegaenes opplysninger og tas ikke med.
  const { job, jobApplication } = schema;
  const [lists, companyLog, notes, reviews, blocks] = await Promise.all([
    db
      .select({ company: company.name, list: talentList.name, addedAt: talentListMember.addedAt, expiresAt: talentListMember.expiresAt, note: talentListMember.note })
      .from(talentListMember)
      .innerJoin(talentList, eq(talentList.id, talentListMember.listId))
      .innerJoin(company, eq(company.id, talentList.companyId))
      .where(eq(talentListMember.userId, userId))
      .orderBy(asc(talentListMember.addedAt)),
    db
      .select({ company: company.name, action: companyAudit.action, createdAt: companyAudit.createdAt })
      .from(companyAudit)
      .innerJoin(company, eq(company.id, companyAudit.companyId))
      .where(eq(companyAudit.subjectUserId, userId))
      .orderBy(asc(companyAudit.createdAt)),
    db
      .select({ company: company.name, job: job.title, body: applicationNote.body, createdAt: applicationNote.createdAt, editedAt: applicationNote.editedAt })
      .from(applicationNote)
      .innerJoin(jobApplication, eq(jobApplication.id, applicationNote.applicationId))
      .innerJoin(job, eq(job.id, jobApplication.jobId))
      .innerJoin(company, eq(company.id, job.companyId))
      .where(eq(jobApplication.userId, userId))
      .orderBy(asc(applicationNote.createdAt)),
    db
      .select({
        company: company.name,
        job: job.title,
        scores: applicationReview.scores,
        recommendation: applicationReview.recommendation,
        comment: applicationReview.comment,
        submittedAt: applicationReview.submittedAt,
      })
      .from(applicationReview)
      .innerJoin(jobApplication, eq(jobApplication.id, applicationReview.applicationId))
      .innerJoin(job, eq(job.id, jobApplication.jobId))
      .innerJoin(company, eq(company.id, job.companyId))
      .where(eq(jobApplication.userId, userId))
      .orderBy(asc(applicationReview.submittedAt)),
    db
      .select({ company: company.name, since: companyBlock.createdAt })
      .from(companyBlock)
      .innerJoin(company, eq(company.id, companyBlock.companyId))
      .where(eq(companyBlock.userId, userId)),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    account: { ...owner, loginMethods: accounts.map((a) => (a.provider === "credential" ? "e-post og passord" : a.provider)) },
    profile: profileRow ?? null,
    projects: projects.map((p) => ({
      ...p,
      tags: tags.filter((t) => t.projectId === p.id).map((t) => t.name),
      images: images.filter((i) => i.projectId === p.id).map(({ url, alt }) => ({ url, alt })),
    })),
    cv,
    cvDocument: cvDoc ?? null,
    comments,
    following: followingRows,
    followers: followerRows,
    reactions,
    projectUpdates: updates,
    collections: collections.map((c) => ({ ...c, projects: collectionItems.filter((i) => i.collectionId === c.id).map(({ projectId, addedAt }) => ({ projectId, addedAt })) })),
    contactRequests: { sent: contactsSent, received: contactsReceived },
    // Profiler du har besøkt mens du var innlogget (vises for Pro-eiere hvis du ikke har skjult deg).
    profilesVisited: visits,
    plan: { subscriptions, grants },
    companies,
    // Selve nøklene lagres ikke, bare starten av dem.
    apiKeys,
    achievements: await db
      .select({ key: userAchievement.key, tier: userAchievement.tier, unlockedAt: userAchievement.unlockedAt })
      .from(userAchievement)
      .where(eq(userAchievement.userId, userId)),
    // Søknader med Vis-profilen.
    applications: await db
      .select({
        job: schema.job.title,
        company: company.name,
        status: schema.jobApplication.status,
        message: schema.jobApplication.message,
        projectIds: schema.jobApplication.projectIds,
        createdAt: schema.jobApplication.createdAt,
        statusChangedAt: schema.jobApplication.statusChangedAt,
      })
      .from(schema.jobApplication)
      .innerJoin(schema.job, eq(schema.job.id, schema.jobApplication.jobId))
      .innerJoin(company, eq(company.id, schema.job.companyId))
      .where(eq(schema.jobApplication.userId, userId)),
    challengeEntries: await db
      .select({ challenge: schema.challenge.title, projectId: schema.challengeEntry.projectId, note: schema.challengeEntry.note, createdAt: schema.challengeEntry.createdAt })
      .from(schema.challengeEntry)
      .innerJoin(schema.challenge, eq(schema.challenge.id, schema.challengeEntry.challengeId))
      .where(eq(schema.challengeEntry.userId, userId)),
    teams: await db
      .select({ company: company.name, title: schema.companyEmployee.title, since: schema.companyEmployee.createdAt })
      .from(schema.companyEmployee)
      .innerJoin(company, eq(company.id, schema.companyEmployee.companyId))
      .where(eq(schema.companyEmployee.userId, userId)),
    companiesAndYou: {
      talentLists: lists,
      activity: companyLog.map((r) => ({ company: r.company, action: r.action, description: AUDIT_ACTION_LABELS[r.action as AuditAction] ?? r.action, createdAt: r.createdAt })),
      applicationNotes: notes,
      applicationReviews: reviews,
      blocked: blocks,
    },
  };
}
