let appPromise: Promise<any> | null = null;
let seeded = false;

async function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      // Dynamically import the ES modules at runtime
      const { default: appInstance } = await import(
        "../artifacts/api-server/src/app"
      );
      const { seedDatabase } = await import(
        "../artifacts/api-server/src/lib/seed"
      );

      // Middleware to ensure DB is seeded on first request
      appInstance.use(async (req: any, res: any, next: any) => {
        if (!seeded) {
          try {
            await seedDatabase();
            seeded = true;
          } catch (err) {
            console.error(
              "Failed to seed database in serverless function:",
              err,
            );
          }
        }
        next();
      });

      return appInstance;
    })();
  }
  return appPromise;
}

export default async function handler(req: any, res: any) {
  try {
    const appInstance = await getApp();
    return appInstance(req, res);
  } catch (err: any) {
    console.error("Serverless wrapper execution error:", err);
    res
      .status(500)
      .json({ error: "Internal Server Error", message: err.message });
  }
}
