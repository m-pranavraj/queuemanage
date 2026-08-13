import { db, usersTable, appointmentSlotsTable } from "@workspace/db";
import { hashPassword } from "./auth-utils";

export async function seedDatabase() {
  try {
    // 1. Seed users if empty
    const existingUsers = await db.select().from(usersTable).limit(1);
    if (existingUsers.length === 0) {
      console.log("Seeding default user accounts...");
      await db.insert(usersTable).values([
        {
          username: "admin",
          passwordHash: hashPassword("admin123"),
          fullName: "System Administrator",
          role: "admin",
          active: true,
        },
        {
          username: "ceo",
          passwordHash: hashPassword("ceo123"),
          fullName: "ZP CEO / IAS Officer",
          role: "ceo",
          active: true,
        },
        {
          username: "reception",
          passwordHash: hashPassword("reception123"),
          fullName: "Desk PA / Receptionist",
          role: "reception",
          active: true,
        },
        {
          username: "officer",
          passwordHash: hashPassword("officer123"),
          fullName: "General Department Officer",
          role: "officer",
          active: true,
        },
      ]);
      console.log("Seeding users completed successfully.");
    }

    // 2. Seed slots if empty
    const existingSlots = await db.select().from(appointmentSlotsTable).limit(1);
    if (existingSlots.length === 0) {
      console.log("Seeding 5-minute appointment slots...");
      const slotsData = [];
      const startTime = new Date();
      startTime.setHours(10, 0, 0, 0); // 10:00 AM

      for (let i = 0; i < 24; i++) {
        const timeStr = startTime.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
        slotsData.push({
          label: timeStr,
          capacity: 1, // Max 1 meeting at a time per 5 min slot
          active: true,
          sortOrder: i + 1,
        });
        startTime.setMinutes(startTime.getMinutes() + 5); // Add 5 minutes
      }

      await db.insert(appointmentSlotsTable).values(slotsData);
      console.log("Seeding 5-minute slots completed successfully.");
    }
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}
