// Root package.json has NO "type":"module" → this file is CommonJS.
// .cjs extension on the bundle forces CJS regardless of any parent package.json.
// CJS → CJS: no ESM boundary, no ERR_REQUIRE_ESM possible.
module.exports = require('../artifacts/api-server/dist/vercel-handler.cjs');
