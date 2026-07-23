CREATE TABLE "dish_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"dish_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"amount" numeric(12, 3) NOT NULL,
	"unit" text NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	CONSTRAINT "dish_ingredients_amount_check" CHECK ("dish_ingredients"."amount" > 0),
	CONSTRAINT "dish_ingredients_unit_length_check" CHECK (char_length("dish_ingredients"."unit") between 1 and 20)
);
--> statement-breakpoint
CREATE TABLE "dishes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"meal_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"base_servings" integer DEFAULT 2 NOT NULL,
	"cooking_time" integer NOT NULL,
	"difficulty" text DEFAULT '简单' NOT NULL,
	"taste_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_cooked_at" timestamp with time zone,
	"favorite_level" integer DEFAULT 3 NOT NULL,
	"estimated_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"seasonal" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dishes_name_length_check" CHECK (char_length("dishes"."name") between 1 and 120),
	CONSTRAINT "dishes_servings_check" CHECK ("dishes"."base_servings" between 1 and 12),
	CONSTRAINT "dishes_time_check" CHECK ("dishes"."cooking_time" between 1 and 480),
	CONSTRAINT "dishes_favorite_check" CHECK ("dishes"."favorite_level" between 0 and 5),
	CONSTRAINT "dishes_cost_check" CHECK ("dishes"."estimated_cost" >= 0)
);
--> statement-breakpoint
CREATE TABLE "households" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instance_key" text DEFAULT 'default' NOT NULL,
	"data_epoch" uuid DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"passcode_hash" text NOT NULL,
	"default_people" integer DEFAULT 2 NOT NULL,
	"default_max_minutes" integer DEFAULT 30 NOT NULL,
	"default_taste" text DEFAULT '下饭' NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "households_singleton_check" CHECK ("households"."instance_key" = 'default'),
	CONSTRAINT "households_name_length_check" CHECK (char_length("households"."name") between 1 and 40),
	CONSTRAINT "households_people_check" CHECK ("households"."default_people" between 1 and 12),
	CONSTRAINT "households_minutes_check" CHECK ("households"."default_max_minutes" between 10 and 180)
);
--> statement-breakpoint
CREATE TABLE "ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"default_unit" text NOT NULL,
	"default_price" numeric(12, 4) DEFAULT '0' NOT NULL,
	"shelf_life_days" integer DEFAULT 7 NOT NULL,
	"season_months" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ingredients_name_length_check" CHECK (char_length("ingredients"."name") between 1 and 80),
	CONSTRAINT "ingredients_price_check" CHECK ("ingredients"."default_price" >= 0),
	CONSTRAINT "ingredients_shelf_life_check" CHECK ("ingredients"."shelf_life_days" between 0 and 3650)
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"amount" numeric(12, 3) NOT NULL,
	"unit" text NOT NULL,
	"bought_at" timestamp with time zone NOT NULL,
	"expire_at" timestamp with time zone NOT NULL,
	"location" text DEFAULT 'fridge' NOT NULL,
	"total_cost" numeric(12, 2),
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_amount_check" CHECK ("inventory_items"."amount" > 0),
	CONSTRAINT "inventory_location_check" CHECK ("inventory_items"."location" in ('fridge', 'freezer', 'pantry')),
	CONSTRAINT "inventory_cost_check" CHECK ("inventory_items"."total_cost" is null or "inventory_items"."total_cost" >= 0)
);
--> statement-breakpoint
CREATE TABLE "meal_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"dish_id" uuid,
	"meal_type" text NOT NULL,
	"action" text NOT NULL,
	"people" integer DEFAULT 2 NOT NULL,
	"dislike_tag" text,
	"dislike_expires_at" timestamp with time zone,
	"estimated_cost" numeric(12, 2),
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "decisions_meal_type_check" CHECK ("meal_decisions"."meal_type" in ('breakfast', 'lunch', 'dinner')),
	CONSTRAINT "decisions_action_check" CHECK ("meal_decisions"."action" in ('accept', 'dislike')),
	CONSTRAINT "decisions_people_check" CHECK ("meal_decisions"."people" between 1 and 12),
	CONSTRAINT "decisions_cost_check" CHECK ("meal_decisions"."estimated_cost" is null or "meal_decisions"."estimated_cost" >= 0)
);
--> statement-breakpoint
CREATE TABLE "mutation_receipts" (
	"id" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"response_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mutation_receipts_pk" PRIMARY KEY("household_id","id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"token_digest" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"amount" numeric(12, 3) NOT NULL,
	"unit" text NOT NULL,
	"checked" boolean DEFAULT false NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"actual_price" numeric(12, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shopping_amount_check" CHECK ("shopping_items"."amount" > 0),
	CONSTRAINT "shopping_source_check" CHECK ("shopping_items"."source" in ('manual', 'dish', 'plan')),
	CONSTRAINT "shopping_price_check" CHECK ("shopping_items"."actual_price" is null or "shopping_items"."actual_price" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "dishes_household_id_idx" ON "dishes" USING btree ("household_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "ingredients_household_id_idx" ON "ingredients" USING btree ("household_id","id");--> statement-breakpoint
ALTER TABLE "dish_ingredients" ADD CONSTRAINT "dish_ingredients_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish_ingredients" ADD CONSTRAINT "dish_ingredients_dish_household_fk" FOREIGN KEY ("household_id","dish_id") REFERENCES "public"."dishes"("household_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish_ingredients" ADD CONSTRAINT "dish_ingredients_ingredient_household_fk" FOREIGN KEY ("household_id","ingredient_id") REFERENCES "public"."ingredients"("household_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dishes" ADD CONSTRAINT "dishes_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_ingredient_household_fk" FOREIGN KEY ("household_id","ingredient_id") REFERENCES "public"."ingredients"("household_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_decisions" ADD CONSTRAINT "meal_decisions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_decisions" ADD CONSTRAINT "meal_decisions_dish_household_fk" FOREIGN KEY ("household_id","dish_id") REFERENCES "public"."dishes"("household_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mutation_receipts" ADD CONSTRAINT "mutation_receipts_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_ingredient_household_fk" FOREIGN KEY ("household_id","ingredient_id") REFERENCES "public"."ingredients"("household_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dish_ingredients_unique_idx" ON "dish_ingredients" USING btree ("household_id","dish_id","ingredient_id");--> statement-breakpoint
CREATE INDEX "dish_ingredients_dish_idx" ON "dish_ingredients" USING btree ("household_id","dish_id");--> statement-breakpoint
CREATE INDEX "dishes_household_enabled_idx" ON "dishes" USING btree ("household_id","enabled");--> statement-breakpoint
CREATE INDEX "dishes_household_last_cooked_idx" ON "dishes" USING btree ("household_id","last_cooked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "households_instance_key_idx" ON "households" USING btree ("instance_key");--> statement-breakpoint
CREATE UNIQUE INDEX "ingredients_household_name_idx" ON "ingredients" USING btree ("household_id","name");--> statement-breakpoint
CREATE INDEX "ingredients_household_category_idx" ON "ingredients" USING btree ("household_id","category");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_household_id_idx" ON "inventory_items" USING btree ("household_id","id");--> statement-breakpoint
CREATE INDEX "inventory_household_expire_idx" ON "inventory_items" USING btree ("household_id","expire_at");--> statement-breakpoint
CREATE INDEX "inventory_household_ingredient_idx" ON "inventory_items" USING btree ("household_id","ingredient_id");--> statement-breakpoint
CREATE INDEX "decisions_household_time_idx" ON "meal_decisions" USING btree ("household_id","decided_at");--> statement-breakpoint
CREATE INDEX "decisions_household_dish_idx" ON "meal_decisions" USING btree ("household_id","dish_id");--> statement-breakpoint
CREATE INDEX "mutation_receipts_household_created_idx" ON "mutation_receipts" USING btree ("household_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_digest_idx" ON "sessions" USING btree ("token_digest");--> statement-breakpoint
CREATE INDEX "sessions_household_idx" ON "sessions" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "sessions_expiry_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "shopping_household_id_idx" ON "shopping_items" USING btree ("household_id","id");--> statement-breakpoint
CREATE INDEX "shopping_household_checked_idx" ON "shopping_items" USING btree ("household_id","checked","created_at");--> statement-breakpoint
CREATE INDEX "shopping_household_ingredient_idx" ON "shopping_items" USING btree ("household_id","ingredient_id");
