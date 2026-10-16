CREATE TABLE "account_guest_claims" (
	"account_id" text PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"preview_hash" text NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_selections" (
	"account_id" text PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_invites" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"created_by" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"uses" integer DEFAULT 0 NOT NULL,
	"max_uses" integer DEFAULT 10 NOT NULL,
	CONSTRAINT "household_invites_uses_check" CHECK ("household_invites"."uses" >= 0 and "household_invites"."max_uses" between 1 and 20)
);
--> statement-breakpoint
CREATE TABLE "household_members" (
	"account_id" text NOT NULL,
	"household_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "household_members_account_id_household_id_pk" PRIMARY KEY("account_id","household_id"),
	CONSTRAINT "household_members_role_check" CHECK ("household_members"."role" in ('owner','member'))
);
--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "is_guest" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "account_guest_claims" ADD CONSTRAINT "account_guest_claims_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_selections" ADD CONSTRAINT "account_selections_account_id_household_id_household_members_account_id_household_id_fk" FOREIGN KEY ("account_id","household_id") REFERENCES "public"."household_members"("account_id","household_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_invites" ADD CONSTRAINT "household_invites_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_guest_claims_household_idx" ON "account_guest_claims" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "household_members_household_idx" ON "household_members" USING btree ("household_id");