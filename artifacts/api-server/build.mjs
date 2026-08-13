import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import { rm } from "node:fs/promises";

globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

// Packages that cannot be bundled (native modules, etc.)
const external = [
  "*.node", "sharp", "better-sqlite3", "sqlite3", "canvas", "bcrypt",
  "argon2", "fsevents", "re2", "farmhash", "xxhash-addon", "bufferutil",
  "utf-8-validate", "ssh2", "cpu-features", "dtrace-provider", "isolated-vm",
  "lightningcss", "pg-native", "oracledb", "mongodb-client-encryption",
  "nodemailer", "handlebars", "knex", "typeorm", "protobufjs",
  "onnxruntime-node", "@tensorflow/*", "@prisma/client", "@mikro-orm/*",
  "@grpc/*", "@swc/*", "@aws-sdk/*", "@azure/*", "@opentelemetry/*",
  "@google-cloud/*", "@google/*", "googleapis", "firebase-admin",
  "@parcel/watcher", "@sentry/profiling-node", "@tree-sitter/*", "aws-sdk",
  "classic-level", "dd-trace", "ffi-napi", "grpc", "hiredis", "kerberos",
  "leveldown", "miniflare", "mysql2", "newrelic", "odbc", "piscina",
  "realm", "ref-napi", "rocksdb", "sass-embedded", "sequelize", "serialport",
  "snappy", "tinypool", "usb", "workerd", "wrangler", "zeromq",
  "zeromq-prebuilt", "playwright", "puppeteer", "puppeteer-core", "electron",
];

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  await rm(distDir, { recursive: true, force: true });

  // 1. Vercel Serverless: single self-contained CJS bundle
  //    Committed to git so Vercel serves it directly without re-compilation.
  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/vercel-handler.ts")],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: path.resolve(distDir, "vercel-handler.cjs"),
    external,
    logLevel: "info",
    sourcemap: false,
    // pino uses dynamic worker threads — inline them for CJS bundle
    define: {
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "production"),
    },
  });

  // 2. ESM build for local dev / Docker
  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    external,
    logLevel: "info",
    sourcemap: "linked",
    banner: {
      js: `import { createRequire as __cr } from 'node:module';
import __path from 'node:path';
import __url from 'node:url';
globalThis.require = __cr(import.meta.url);
globalThis.__filename = __url.fileURLToPath(import.meta.url);
globalThis.__dirname = __path.dirname(globalThis.__filename);`,
    },
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
