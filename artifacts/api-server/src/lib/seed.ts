import { db, usersTable, appointmentSlotsTable, visitsTable } from "@workspace/db";
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

    // 3. Seed mock visits if empty
    const existingVisits = await db.select().from(visitsTable).limit(1);
    if (existingVisits.length === 0) {
      console.log("Seeding mock visits for testing...");
      const todayStr = new Date().toISOString().slice(0, 10);
      
      await db.insert(visitsTable).values([
        {
          token: "VVIP-001",
          fullName: "MLA Satish Chandra",
          mobile: "9876543210",
          taluka: "Baramati",
          location: "Malegaon",
          organisation: "Government of Maharashtra",
          purpose: "Rural Water Supply Project Approval",
          category: "Proposal / Partnership",
          department: "Water & Sanitation",
          description: "Requesting budget clearance and administrative approval for the new Baramati canal pipeline connection.",
          previouslyApproached: true,
          previousDepartment: "Finance",
          previousDate: todayStr,
          visitType: "walk_in",
          visitDate: todayStr,
          priority: "vvip",
          status: "called",
          queuePosition: 1,
          estimatedWait: 0,
        },
        {
          token: "CEO-001",
          fullName: "Rajesh Shinde",
          mobile: "9881234567",
          taluka: "Haveli",
          location: "Wagholi",
          purpose: "Water Supply Line Repair",
          category: "Water / Sanitation",
          department: "Water & Sanitation",
          description: "Wagholi main distribution line has been leaking for past 3 days causing heavy water loss.",
          previouslyApproached: false,
          visitType: "walk_in",
          visitDate: todayStr,
          priority: "priority",
          status: "waiting",
          queuePosition: 2,
          estimatedWait: 15,
        },
        {
          token: "CEO-002",
          fullName: "Sunita Deshmukh",
          mobile: "9552123456",
          taluka: "Khed",
          location: "Chakan",
          purpose: "Rural School Infrastructure Funds",
          category: "Education",
          department: "Education",
          description: "Application for funding replacement desks and roof repairs at Chakan Primary ZP School.",
          previouslyApproached: true,
          previousDepartment: "Rural Development",
          previousDate: todayStr,
          visitType: "walk_in",
          visitDate: todayStr,
          priority: "normal",
          status: "waiting",
          queuePosition: 3,
          estimatedWait: 20,
        },
        {
          token: "CEO-003",
          fullName: "Anand Joshi",
          mobile: "9422001122",
          taluka: "Shirur",
          location: "Ranjangaon",
          purpose: "Agricultural Subsidy Query",
          category: "Agriculture",
          department: "Agriculture",
          description: "Seeking clarification on delayed solar pump installation subsidies under the state scheme.",
          previouslyApproached: false,
          visitType: "walk_in",
          visitDate: todayStr,
          priority: "normal",
          status: "waiting",
          queuePosition: 4,
          estimatedWait: 25,
        },
        {
          token: "CEO-004",
          fullName: "Meera Kulkarni",
          mobile: "9123456789",
          taluka: "Purandar",
          location: "Jejuri",
          purpose: "Asha Worker Scheme Reimbursement",
          category: "Health",
          department: "Health",
          description: "Reimbursement claims pending for village health survey supplies distribution.",
          previouslyApproached: false,
          visitType: "walk_in",
          visitDate: todayStr,
          priority: "normal",
          status: "completed",
          queuePosition: 0,
          estimatedWait: 0,
          outcome: "resolved",
          notes: "Approved reimbursement. File sent to accounts desk.",
        }
      ]);
      console.log("Seeding mock visits completed successfully.");
    }
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}
