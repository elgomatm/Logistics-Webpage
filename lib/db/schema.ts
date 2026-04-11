import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  date,
  jsonb,
  pgEnum,
  index,
  doublePrecision,
  primaryKey,
} from "drizzle-orm/pg-core";

// ============================================================================
// ENUMS
// ============================================================================

export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "logistics",
  "media",
  "viewer",
]);

export const inviteStatusEnum = pgEnum("invite_status", [
  "pending",
  "used",
  "revoked",
  "expired",
]);

export const eventStatusEnum = pgEnum("event_status", [
  "tentative",
  "planning",
  "wrapped",
  "closed",
  "postponed",
  "cancelled",
]);

export const taskProgressEnum = pgEnum("task_progress", [
  "not_started",
  "in_progress",
  "needs_review",
  "done",
]);

export const taskPriorityEnum = pgEnum("task_priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);

export const reportStatusEnum = pgEnum("report_status", [
  "draft",
  "published",
  "archived",
]);

export const guideStatusEnum = pgEnum("guide_status", [
  "draft",
  "published",
  "archived",
]);

export const consentActionEnum = pgEnum("consent_action", [
  "granted",
  "revoked",
  "deleted",
]);

// ============================================================================
// USERS & AUTH (NextAuth-compatible with custom fields from PM tool)
// ============================================================================

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified"),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),

  // Custom fields (from PM tool)
  role: userRoleEnum("role").notNull().default("viewer"),
  avatarColor: text("avatar_color").notNull().default("#3b82f6"),
  active: boolean("active").notNull().default(true),
});

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refreshToken: text("refresh_token"),
    accessToken: text("access_token"),
    expiresAt: integer("expires_at"),
    tokenType: text("token_type"),
    scope: text("scope"),
    idToken: text("id_token"),
    sessionState: text("session_state"),
  },
  (t) => ({
    userIdx: index("accounts_user_idx").on(t.userId),
  }),
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    sessionToken: text("session_token").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires").notNull(),
  },
  (t) => ({
    userIdx: index("sessions_user_idx").on(t.userId),
  }),
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull().unique(),
    expires: timestamp("expires").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.identifier, t.token] }),
  }),
);

// ============================================================================
// INVITES (from PM tool — token-based team onboarding)
// ============================================================================

export const invites = pgTable(
  "invites",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: userRoleEnum("role").notNull(),
    status: inviteStatusEnum("status").notNull().default("pending"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    usedByUserId: text("used_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (t) => ({
    tokenIdx: index("invites_token_idx").on(t.token),
    statusIdx: index("invites_status_idx").on(t.status),
  }),
);

// ============================================================================
// ACTIVITY LOG
// ============================================================================

export const activityLog = pgTable(
  "activity_log",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    action: text("action").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("activity_log_user_idx").on(t.userId),
    entityIdx: index("activity_log_entity_idx").on(t.entityType, t.entityId),
    createdIdx: index("activity_log_created_idx").on(t.createdAt),
  }),
);

// ============================================================================
// EVENTS
// ============================================================================

export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),

    // When
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),

    // Where
    venueName: text("venue_name"),
    venueCity: text("venue_city"),

    // Parametric flags (task template engine reads these)
    totalCars: integer("total_cars"),
    totalPeople: integer("total_people"),
    isDynamic: boolean("is_dynamic").notNull().default(false),
    hasPublicElement: boolean("has_public_element").notNull().default(false),
    isRepeat: boolean("is_repeat").notNull().default(false),
    isLocal: boolean("is_local").notNull().default(true),

    // Lifecycle
    status: eventStatusEnum("status").notNull().default("planning"),

    // Audit
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    slugIdx: index("events_slug_idx").on(t.slug),
    statusIdx: index("events_status_idx").on(t.status),
    startDateIdx: index("events_start_date_idx").on(t.startDate),
  }),
);

// ============================================================================
// TASKS SYSTEM (from PM tool)
// ============================================================================

