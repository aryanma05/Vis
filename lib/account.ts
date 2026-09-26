import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, schema } from "@/db";
import { getCv } from "@/lib/cv";
import { deleteStoredFiles, storageKeyFromUrl } from "@/lib/storage";

const { account, comment, cvDocument, follow, profile, project, projectImage, projectTag, reaction, tag, user } = schema;

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
    .select({ email: user.email, emailVerified: user.emailVerified, createdAt: user.createdAt })
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
      cvTemplate: profile.cvTemplate,
      notificationPrefs: profile.notificationPrefs,
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
  };
}
