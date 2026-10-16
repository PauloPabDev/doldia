CREATE TYPE "public"."habit_kind" AS ENUM('build', 'break');--> statement-breakpoint
CREATE TYPE "public"."log_status" AS ENUM('done', 'min', 'relapse', 'skip');--> statement-breakpoint
CREATE TYPE "public"."pact_role" AS ENUM('owner', 'member');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('private', 'pact', 'friends');--> statement-breakpoint
CREATE TABLE "achievements" (
	"code" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"icon" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"ip" text,
	"user_agent" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "habit_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"habit_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"status" "log_status" NOT NULL,
	"value" real,
	"note" text,
	"photo_url" text,
	"client_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "habits" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "habit_kind" NOT NULL,
	"identity" text NOT NULL,
	"title" text NOT NULL,
	"min_version" text,
	"cue_time" text,
	"cue_place" text,
	"stacked_on" uuid,
	"visibility" "visibility" DEFAULT 'pact' NOT NULL,
	"triggers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"substitute" text,
	"relapse_visibility" "visibility" DEFAULT 'private' NOT NULL,
	"savings_per_day" real,
	"savings_unit" text,
	"start_date" date NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"unique_key" text,
	"run_at" timestamp with time zone NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"locked_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"pushed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nudges" (
	"id" uuid PRIMARY KEY NOT NULL,
	"from_user" uuid NOT NULL,
	"to_user" uuid NOT NULL,
	"habit_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pact_habits" (
	"pact_id" uuid NOT NULL,
	"habit_id" uuid NOT NULL,
	CONSTRAINT "pact_habits_pact_id_habit_id_pk" PRIMARY KEY("pact_id","habit_id")
);
--> statement-breakpoint
CREATE TABLE "pact_members" (
	"pact_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "pact_role" DEFAULT 'member' NOT NULL,
	"invited_by" uuid,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pact_members_pact_id_user_id_pk" PRIMARY KEY("pact_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "pacts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"goal" text,
	"accent" text DEFAULT '#2F6F5E' NOT NULL,
	"monthly_target" integer DEFAULT 100 NOT NULL,
	"starts_at" date NOT NULL,
	"ends_at" date,
	"invite_code" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reactions" (
	"log_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reactions_log_id_user_id_emoji_pk" PRIMARY KEY("log_id","user_id","emoji")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"refresh_hash" text NOT NULL,
	"user_agent" text,
	"ip" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"rotated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "streaks" (
	"habit_id" uuid PRIMARY KEY NOT NULL,
	"current" integer DEFAULT 0 NOT NULL,
	"best" integer DEFAULT 0 NOT NULL,
	"freezes_left" integer DEFAULT 2 NOT NULL,
	"last_date" date
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"user_id" uuid NOT NULL,
	"code" text NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_achievements_user_id_code_pk" PRIMARY KEY("user_id","code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"timezone" text DEFAULT 'America/Bogota' NOT NULL,
	"quiet_start" text DEFAULT '22:00' NOT NULL,
	"quiet_end" text DEFAULT '07:00' NOT NULL,
	"notification_prefs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"onboarded" boolean DEFAULT false NOT NULL,
	"calm_mode" boolean DEFAULT false NOT NULL,
	"last_closed_date" date,
	"risk_notified_date" date,
	"weekly_summary_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xp_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"identity" text NOT NULL,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"ref_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_logs" ADD CONSTRAINT "habit_logs_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_logs" ADD CONSTRAINT "habit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habits" ADD CONSTRAINT "habits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nudges" ADD CONSTRAINT "nudges_from_user_users_id_fk" FOREIGN KEY ("from_user") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nudges" ADD CONSTRAINT "nudges_to_user_users_id_fk" FOREIGN KEY ("to_user") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nudges" ADD CONSTRAINT "nudges_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pact_habits" ADD CONSTRAINT "pact_habits_pact_id_pacts_id_fk" FOREIGN KEY ("pact_id") REFERENCES "public"."pacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pact_habits" ADD CONSTRAINT "pact_habits_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pact_members" ADD CONSTRAINT "pact_members_pact_id_pacts_id_fk" FOREIGN KEY ("pact_id") REFERENCES "public"."pacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pact_members" ADD CONSTRAINT "pact_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pacts" ADD CONSTRAINT "pacts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_log_id_habit_logs_id_fk" FOREIGN KEY ("log_id") REFERENCES "public"."habit_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streaks" ADD CONSTRAINT "streaks_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_code_achievements_code_fk" FOREIGN KEY ("code") REFERENCES "public"."achievements"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_user_idx" ON "audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "habit_logs_habit_date_key" ON "habit_logs" USING btree ("habit_id","local_date");--> statement-breakpoint
CREATE UNIQUE INDEX "habit_logs_client_key" ON "habit_logs" USING btree ("user_id","client_id");--> statement-breakpoint
CREATE INDEX "habit_logs_user_date_idx" ON "habit_logs" USING btree ("user_id","local_date");--> statement-breakpoint
CREATE INDEX "habits_user_idx" ON "habits" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_unique_key" ON "jobs" USING btree ("unique_key");--> statement-breakpoint
CREATE INDEX "jobs_run_at_idx" ON "jobs" USING btree ("run_at") WHERE "jobs"."locked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "notifications_user_read_idx" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE UNIQUE INDEX "nudges_once_per_day_key" ON "nudges" USING btree ("from_user","habit_id","local_date");--> statement-breakpoint
CREATE INDEX "pact_habits_habit_idx" ON "pact_habits" USING btree ("habit_id");--> statement-breakpoint
CREATE INDEX "pact_members_user_idx" ON "pact_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pacts_invite_code_key" ON "pacts" USING btree ("invite_code");--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_refresh_hash_key" ON "sessions" USING btree ("refresh_hash");--> statement-breakpoint
CREATE INDEX "sessions_family_idx" ON "sessions" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "xp_events_user_idx" ON "xp_events" USING btree ("user_id","identity");--> statement-breakpoint
CREATE UNIQUE INDEX "xp_events_ref_key" ON "xp_events" USING btree ("user_id","reason","ref_id");