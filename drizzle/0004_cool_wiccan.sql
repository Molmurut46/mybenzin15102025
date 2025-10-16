CREATE TABLE `report_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`template_name` text,
	`header_text` text,
	`header_font_size` integer DEFAULT 14,
	`header_font_family` text DEFAULT 'Times New Roman',
	`header_alignment` text DEFAULT 'center',
	`table_font_size` integer DEFAULT 11,
	`table_font_family` text DEFAULT 'Times New Roman',
	`column_widths` text,
	`row_height` integer DEFAULT 30,
	`margin_top` real DEFAULT 0.75,
	`margin_bottom` real DEFAULT 0.75,
	`margin_left` real DEFAULT 0.7,
	`margin_right` real DEFAULT 0.7,
	`show_borders` integer DEFAULT true,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `report_templates_user_id_unique` ON `report_templates` (`user_id`);