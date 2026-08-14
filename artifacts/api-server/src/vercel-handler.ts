import app from "./app";
import { seedDatabase } from "./lib/seed";

// Run seed immediately on cold start (module load), not as middleware.
// The exported handler waits for this before processing any request.
const seedReady: Promise<void> = seedDatabase().catch((err) => {
  console.error("DB seed error on startup:", err);
});

// Wrap the Express app so first request waits for seed to complete.
const handler = async (req: any, res: any) => {
  await seedReady;
  return app(req, res);
};

export default handler;
