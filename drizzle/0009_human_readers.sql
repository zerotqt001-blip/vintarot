CREATE TABLE `readers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`bio` text NOT NULL,
	`timezone` text NOT NULL,
	`language` text NOT NULL,
	`duration` integer NOT NULL CHECK (`duration` >= 15 AND `duration` <= 120),
	`price` integer NOT NULL CHECK (`price` >= 0 AND `price` <= 100000000),
	`slots_json` text DEFAULT '[]' NOT NULL,
	`drive_image_url` text,
	`published` integer DEFAULT 0 NOT NULL CHECK (`published` IN (0, 1)),
	`created_by` text NOT NULL,
	`updated_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `readers_published_updated_idx` ON `readers` (`published`, `updated_at`, `id`);
--> statement-breakpoint
CREATE TABLE `reader_avatars` (
	`reader_id` text PRIMARY KEY NOT NULL REFERENCES `readers`(`id`) ON DELETE CASCADE,
	`bytes` blob NOT NULL,
	`content_type` text NOT NULL CHECK (`content_type` IN ('image/jpeg', 'image/png', 'image/webp')),
	`size_bytes` integer NOT NULL CHECK (`size_bytes` > 0 AND `size_bytes` <= 1900000),
	`updated_at` integer NOT NULL
);
