// Ranking and latency parity against the Railway backend this replaces.
//
//   node test/parity.mjs
//
// Needs QDRANT_URL and QDRANT_API_KEY. LIVE points at the old backend; set it
// empty to only check that the new one answers.
//
// Latency here is measured from a laptop, so both numbers carry the same WAN
// round trip and only the comparison between them means anything. The real
// numbers come from the deployment, in the same region as the cluster.
const LIVE = process.env.LIVE ?? "https://qdrant-startup-search-production.up.railway.app";

const handler = (await import("../frontend/api/search.ts")).default;

async function local(q, mode) {
  const out = {};
  const res = {
    status(code) {
      out.code = code;
      return this;
    },
    json(body) {
      out.body = body;
    },
  };
  const started = Date.now();
  await handler({ query: { q, mode } }, res);
  return { ...out, ms: Date.now() - started };
}

async function old(q, mode) {
  const started = Date.now();
  const r = await fetch(`${LIVE}/api/search?q=${encodeURIComponent(q)}&mode=${mode}`);
  return { code: r.status, body: await r.json(), ms: Date.now() - started };
}

const QUERIES = [
  "machine learning for medical imaging",
  "food delivery",
  "online payments",
  "carbon capture",
  "social network for pets",
  "drone logistics",
  "sustainable fashion marketplace",
  "developer tools for kubernetes",
];
const MODES = ["semantic", "keyword", "hybrid"];

const names = (r) => (r.body?.result ?? []).map((x) => x.name);
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

let failures = 0;
const timings = { local: [], old: [] };

for (const mode of MODES) {
  for (const q of QUERIES) {
    const n = await local(q, mode);
    if (n.code !== 200 || names(n).length === 0) {
      console.log(`FAIL ${mode} ${JSON.stringify(q)} -> ${n.code} ${JSON.stringify(n.body).slice(0, 120)}`);
      failures++;
      continue;
    }
    timings.local.push(n.ms);

    let verdict = `${names(n).length} results, ${n.ms}ms`;
    if (LIVE) {
      const o = await old(q, mode);
      timings.old.push(o.ms);
      const got = names(n);
      const want = names(o);
      const identical = JSON.stringify(got) === JSON.stringify(want);
      const shared = got.filter((x) => want.includes(x)).length;
      verdict += ` | old ${o.ms}ms | ${identical ? "identical order" : `${shared}/${want.length} shared`}`;
      if (!identical && shared < want.length) {
        verdict += "  <-- CHECK";
        failures++;
      }
    }
    console.log(`${mode.padEnd(9)} ${JSON.stringify(q).padEnd(42)} ${verdict}`);
  }
}

if (LIVE) {
  console.log(`\nmedian: new ${median(timings.local)}ms, old ${median(timings.old)}ms`);
}
console.log(failures === 0 ? "all good" : `${failures} difference(s) to look at`);
process.exit(failures === 0 ? 0 : 1);
