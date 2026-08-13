import { createInsertSchema } from "drizzle-zod";
import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const usersTable = pgTable("zp_users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("officer"), // admin, ceo, reception, officer
  department: text("department"),
  active: boolean("active").notNull().default(true),
});

export const auditLogsTable = pgTable("zp_audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  username: text("username"),
  action: text("action").notNull(),
  details: text("details"),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogsTable).omit({
  id: true,
  timestamp: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
export type AuditLog = typeof auditLogsTable.$inferSelect;
