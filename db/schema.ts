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
  type Commitment,
  COMMITMENTS,
  CONTACT_REASONS,
  type CvTemplate,
  PARTNER_STAGES,
  PROJECT_PROGRESS,
  type OpenTo,
  REACTION_TYPES,
  type ReactionType,
  REPORT_REASONS,
} from "../lib/constants";
import type { BannerConfig, PetConfig } from "../lib/profile-style";

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
  // To-trinns innlogging (twoFactor-pluginen i Better Auth).
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
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

// Hemmeligheten til appen for engangskoder og reservekodene (kryptert av Better Auth).
export const twoFactor = pgTable(
  "two_factor",
  {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    verified: boolean("verified").default(true),
    failedVerificationCount: integer("failed_verification_count").default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
  },
  (t) => [index("two_factor_user_idx").on(t.userId), index("two_factor_secret_idx").on(t.secret)],
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
  // Ukesoppsummering på e-post (standard på; kan skrus av i e-posten eller under Konto).
  digest?: boolean;
  // E-post når noen bruker «Kontakt meg» (standard på).
  contact?: boolean;
  // E-post når noen vil hjelpe med et prosjekt man har lagt ut, eller sier ja til en (standard på).
  partner?: boolean;
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
  // Banneret øverst og kjæledyret på profilen (lib/profile-style.ts). Null = standard / ingen.
  banner: jsonb("banner").$type<BannerConfig>(),
  pet: jsonb("pet").$type<PetConfig>(),
  cvTemplate: text("cv_template").$type<CvTemplate>().notNull().default("klassisk"),
  notificationPrefs: jsonb("notification_prefs").$type<NotificationPrefs>(),
  // «Kontakt meg»-knappen på profilen. Av til personen selv slår den på.
  contactEnabled: boolean("contact_enabled").notNull().default(false),
  // Når siste ukesoppsummering ble sendt (så samme uke ikke sendes to ganger).
  digestSentAt: timestamp("digest_sent_at", { withTimezone: true }),
  // Ikke vis meg i «Hvem har sett profilen» hos andre (da ser man heller ikke selv hvem).
  hideVisits: boolean("hide_visits").notNull().default(false),
  // Kan finnes av bedrifter i kandidatsøket (Bedrift-planen). Av til personen slår det på.
  visibleToCompanies: boolean("visible_to_companies").notNull().default(false),
  // Pro: skjul «Laget med Vis» på CV-en og i innbyggingskortene.
  hideBranding: boolean("hide_branding").notNull().default(false),
  updatedAt: updatedAt(),
});

/* -------------------------------------------------------------------------- */
/*  Prosjekter                                                                */
/* -------------------------------------------------------------------------- */

export const projectStatus = pgEnum("project_status", ["draft", "published"]);
export const projectSource = pgEnum("project_source", ["manual", "github"]);
// Om prosjektet er ferdig eller fortsatt under arbeid.
export const projectProgress = pgEnum("project_progress", PROJECT_PROGRESS);

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
    progress: projectProgress("progress").notNull().default("completed"),
    // Festet øverst på profilen (maks seks).
    pinned: boolean("pinned").notNull().default(false),
    viewCount: integer("view_count").notNull().default(0),
    // Fjernet av en moderator. Bare eieren (og admin) ser prosjektet da.
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedReason: text("removed_reason"),
    // Valgt ut av redaksjonen (admin). Vises øverst på forsiden og i Utforsk.
    featuredAt: timestamp("featured_at", { withTimezone: true }),
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
    index("project_featured_idx").on(t.featuredAt.desc()),
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

