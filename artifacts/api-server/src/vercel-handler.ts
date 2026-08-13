import app from "./app";
import { seedDatabase } from "./lib/seed";

let seeded = false;

// Middleware to seed DB on first request  
app.use(async (req: any, res: any, next: any) => {
  if (!seeded) {
    try {
      await seedDatabase();
      seeded = true;
    } catch (err) {
      console.error("Failed to seed database:", err);
    }
  }
  next();
});

module.exports = app;