export const taskBuckets = pgTable(
  "task_buckets",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    position: doublePrecision("position").notNull(),
    color: text("color").notNull().default("#64748b"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    positionIdx: index("task_buckets_position_idx").on(t.position),
  }),
);

export const tasks = pgTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    bucketId: text("bucket_id")
      .notNull()
      .references(() => taskBuckets.id, { onDelete: "restrict" }),

    name: text("name").notNull(),
    description: text("description"),

    progress: taskProgressEnum("progress").notNull().default("not_started"),
    priority: taskPriorityEnum("priority").notNull().default("medium"),

    reviewerId: text("reviewer_id").references(() => users.id, {
      onDelete: "set null",
    }),

    // Scheduling
    plannedStartDate: date("planned_start_date"),
    dueDate: date("due_date"),

    // Lifecycle timestamps
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),

    // Time tracking
    estimatedSeconds: integer("estimated_seconds"),
    totalSecondsLogged: integer("total_seconds_logged").notNull().default(0),
    activeTimerStartedAt: timestamp("active_timer_started_at"),

    // Drag-reorder position within bucket
    position: doublePrecision("position").notNull(),

    // Soft delete
    archivedAt: timestamp("archived_at"),

    // Audit
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    eventIdx: index("tasks_event_idx").on(t.eventId),
    bucketIdx: index("tasks_bucket_idx").on(t.bucketId),
    bucketPositionIdx: index("tasks_bucket_position_idx").on(
      t.bucketId,
      t.position,
    ),
    reviewerIdx: index("tasks_reviewer_idx").on(t.reviewerId),
    progressIdx: index("tasks_progress_idx").on(t.progress),
    dueDateIdx: index("tasks_due_date_idx").on(t.dueDate),
    archivedIdx: index("tasks_archived_idx").on(t.archivedAt),
  }),
);

export const taskAssignees = pgTable(
  "task_assignees",
  {
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at").notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.taskId, t.userId] }),
    taskIdx: index("task_assignees_task_idx").on(t.taskId),
    userIdx: index("task_assignees_user_idx").on(t.userId),
  }),
);

export const taskChecklistItems = pgTable(
  "task_checklist_items",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    isDone: boolean("is_done").notNull().default(false),
    position: doublePrecision("position").notNull(),
    doneAt: timestamp("done_at"),
    doneByUserId: text("done_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    taskIdx: index("task_checklist_items_task_idx").on(t.taskId),
    taskPositionIdx: index("task_checklist_items_task_position_idx").on(
      t.taskId,
      t.position,
    ),
  }),
);

export const taskDependencies = pgTable(
  "task_dependencies",
  {
    blockerTaskId: text("blocker_task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    blockedTaskId: text("blocked_task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.blockerTaskId, t.blockedTaskId] }),
    blockerIdx: index("task_deps_blocker_idx").on(t.blockerTaskId),
    blockedIdx: index("task_deps_blocked_idx").on(t.blockedTaskId),
  }),
);

export const taskPauseReasons = pgTable(
  "task_pause_reasons",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    position: doublePrecision("position").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    activeIdx: index("task_pause_reasons_active_idx").on(t.active),
  }),
);

export const timeEntries = pgTable(
  "time_entries",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    startedAt: timestamp("started_at").notNull(),
    endedAt: timestamp("ended_at"),
    durationSeconds: integer("duration_seconds"),
    pauseReasonId: text("pause_reason_id").references(
      () => taskPauseReasons.id,
      { onDelete: "set null" },
    ),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    taskIdx: index("time_entries_task_idx").on(t.taskId),
    userIdx: index("time_entries_user_idx").on(t.userId),
    openIdx: index("time_entries_open_idx").on(t.taskId, t.endedAt),
  }),
);

// ============================================================================
// PARTNERS & REPORTS (new — web platform)
// ============================================================================

