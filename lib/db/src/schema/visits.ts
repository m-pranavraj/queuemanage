import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  date,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const visitsTable = pgTable("zp_visits", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  fullName: text("full_name").notNull(),
  mobile: text("mobile").notNull(),
  taluka: text("taluka").notNull(),
  location: text("location").notNull(),
  organisation: text("organisation"),
  purpose: text("purpose").notNull(),
  category: text("category").notNull(),
  department: text("department").notNull(),
  description: text("description").notNull(),
  previouslyApproached: boolean("previously_approached").notNull().default(false),
  previousDepartment: text("previous_department"),
  previousDate: date("previous_date"),
  previousReference: text("previous_reference"),
  visitType: text("visit_type").notNull(),
  visitDate: date("visit_date").notNull(),
  appointmentDate: date("appointment_date"),
  appointmentSlot: text("appointment_slot"),
  appointmentDuration: integer("appointment_duration").notNull().default(5),
  priority: text("priority").notNull().default("normal"),
  status: text("status").notNull().default("waiting"),
  queuePosition: integer("queue_position").notNull().default(1),
  estimatedWait: integer("estimated_wait").notNull().default(0),
  registeredAt: timestamp("registered_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  outcome: text("outcome"),
  referredTo: text("referred_to"),
  referenceNumber: text("reference_number"),
  notes: text("notes"),
  followUpDate: date("follow_up_date"),
  previousVisits: integer("previous_visits").notNull().default(0),
  meetingStartedAt: timestamp("meeting_started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const insertVisitSchema = createInsertSchema(visitsTable).omit({
  id: true,
  token: true,
  registeredAt: true,
  meetingStartedAt: true,
  completedAt: true,
});

export type InsertVisit = z.infer<typeof insertVisitSchema>;
export type Visit = typeof visitsTable.$inferSelect;