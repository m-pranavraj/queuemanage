// @vercel/node compiles this file as CommonJS.
// Dynamic import() is fully supported in CJS and can load ESM packages at runtime.

let appPromise: Promise<any> | null = null;
let seeded = false;

function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      const [{ default: app }, { seedDatabase }] = await Promise.all([
        import("../artifacts/api-server/src/app"),
        import("../artifacts/api-server/src/lib/seed"),
      ]);

      app.use(async (req: any, res: any, next: any) => {
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

      return app;
    })();
  }
  return appPromise;
}

module.exports = async (req: any, res: any) => {
  const app = await getApp();
  return app(req, res);
};
