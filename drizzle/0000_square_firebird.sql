CREATE TABLE `studio_articles` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`owner_name` text NOT NULL,
	`content` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);
