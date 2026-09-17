CREATE TABLE `card_meanings` (
	`id` text PRIMARY KEY NOT NULL,
	`card_id` text NOT NULL,
	`locale` text NOT NULL,
	`orientation` text NOT NULL,
	`summary` text NOT NULL,
	`energy` text NOT NULL,
	`actions` text NOT NULL,
	`relationships` text NOT NULL,
	`work` text NOT NULL,
	`creativity` text NOT NULL,
	`home` text NOT NULL,
	`symbolism` text NOT NULL,
	`journal_questions` text NOT NULL,
	`keywords` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `tarot_cards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_card_meanings_variant` ON `card_meanings` (`card_id`,`locale`,`orientation`);--> statement-breakpoint
CREATE INDEX `idx_card_meanings_card_locale` ON `card_meanings` (`card_id`,`locale`);--> statement-breakpoint
CREATE TABLE `decks` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`artist` text NOT NULL,
	`description` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_decks_slug` ON `decks` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_decks_active` ON `decks` (`active`);--> statement-breakpoint
CREATE TABLE `reading_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`card_id` text NOT NULL,
	`spread_position_id` text NOT NULL,
	`position_key` text NOT NULL,
	`position_order` integer NOT NULL,
	`position_label` text NOT NULL,
	`orientation` text NOT NULL,
	`card_order` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `reading_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`card_id`) REFERENCES `tarot_cards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`spread_position_id`) REFERENCES `spread_positions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_reading_cards_session_order` ON `reading_cards` (`session_id`,`card_order`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_reading_cards_session_position` ON `reading_cards` (`session_id`,`spread_position_id`);--> statement-breakpoint
CREATE INDEX `idx_reading_cards_session` ON `reading_cards` (`session_id`);--> statement-breakpoint
CREATE TABLE `reading_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`guest_id` text,
	`question` text NOT NULL,
	`optional_context` text DEFAULT '' NOT NULL,
	`category_id` text NOT NULL,
	`spread_template_id` text NOT NULL,
	`spread_type` text NOT NULL,
	`card_count` integer NOT NULL,
	`locale` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `spread_categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`spread_template_id`) REFERENCES `spread_templates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_reading_sessions_user_created` ON `reading_sessions` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_reading_sessions_guest_created` ON `reading_sessions` (`guest_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `readings` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`opening` text NOT NULL,
	`card_readings` text NOT NULL,
	`synthesis` text NOT NULL,
	`advice` text NOT NULL,
	`closing` text NOT NULL,
	`disclaimer` text NOT NULL,
	`model_name` text NOT NULL,
	`prompt_version` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `reading_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_readings_session` ON `readings` (`session_id`);--> statement-breakpoint
CREATE TABLE `spread_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name_en` text NOT NULL,
	`name_vi` text NOT NULL,
	`description_en` text NOT NULL,
	`description_vi` text NOT NULL,
	`icon` text NOT NULL,
	`image_url` text,
	`display_order` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_spread_categories_slug` ON `spread_categories` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_spread_categories_active_order` ON `spread_categories` (`active`,`display_order`);--> statement-breakpoint
CREATE TABLE `spread_positions` (
	`id` text PRIMARY KEY NOT NULL,
	`spread_template_id` text NOT NULL,
	`position_key` text NOT NULL,
	`position_order` integer NOT NULL,
	`label_en` text NOT NULL,
	`label_vi` text NOT NULL,
	`description_en` text NOT NULL,
	`description_vi` text NOT NULL,
	`prompt_en` text NOT NULL,
	`prompt_vi` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`spread_template_id`) REFERENCES `spread_templates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_spread_positions_template_key` ON `spread_positions` (`spread_template_id`,`position_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_spread_positions_template_order` ON `spread_positions` (`spread_template_id`,`position_order`);--> statement-breakpoint
CREATE TABLE `spread_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text NOT NULL,
	`slug` text NOT NULL,
	`name_en` text NOT NULL,
	`name_vi` text NOT NULL,
	`description_en` text NOT NULL,
	`description_vi` text NOT NULL,
	`card_count` integer NOT NULL,
	`spread_type` text NOT NULL,
	`display_order` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `spread_categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_spread_templates_category_slug` ON `spread_templates` (`category_id`,`slug`);--> statement-breakpoint
CREATE INDEX `idx_spread_templates_category_order` ON `spread_templates` (`category_id`,`active`,`display_order`);--> statement-breakpoint
CREATE TABLE `tarot_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`deck_id` text NOT NULL,
	`card_number` integer NOT NULL,
	`slug` text NOT NULL,
	`name_en` text NOT NULL,
	`name_vi` text NOT NULL,
	`arcana` text NOT NULL,
	`suit` text NOT NULL,
	`image_url` text NOT NULL,
	`display_order` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`deck_id`) REFERENCES `decks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tarot_cards_deck_number` ON `tarot_cards` (`deck_id`,`card_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tarot_cards_deck_slug` ON `tarot_cards` (`deck_id`,`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tarot_cards_deck_order` ON `tarot_cards` (`deck_id`,`display_order`);--> statement-breakpoint
CREATE INDEX `idx_tarot_cards_deck` ON `tarot_cards` (`deck_id`);