import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
// Relativ sti: drizzle-kit leser denne filen uten Next sine stialiaser.
import {
  type CvTemplate,
  type OpenTo,
  REACTION_TYPES,
  type ReactionType,
  REPORT_REASONS,
} from "../lib/constants";

export type { CvTemplate, OpenTo, ReactionType };

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

// Binærdata (filinnhold). postgres.js gir og tar imot Buffer.
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/* -------------------------------------------------------------------------- */
/*  Auth (tabellene Better Auth forventer; feltnavnene må ikke endres)        */
/* -------------------------------------------------------------------------- */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  // Settes alltid ved opprettelse (se lib/auth.ts), brukes i /@brukernavn.
  username: text("username").notNull().unique(),
  displayUsername: text("display_username"),
  // Moderering (feltene admin-pluginen i Better Auth forventer). role "admin" gir
  // tilgang til /admin. En utestengt bruker kan ikke logge inn.
  role: text("role"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    impersonatedBy: text("impersonated_by"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("account_user_id_idx").on(t.userId),
    uniqueIndex("account_provider_account_uniq").on(t.providerId, t.accountId),
  ],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

/* -------------------------------------------------------------------------- */
/*  Profil                                                                    */
/* -------------------------------------------------------------------------- */

export type SocialLink = { label: string; url: string };

// Egne seksjoner på profilen, f.eks. «Utmerkelser» eller «Publikasjoner». Markdown.
export type ProfileSection = { id: string; title: string; body: string };

// Hvilke hendelser brukeren vil ha e-post om. In-app-varsler kommer alltid.
export type NotificationPrefs = {
  comment: boolean;
  reply: boolean;
  mention: boolean;
  follow: boolean;
};

// Én rad per bruker, opprettes første gang profilen lagres.
export const profile = pgTable("profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  headline: text("headline"),
  bio: text("bio"),
  location: text("location"),
  websiteUrl: text("website_url"),
  links: jsonb("links").$type<SocialLink[]>().notNull().default([]),
  // Lengre «README» om personen, full markdown. Vises under Oversikt på profilen.
  readme: text("readme"),
  // «Hva jeg ser etter», fritekst.
  lookingFor: text("looking_for"),
  openTo: jsonb("open_to").$type<OpenTo[]>().notNull().default([]),
  customSections: jsonb("custom_sections").$type<ProfileSection[]>().notNull().default([]),
  // Aksentfarge på profilen (en av fargene i lib/profile-theme.ts).
  accentColor: text("accent_color"),
  cvTemplate: text("cv_template").$type<CvTemplate>().notNull().default("klassisk"),
  notificationPrefs: jsonb("notification_prefs").$type<NotificationPrefs>(),
  updatedAt: updatedAt(),
});

/* -------------------------------------------------------------------------- */
/*  Prosjekter                                                                */
/* -------------------------------------------------------------------------- */

export const projectStatus = pgEnum("project_status", ["draft", "published"]);
export const projectSource = pgEnum("project_source", ["manual", "github"]);

export const project = pgTable(
  "project",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    // Kort ingress som vises på kortene i feeden.
    summary: text("summary"),
    // Markdown, vises som en README på prosjektsiden.
    description: text("description").notNull().default(""),
    repoUrl: text("repo_url"),
    demoUrl: text("demo_url"),
    // Video eller prototype (YouTube, Vimeo, Loom, Figma). Vises innebygd på prosjektsiden.
    videoUrl: text("video_url"),
    // Hva eieren gjorde i prosjektet, f.eks. «Design og frontend».
    role: text("role"),
    // "YYYY-MM" eller "YYYY".
    projectDate: varchar("project_date", { length: 7 }),
    status: projectStatus("status").notNull().default("published"),
    // Festet øverst på profilen (maks seks).
    pinned: boolean("pinned").notNull().default(false),
    viewCount: integer("view_count").notNull().default(0),
    // Fjernet av en moderator. Bare eieren (og admin) ser prosjektet da.
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedReason: text("removed_reason"),
    source: projectSource("source").notNull().default("manual"),
    githubRepoId: bigint("github_repo_id", { mode: "number" }),
    githubFullName: text("github_full_name"),
    githubSyncedAt: timestamp("github_synced_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      sql`setweight(to_tsvector('simple', coalesce("title", '')), 'A') || setweight(to_tsvector('simple', coalesce("summary", '')), 'B') || setweight(to_tsvector('simple', coalesce("description", '')), 'C')`,
    ),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("project_owner_idx").on(t.ownerId, t.createdAt.desc()),
    index("project_feed_idx").on(t.status, t.publishedAt.desc()),
    uniqueIndex("project_owner_github_repo_uniq").on(t.ownerId, t.githubRepoId),
    index("project_search_idx").using("gin", t.searchVector),
  ],
);