// Andre som har vært med på prosjektet. Eieren legger dem til; de kan fjerne seg selv.
export const projectMember = pgTable(
  "project_member",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.userId] }),
    index("project_member_user_idx").on(t.userId),
  ],
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
  "contact",
  "featured",
  "member",
  // Noen vil hjelpe med et prosjekt du har lagt ut på /partnere, og når du får ja.
  "partner_request",
  "partner_accepted",
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
    // Forespørselen om å hjelpe (partner_request / partner_accepted). Forsvinner med den.
    partnerRequestId: uuid("partner_request_id").references((): AnyPgColumn => partnerRequest.id, { onDelete: "cascade" }),
    // Ekstra detaljer, f.eks. hvilken reaksjon det gjelder.
    data: jsonb("data").$type<{ reaction?: ReactionType; contactId?: string }>(),
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

// Prestasjonene en bruker har låst opp (lib/achievement-defs.ts). Én rad per merke med
// det høyeste nivået; merker tas aldri bort igjen, selv om tallet de bygger på går ned.
export const userAchievement = pgTable(
  "user_achievement",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    tier: integer("tier").notNull().default(1),
    // Når det nåværende nivået ble låst opp.
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
    // Når eieren så feiringen. Null = ny siden sist.
    seenAt: timestamp("seen_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
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

/* -------------------------------------------------------------------------- */
/*  Drift: begrensninger og feillogg                                          */
/* -------------------------------------------------------------------------- */

// Tellere for begrensninger (lib/rate-limit.ts), f.eks. «skjermbilder:<bruker>».
// Fast tidsvindu: telleren starter på nytt når vinduet er over. Ligger i databasen,
// så grensene gjelder på tvers av serverprosesser og overlever omstart.
export const rateBucket = pgTable(
  "rate_bucket",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull().default(0),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("rate_bucket_window_idx").on(t.windowStart)],
);

// Feil fra serveren og nettleseren, så admin kan se dem under /admin?fane=system uten
// å lete i loggene hos vertsleverandøren. Ryddes etter 30 dager (lib/errors.ts).
export const errorEvent = pgTable(
  "error_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // "server", "action" eller "client".
    source: text("source").notNull(),
    event: text("event").notNull(),
    message: text("message").notNull(),
    digest: text("digest"),
    path: text("path"),
    stack: text("stack"),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("error_event_created_idx").on(t.createdAt.desc())],
);

/* -------------------------------------------------------------------------- */
/*  Vekst: kontakt, samlinger og oppdateringer                                */
/* -------------------------------------------------------------------------- */

export const contactReason = pgEnum("contact_reason", CONTACT_REASONS);

// «Kontakt meg» på profilen. Mottakeren får varsel og e-post med svaradressen til avsenderen.
export const contactRequest = pgTable(
  "contact_request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipientId: text("recipient_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    senderId: text("sender_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Sendt på vegne av en bedrift (Bedrift-planen), ellers null.
    companyId: uuid("company_id").references((): AnyPgColumn => company.id, { onDelete: "set null" }),
    reason: contactReason("reason").notNull().default("annet"),
    message: text("message").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("contact_request_recipient_idx").on(t.recipientId, t.createdAt.desc()),
    index("contact_request_sender_idx").on(t.senderId, t.createdAt.desc()),
  ],
);

// Samlinger av prosjekter («Inspirasjon», «Beste studentprosjekter»). Private eller offentlige.
export const collection = pgTable(
  "collection",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    isPublic: boolean("is_public").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("collection_owner_idx").on(t.ownerId, t.updatedAt.desc())],
);

export const collectionItem = pgTable(
  "collection_item",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collection.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.collectionId, t.projectId] }),
    index("collection_item_project_idx").on(t.projectId),
  ],
);

// Oppdateringer på et prosjekt («Ny versjon ute», «Lagt til mørk modus»), nyeste først.
export const projectUpdate = pgTable(
  "project_update",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("project_update_project_idx").on(t.projectId, t.createdAt.desc())],
);

/* -------------------------------------------------------------------------- */
/*  Samarbeid: prosjekter som trenger hjelp                                   */
/* -------------------------------------------------------------------------- */

export const partnerStage = pgEnum("partner_stage", PARTNER_STAGES);
export const partnerCommitment = pgEnum("partner_commitment", COMMITMENTS);
export const partnerRequestStatus = pgEnum("partner_request_status", ["pending", "accepted", "declined"]);

