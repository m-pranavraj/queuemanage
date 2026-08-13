import { createInsertSchema } from "drizzle-zod";
import { boolean, integer, pgTable, serial, text } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const appointmentSlotsTable = pgTable("zp_appointment_slots", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  capacity: integer("capacity").notNull(),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const insertAppointmentSlotSchema = createInsertSchema(appointmentSlotsTable).omit({
  id: true,
});

export type InsertAppointmentSlot = z.infer<typeof insertAppointmentSlotSchema>;
export type AppointmentSlot = typeof appointmentSlotsTable.$inferSelect;