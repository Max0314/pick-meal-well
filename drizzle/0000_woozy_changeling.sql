CREATE TABLE `dish_ingredients` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`dish_id` text NOT NULL,
	`ingredient_id` text NOT NULL,
	`amount` real NOT NULL,
	`unit` text NOT NULL,
	`required` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`dish_id`) REFERENCES `dishes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `dish_ingredients_dish_idx` ON `dish_ingredients` (`household_id`,`dish_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `dish_ingredients_unique_idx` ON `dish_ingredients` (`dish_id`,`ingredient_id`);--> statement-breakpoint
CREATE TABLE `dishes` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`meal_types` text DEFAULT '[]' NOT NULL,
	`cooking_time` integer NOT NULL,
	`difficulty` text DEFAULT '简单' NOT NULL,
	`taste_tags` text DEFAULT '[]' NOT NULL,
	`last_cooked_at` text,
	`favorite_level` integer DEFAULT 3 NOT NULL,
	`estimated_cost` real DEFAULT 0 NOT NULL,
	`seasonal` integer DEFAULT false NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`steps` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `dishes_household_enabled_idx` ON `dishes` (`household_id`,`enabled`);--> statement-breakpoint
CREATE INDEX `dishes_household_last_cooked_idx` ON `dishes` (`household_id`,`last_cooked_at`);--> statement-breakpoint
CREATE TABLE `households` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`passcode_digest` text NOT NULL,
	`passcode_salt` text NOT NULL,
	`default_people` integer DEFAULT 2 NOT NULL,
	`default_max_minutes` integer DEFAULT 30 NOT NULL,
	`default_taste` text DEFAULT '下饭' NOT NULL,
	`failed_attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ingredients` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`default_unit` text NOT NULL,
	`default_price` real DEFAULT 0 NOT NULL,
	`shelf_life_days` integer DEFAULT 7 NOT NULL,
	`season_months` text DEFAULT '[]' NOT NULL,
	`aliases` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ingredients_household_category_idx` ON `ingredients` (`household_id`,`category`);--> statement-breakpoint
CREATE UNIQUE INDEX `ingredients_household_name_idx` ON `ingredients` (`household_id`,`name`);--> statement-breakpoint
CREATE TABLE `inventory_items` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`ingredient_id` text NOT NULL,
	`amount` real NOT NULL,
	`unit` text NOT NULL,
	`bought_at` text NOT NULL,
	`expire_at` text NOT NULL,
	`location` text DEFAULT 'fridge' NOT NULL,
	`total_cost` real,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `inventory_household_expire_idx` ON `inventory_items` (`household_id`,`expire_at`);--> statement-breakpoint
CREATE INDEX `inventory_household_ingredient_idx` ON `inventory_items` (`household_id`,`ingredient_id`);--> statement-breakpoint
CREATE TABLE `meal_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`dish_id` text,
	`meal_type` text NOT NULL,
	`action` text NOT NULL,
	`dislike_tag` text,
	`dislike_expires_at` text,
	`estimated_cost` real,
	`decided_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`dish_id`) REFERENCES `dishes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `decisions_household_time_idx` ON `meal_decisions` (`household_id`,`decided_at`);--> statement-breakpoint
CREATE INDEX `decisions_household_dish_idx` ON `meal_decisions` (`household_id`,`dish_id`);--> statement-breakpoint
CREATE TABLE `mutation_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`response_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mutation_receipts_household_idx` ON `mutation_receipts` (`household_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`token_digest` text NOT NULL,
	`expires_at` text NOT NULL,
	`last_used_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_digest_idx` ON `sessions` (`token_digest`);--> statement-breakpoint
CREATE INDEX `sessions_household_idx` ON `sessions` (`household_id`);--> statement-breakpoint
CREATE TABLE `shopping_items` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`ingredient_id` text NOT NULL,
	`amount` real NOT NULL,
	`unit` text NOT NULL,
	`checked` integer DEFAULT false NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`actual_price` real,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `shopping_household_checked_idx` ON `shopping_items` (`household_id`,`checked`);--> statement-breakpoint
CREATE INDEX `shopping_household_ingredient_idx` ON `shopping_items` (`household_id`,`ingredient_id`);