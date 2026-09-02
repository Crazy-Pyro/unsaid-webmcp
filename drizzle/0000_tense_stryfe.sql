PRAGMA foreign_keys = ON;--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`actor_kind` text NOT NULL,
	`actor_public_label` text,
	`event_type` text NOT NULL,
	`public_summary` text NOT NULL,
	`payload_json` text,
	`origin` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `audit_room_time_idx` ON `audit_events` (`room_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `ballots` (
	`room_id` text NOT NULL,
	`participant_id` text NOT NULL,
	`candidate_id` text NOT NULL,
	`stance` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`room_id`, `participant_id`, `candidate_id`),
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ballots_room_candidate_idx` ON `ballots` (`room_id`,`candidate_id`);--> statement-breakpoint
CREATE TABLE `candidates` (
	`room_id` text NOT NULL,
	`id` text NOT NULL,
	`base_candidate_id` text,
	`title` text NOT NULL,
	`source_kind` text NOT NULL,
	`day` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`cost_per_person` integer NOT NULL,
	`travel_minutes` integer NOT NULL,
	`setting` text NOT NULL,
	`accessibility` text NOT NULL,
	`format` text NOT NULL,
	`proposed_by_participant_id` text,
	`change_count` integer DEFAULT 0 NOT NULL,
	`changes_json` text DEFAULT '[]' NOT NULL,
	`proposal_fingerprint` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	`is_locked` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`room_id`, `id`),
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `candidates_room_idx` ON `candidates` (`room_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `candidates_room_proposal_idx` ON `candidates` (`room_id`,`proposal_fingerprint`);--> statement-breakpoint
CREATE TABLE `coordination_signals` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`participant_id` text NOT NULL,
	`field` text NOT NULL,
	`operator` text NOT NULL,
	`value_json` text NOT NULL,
	`public_fingerprint` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `signals_room_idx` ON `coordination_signals` (`room_id`);--> statement-breakpoint
CREATE INDEX `signals_room_fingerprint_idx` ON `coordination_signals` (`room_id`,`public_fingerprint`);--> statement-breakpoint
CREATE TABLE `mutation_receipts` (
	`request_id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`participant_id` text NOT NULL,
	`response_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `receipts_room_idx` ON `mutation_receipts` (`room_id`);--> statement-breakpoint
CREATE TABLE `participants` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`display_name` text NOT NULL,
	`actor_kind` text NOT NULL,
	`token_hash` text,
	`is_host` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'joined' NOT NULL,
	`joined_at` text NOT NULL,
	`last_seen_at` text,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `participants_room_idx` ON `participants` (`room_id`);--> statement-breakpoint
CREATE TABLE `ratifications` (
	`room_id` text NOT NULL,
	`participant_id` text NOT NULL,
	`candidate_id` text NOT NULL,
	`decision` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`room_id`, `participant_id`, `candidate_id`),
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`decision_question` text NOT NULL,
	`title` text NOT NULL,
	`phase` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`last_mutation_id` text,
	`nominated_candidate_id` text,
	`demo_mode` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`agreed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rooms_slug_idx` ON `rooms` (`slug`);
--> statement-breakpoint
PRAGMA optimize;