// En idé eller et påbegynt prosjekt som trenger folk (/partnere). Vises også på profilen.
export const partnerPost = pgTable(
  "partner_post",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Et prosjekt eieren allerede har delt på Vis, om det er påbegynt.
    projectId: uuid("project_id").references(() => project.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    stage: partnerStage("stage").notNull().default("ide"),
    // Hva de trenger hjelp med, f.eks. «Design» og «Backend».
    needs: jsonb("needs").$type<string[]>().notNull().default([]),
    // Hvor mye hjelp som passer: fra start til slutt, en del av det, bare for gøy.
    commitments: jsonb("commitments").$type<Commitment[]>().notNull().default([]),
    // Satt når eieren har funnet folk eller lagt bort prosjektet. Null = åpen.
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("partner_post_owner_idx").on(t.ownerId, t.createdAt.desc()),
    index("partner_post_list_idx").on(t.closedAt, t.createdAt.desc()),
    index("partner_post_project_idx").on(t.projectId),
  ],
);

// «Jeg vil hjelpe»: én per person og utlysning. Eieren sier ja eller nei; ved ja får de
// hverandres e-postadresser.
export const partnerRequest = pgTable(
  "partner_request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => partnerPost.id, { onDelete: "cascade" }),
    senderId: text("sender_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    commitment: partnerCommitment("commitment").notNull(),
    message: text("message").notNull(),
    status: partnerRequestStatus("status").notNull().default("pending"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("partner_request_post_sender_uniq").on(t.postId, t.senderId),
    index("partner_request_sender_idx").on(t.senderId, t.createdAt.desc()),
  ],
);

/* -------------------------------------------------------------------------- */
/*  Betaling (Stripe)                                                         */
/* -------------------------------------------------------------------------- */

// Hvem betaler: en person (Pro) eller en bedrift (Bedrift).
export const billingOwner = pgEnum("billing_owner", ["user", "company"]);
export const planKind = pgEnum("plan_kind", ["pro", "business"]);

// Kunden hos Stripe for en person eller bedrift.
export const billingCustomer = pgTable(
  "billing_customer",
  {
    ownerType: billingOwner("owner_type").notNull(),
    ownerId: text("owner_id").notNull(),
    stripeCustomerId: text("stripe_customer_id").notNull().unique(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.ownerType, t.ownerId] })],
);

// Abonnementene slik Stripe sist meldte dem (webhook), én rad per abonnement.
export const subscription = pgTable(
  "subscription",
  {
    id: text("id").primaryKey(),
    ownerType: billingOwner("owner_type").notNull(),
    ownerId: text("owner_id").notNull(),
    plan: planKind("plan").notNull(),
    priceId: text("price_id"),
    // Stripe-status: active, trialing, past_due, canceled, unpaid, incomplete …
    status: text("status").notNull(),
    interval: text("interval"),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("subscription_owner_idx").on(t.ownerType, t.ownerId)],
);

// Pro eller Bedrift gitt av admin (f.eks. til ambassadører eller skoler), uten Stripe.
export const planGrant = pgTable(
  "plan_grant",
  {
    ownerType: billingOwner("owner_type").notNull(),
    ownerId: text("owner_id").notNull(),
    plan: planKind("plan").notNull(),
    // null = uten sluttdato.
    until: timestamp("until", { withTimezone: true }),
    note: text("note"),
    grantedById: text("granted_by_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.ownerType, t.ownerId] })],
);

// Webhook-hendelser vi har behandlet, så samme hendelse aldri behandles to ganger.
export const stripeEvent = pgTable("stripe_event", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  createdAt: createdAt(),
});

/* -------------------------------------------------------------------------- */
/*  Pro                                                                       */
/* -------------------------------------------------------------------------- */

// Hvem (innloggede) som har sett en profil. Vises for Pro-brukere under Innsikt.
export const profileVisit = pgTable(
  "profile_visit",
  {
    profileUserId: text("profile_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    viewerId: text("viewer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    visits: integer("visits").notNull().default(1),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.profileUserId, t.viewerId] }),
    index("profile_visit_recent_idx").on(t.profileUserId, t.lastSeenAt.desc()),
  ],
);

