ALTER TABLE "households" DROP CONSTRAINT "households_singleton_check";--> statement-breakpoint
DROP INDEX "households_instance_key_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "households_name_idx" ON "households" USING btree ("name");