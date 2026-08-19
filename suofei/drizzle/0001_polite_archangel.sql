CREATE INDEX `idx_game_rooms_updated_at` ON `game_rooms` (`updated_at`);
--> statement-breakpoint
PRAGMA optimize;
