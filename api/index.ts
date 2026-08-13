import app from "../artifacts/api-server/src/app";
import { seedDatabase } from "../artifacts/api-server/src/lib/seed";

let seeded = false;

// Middleware to ensure DB is seeded on first request
(app as any).use(async (req: any, res: any, next: any) => {
  if (!seeded) {
    try {
      await seedDatabase();
      seeded = true;
    } catch (err) {
      console.error("Failed to seed database in serverless function:", err);
    }
  }
  next();
});

export default app;