export const projectImage = pgTable(
  "project_image",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    // Nøkkel i fillagringen. Null for eksterne bilder (f.eks. fra en GitHub-README).
    storageKey: text("storage_key"),
    alt: text("alt"),
    // 0 er forsidebildet.
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("project_image_project_idx").on(t.projectId, t.position)],
);

export const tag = pgTable("tag", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Normalisert nøkkel, f.eks. "nextjs" for "Next.js".
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  createdAt: createdAt(),
});

export const projectTag = pgTable(
  "project_tag",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tag.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.tagId] }),
    index("project_tag_tag_idx").on(t.tagId),
  ],
);

/* -------------------------------------------------------------------------- */
/*  CV                                                                        */
/* -------------------------------------------------------------------------- */

// Datoer lagres som "YYYY-MM" eller "YYYY". endDate = null betyr pågående.
export const cvExperience = pgTable(
  "cv_experience",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    organization: text("organization").notNull(),
    location: text("location"),
    startDate: varchar("start_date", { length: 7 }),
    endDate: varchar("end_date", { length: 7 }),
    description: text("description"),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("cv_experience_user_idx").on(t.userId, t.position)],
);

export const cvEducation = pgTable(
  "cv_education",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    institution: text("institution").notNull(),
    degree: text("degree"),
    fieldOfStudy: text("field_of_study"),
    startDate: varchar("start_date", { length: 7 }),
    endDate: varchar("end_date", { length: 7 }),
    description: text("description"),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("cv_education_user_idx").on(t.userId, t.position)],
);

export const cvSkill = pgTable(
  "cv_skill",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index("cv_skill_user_idx").on(t.userId, t.position),
    uniqueIndex("cv_skill_user_name_uniq").on(t.userId, sql`lower(${t.name})`),
  ],
);

export const cvImportStatus = pgEnum("cv_import_status", [
  "parsed",
  "applied",
  "discarded",
  "failed",
]);

// Resultatet av en tolket CV. Lagres som utkast til brukeren har gått gjennom
// det og valgt å bruke det. Selve CV-filen lagres ikke.
export const cvImport = pgTable(
  "cv_import",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    status: cvImportStatus("status").notNull(),
    result: jsonb("result"),
    error: text("error"),
    createdAt: createdAt(),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
  },
  (t) => [index("cv_import_user_idx").on(t.userId, t.createdAt.desc())],
);

export type CvPage = { url: string; key: string; width: number; height: number };