// Eget domene til profilen (Pro), f.eks. ola.no. Bekreftes med en TXT-post i DNS.
export const customDomain = pgTable("custom_domain", {
  domain: text("domain").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: createdAt(),
});

/* -------------------------------------------------------------------------- */
/*  Bedrift                                                                   */
/* -------------------------------------------------------------------------- */

export const company = pgTable("company", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  website: text("website"),
  logoUrl: text("logo_url"),
  about: text("about"),
  location: text("location"),
  // «1–10», «11–50», «51–200», «201–1000», «1000+».
  size: text("size"),
  // Bekreftet av admin (vises med hake).
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdById: text("created_by_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const companyRole = pgEnum("company_role", ["owner", "admin", "member"]);

export const companyMember = pgTable(
  "company_member",
  {
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: companyRole("role").notNull().default("member"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.companyId, t.userId] }), index("company_member_user_idx").on(t.userId)],
);

export const jobStatus = pgEnum("job_status", ["draft", "published", "closed"]);

export const job = pgTable(
  "job",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    // Markdown.
    description: text("description").notNull().default(""),
    location: text("location"),
    // "nei", "hybrid" eller "helt".
    remote: text("remote").notNull().default("nei"),
    // "fulltid", "deltid", "internship", "sommerjobb", "trainee", "frilans".
    type: text("type").notNull().default("fulltid"),
    applyUrl: text("apply_url"),
    applyEmail: text("apply_email"),
    deadline: date("deadline"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    status: jobStatus("status").notNull().default("draft"),
    views: integer("views").notNull().default(0),
    applyClicks: integer("apply_clicks").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("job_company_idx").on(t.companyId, t.createdAt.desc()), index("job_list_idx").on(t.status, t.publishedAt.desc())],
);

// Kandidatlister for bedrifter (Bedrift-planen), f.eks. «Sommerjobb 2027».
export const talentList = pgTable(
  "talent_list",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("talent_list_company_idx").on(t.companyId)],
);

export const talentListMember = pgTable(
  "talent_list_member",
  {
    listId: uuid("list_id")
      .notNull()
      .references(() => talentList.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    note: text("note"),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.listId, t.userId] })],
);

/* -------------------------------------------------------------------------- */
/*  Utviklere: API-nøkler og webhooks                                         */
/* -------------------------------------------------------------------------- */

// Nøkler til det åpne API-et (/api/v1). Bare en hash lagres; selve nøkkelen vises én gang.
export const apiKey = pgTable(
  "api_key",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // De første tegnene, så brukeren kjenner igjen nøkkelen («vis_ab12…»).
    prefix: text("prefix").notNull(),
    keyHash: text("key_hash").notNull().unique(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("api_key_user_idx").on(t.userId)],
);

// Webhooks for bedrifter (Bedrift-planen): vi sender en POST når noe skjer med stillingene.
export const companyWebhook = pgTable(
  "company_webhook",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    // Brukes til å signere hver levering (Vis-Signature). Vises én gang når den lages.
    secret: text("secret").notNull(),
    events: jsonb("events").$type<string[]>().notNull().default([]),
    active: boolean("active").notNull().default(true),
    lastStatus: integer("last_status"),
    lastDeliveryAt: timestamp("last_delivery_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("company_webhook_company_idx").on(t.companyId)],
);

export const webhookDelivery = pgTable(
  "webhook_delivery",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    webhookId: uuid("webhook_id")
      .notNull()
      .references(() => companyWebhook.id, { onDelete: "cascade" }),
    event: text("event").notNull(),
    statusCode: integer("status_code"),
    ok: boolean("ok").notNull().default(false),
    attempts: integer("attempts").notNull().default(1),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [index("webhook_delivery_webhook_idx").on(t.webhookId, t.createdAt.desc())],
);
