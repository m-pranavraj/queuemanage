import app from "./app";
import { seedDatabase } from "./lib/seed";

let seeded = false;

app.use(async (req: any, _res: any, next: any) => {
  if (!seeded) {
    try {
      await seedDatabase();
      seeded = true;
    } catch (err) {
      console.error("DB seed error:", err);
    }
  }
  next();
});

export default app;
