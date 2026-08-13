// .cjs extension = always CommonJS, regardless of any package.json "type": "module"
// Requires the pre-built self-contained CJS bundle — no ESM boundary crossed.
module.exports = require('../artifacts/api-server/dist/vercel-handler.cjs');