// CV-en som dokument (PDF eller bilde), vist som bilder på profilen.
// PDF-sider gjøres om til bilder i nettleseren ved opplasting, så profilen laster raskt.
export const cvDocument = pgTable("cv_document", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  fileUrl: text("file_url").notNull(),
  fileKey: text("file_key").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  pages: jsonb("pages").$type<CvPage[]>().notNull().default([]),
  isPublic: boolean("is_public").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/* -------------------------------------------------------------------------- */
/*  Kommentarer og varsler                                                    */
/* -------------------------------------------------------------------------- */

export const comment = pgTable(
  "comment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Svar på en annen kommentar (ett nivå). Svarene slettes sammen med kommentaren.
    parentId: uuid("parent_id").references((): AnyPgColumn => comment.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("comment_project_idx").on(t.projectId, t.createdAt),
    index("comment_author_idx").on(t.authorId, t.createdAt.desc()),
    index("comment_parent_idx").on(t.parentId),
  ],
);

export const notificationType = pgEnum("notification_type", [
  "comment",
  "reply",
  "mention",
  "follow",
  "reaction",
]);

export const notification = pgTable(
  "notification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Mottakeren.
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: notificationType("type").notNull(),
    projectId: uuid("project_id").references(() => project.id, { onDelete: "cascade" }),
    commentId: uuid("comment_id").references(() => comment.id, { onDelete: "cascade" }),
    // Ekstra detaljer, f.eks. hvilken reaksjon det gjelder.
    data: jsonb("data").$type<{ reaction?: ReactionType }>(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notification_user_idx").on(t.userId, t.createdAt.desc())],
);

/* -------------------------------------------------------------------------- */
/*  Sosialt: følging, reaksjoner og visninger                                 */
/* -------------------------------------------------------------------------- */

export const follow = pgTable(
  "follow",
  {
    followerId: text("follower_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    followingId: text("following_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followingId] }),
    index("follow_following_idx").on(t.followingId, t.createdAt.desc()),
  ],
);

export const reactionType = pgEnum("reaction_type", REACTION_TYPES);

// Én rad per bruker, prosjekt og type. Man kan gi flere typer til samme prosjekt.
export const reaction = pgTable(
  "reaction",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: reactionType("type").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.userId, t.type] }),
    index("reaction_project_idx").on(t.projectId, t.createdAt.desc()),
    index("reaction_user_idx").on(t.userId),
  ],
);

// Visninger telles per dag, uten å lagre hvem som så på (se lib/views.ts).
export const projectViewDay = pgTable(
  "project_view_day",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    views: integer("views").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.day] })],
);

export const profileViewDay = pgTable(
  "profile_view_day",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    views: integer("views").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] })],
);

/* -------------------------------------------------------------------------- */
/*  Moderering                                                                */
/* -------------------------------------------------------------------------- */

export const reportTarget = pgEnum("report_target", ["project", "comment", "user"]);
export const reportReason = pgEnum("report_reason", REPORT_REASONS);
export const reportStatus = pgEnum("report_status", ["open", "resolved", "dismissed"]);

export const report = pgTable(
  "report",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Beholdes selv om den som rapporterte sletter kontoen.
    reporterId: text("reporter_id").references(() => user.id, { onDelete: "set null" }),
    targetType: reportTarget("target_type").notNull(),
    targetId: text("target_id").notNull(),
    // Et øyeblikksbilde av det som ble rapportert, så moderatoren ser det selv om
    // innholdet endres eller slettes etterpå.
    targetLabel: text("target_label"),
    targetUrl: text("target_url"),
    excerpt: text("excerpt"),
    targetOwnerId: text("target_owner_id").references(() => user.id, { onDelete: "set null" }),
    reason: reportReason("reason").notNull(),
    details: text("details"),
    status: reportStatus("status").notNull().default("open"),
    resolution: text("resolution"),
    resolvedById: text("resolved_by_id").references(() => user.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("report_status_idx").on(t.status, t.createdAt.desc()),
    index("report_target_idx").on(t.targetType, t.targetId),
  ],
);

/* -------------------------------------------------------------------------- */
/*  Filer                                                                     */
/* -------------------------------------------------------------------------- */

// Bilder og CV-er lagres her når Vercel Blob ikke er satt opp (se lib/storage.ts), og
// serveres fra /filer/<key>. Filene slettes sammen med brukeren som eier dem.
export const storedFile = pgTable(
  "stored_file",
  {
    key: text("key").primaryKey(),
    ownerId: text("owner_id").references(() => user.id, { onDelete: "cascade" }),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    // Private filer (f.eks. en skjult CV) vises bare for eieren.
    isPrivate: boolean("is_private").notNull().default(false),
    data: bytea("data").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("stored_file_owner_idx").on(t.ownerId)],
);