export const partners = pgTable(
  "partners",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    logoUrl: text("logo_url"),
    website: text("website"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => ({
    slugIdx: index("partners_slug_idx").on(t.slug),
  }),
);

export const eventPartners = pgTable(
  "event_partners",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    partnerId: text("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    introBody: text("intro_body"),
    relationshipType: text("relationship_type"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.eventId, t.partnerId] }),
    eventIdx: index("event_partners_event_idx").on(t.eventId),
    partnerIdx: index("event_partners_partner_idx").on(t.partnerId),
  }),
);

export const reports = pgTable(
  "reports",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    partnerId: text("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    status: reportStatusEnum("status").notNull().default("draft"),
    publishedAt: timestamp("published_at"),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => ({
    eventIdx: index("reports_event_idx").on(t.eventId),
    partnerIdx: index("reports_partner_idx").on(t.partnerId),
    slugIdx: index("reports_slug_idx").on(t.slug),
    statusIdx: index("reports_status_idx").on(t.status),
  }),
);

export const guides = pgTable(
  "guides",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    status: guideStatusEnum("status").notNull().default("draft"),
    publishedAt: timestamp("published_at"),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => ({
    eventIdx: index("guides_event_idx").on(t.eventId),
    slugIdx: index("guides_slug_idx").on(t.slug),
    statusIdx: index("guides_status_idx").on(t.status),
  }),
);

export const media = pgTable(
  "media",
  {
    id: text("id").primaryKey(),
    blobUrl: text("blob_url").notNull(),
    alt: text("alt"),
    contentType: text("content_type"),
    sizeBytes: integer("size_bytes"),
    uploadedBy: text("uploaded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
);

// ============================================================================
// COMPLIANCE — PII handling for guests
// ============================================================================

export const guests = pgTable(
  "guests",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    emailHash: text("email_hash"),
    encryptedEmail: text("encrypted_email"),
    exoticCar: text("exotic_car"),
    consentGrantedAt: timestamp("consent_granted_at"),
    consentSource: text("consent_source"),
    deletionRequestedAt: timestamp("deletion_requested_at"),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => ({
    eventIdx: index("guests_event_idx").on(t.eventId),
    emailHashIdx: index("guests_email_hash_idx").on(t.emailHash),
  }),
);

export const consentLog = pgTable(
  "consent_log",
  {
    id: text("id").primaryKey(),
    guestId: text("guest_id")
      .notNull()
      .references(() => guests.id, { onDelete: "cascade" }),
    action: consentActionEnum("action").notNull(),
    ipAddress: text("ip_address"),
    timestamp: timestamp("timestamp").notNull().defaultNow(),
  },
  (t) => ({
    guestIdx: index("consent_log_guest_idx").on(t.guestId),
  }),
);

// ============================================================================
// MAGIC LINK TOKENS (for partner portal auth — Phase 6)
// ============================================================================

export const magicLinkTokens = pgTable(
  "magic_link_tokens",
  {
    id: text("id").primaryKey(),
    tokenHash: text("token_hash").notNull().unique(),
    email: text("email").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
  },
);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Invite = typeof invites.$inferSelect;
export type NewInvite = typeof invites.$inferInsert;
export type ActivityLogEntry = typeof activityLog.$inferSelect;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type EventStatus = Event["status"];
export type TaskBucket = typeof taskBuckets.$inferSelect;
export type NewTaskBucket = typeof taskBuckets.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type TaskProgress = Task["progress"];
export type TaskPriority = Task["priority"];
export type TaskAssignee = typeof taskAssignees.$inferSelect;
export type TaskChecklistItem = typeof taskChecklistItems.$inferSelect;
export type TaskDependency = typeof taskDependencies.$inferSelect;
export type TaskPauseReason = typeof taskPauseReasons.$inferSelect;
export type TimeEntry = typeof timeEntries.$inferSelect;
export type Partner = typeof partners.$inferSelect;
export type NewPartner = typeof partners.$inferInsert;
export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
export type Guide = typeof guides.$inferSelect;
export type NewGuide = typeof guides.$inferInsert;
export type Guest = typeof guests.$inferSelect;
export type MediaAsset = typeof media.$inferSelect;
