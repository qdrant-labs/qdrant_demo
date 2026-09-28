// Latency, scores and ranking, new backend against the Railway one.
//
//   node --env-file=.env test/compare.mjs
//
// Both backends are called from this machine, interleaved, so the same network
// conditions apply to each. The new path is laptop -> Qdrant; the old path is
// laptop -> Railway -> Qdrant. The difference between them is the extra hop,
// which is the thing being removed. Absolute numbers will be lower once this
// runs on Vercel in the same region as the cluster.
const OLD = process.env.OLD ?? "https://qdrant-startup-search-production.up.railway.app";
const REPS = Number(process.env.REPS ?? 3);

const handler = (await import("../frontend/api/search.ts")).default;

async function callNew(q, mode) {
  const out = {};
  const res = {
    status(c) {
      out.code = c;
      return this;
    },
    json(b) {
      out.body = b;
    },
  };
  const t = Date.now();
  await handler({ query: { q, mode } }, res);
  return { ...out, ms: Date.now() - t };
}

async function callOld(q, mode) {
  const t = Date.now();
  const r = await fetch(`${OLD}/api/search?q=${encodeURIComponent(q)}&mode=${mode}`);
  return { code: r.status, body: await r.json(), ms: Date.now() - t };
}

const QUERIES = [
  "machine learning for medical imaging", "food delivery", "online payments",
  "carbon capture", "social network for pets", "drone logistics",
  "sustainable fashion marketplace", "developer tools for kubernetes",
  "peer to peer lending", "electric vehicle charging", "language learning app",
  "cybersecurity for small business", "vertical farming", "telemedicine",
  "podcast discovery", "warehouse robotics", "legal document automation",
  "mental health therapy platform", "supply chain visibility", "3d printing",
  "fraud detection", "recruitment marketplace", "solar panel installation",
  "music streaming for artists", "fleet management", "insurance claims",
  "personal finance budgeting", "video game streaming", "clinical trials",
  "satellite imagery analytics", "restaurant point of sale", "home cleaning services",
  "crypto wallet", "no code website builder", "b2b marketplace for steel",
  "childcare booking", "hotel revenue management", "agricultural drones",
  "employee wellness", "real estate investment platform",
];
const MODES = ["semantic", "keyword", "hybrid"];

const pct = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const rows = (r) => r.body?.result ?? [];
const names = (r) => rows(r).map((x) => x.name);

// Warm up both paths: the first call pays a TLS handshake that would otherwise
// land in the numbers.
for (let i = 0; i < 3; i++) {
  await callNew("warmup", "hybrid");
  await callOld("warmup", "hybrid");
}

const report = {};

for (const mode of MODES) {
  const ms = { neu: [], old: [] };
  let identical = 0;
  let overlapSum = 0;
  let pairs = 0;
  let maxScoreDelta = 0;
  let scoreCompared = 0;
  let worstQuery = null;

  for (const q of QUERIES) {
    let n, o;
    for (let r = 0; r < REPS; r++) {
      // Interleaved, and alternating which goes first, so neither backend
      // consistently eats the cost of being the one that warms the socket.
      if (r % 2 === 0) {
        n = await callNew(q, mode);
        o = await callOld(q, mode);
      } else {
        o = await callOld(q, mode);
        n = await callNew(q, mode);
      }
      if (n.code !== 200 || o.code !== 200) {
        console.log(`  error ${mode} ${JSON.stringify(q)}: new ${n.code}, old ${o.code}`);
        continue;
      }
      ms.neu.push(n.ms);
      ms.old.push(o.ms);
    }
    if (!n?.body || !o?.body) continue;

    const a = names(n);
    const b = names(o);
    pairs++;
    if (JSON.stringify(a) === JSON.stringify(b)) identical++;
    overlapSum += a.filter((x) => b.includes(x)).length / Math.max(1, b.length);

    // Same document, same score? Keyed on name, which is unique enough here.
    const oldScore = new Map(rows(o).map((x) => [x.name, x.score]));
    for (const row of rows(n)) {
      if (!oldScore.has(row.name)) continue;
      const d = Math.abs(row.score - oldScore.get(row.name));
      scoreCompared++;
      if (d > maxScoreDelta) {
        maxScoreDelta = d;
        worstQuery = `${q} / ${row.name}`;
      }
    }
  }

  report[mode] = {
    n: ms.neu.length,
    new: { p50: pct(ms.neu, 50), p95: pct(ms.neu, 95), mean: Math.round(mean(ms.neu)) },
    old: { p50: pct(ms.old, 50), p95: pct(ms.old, 95), mean: Math.round(mean(ms.old)) },
    identicalOrder: `${identical}/${pairs}`,
    meanOverlap: (overlapSum / pairs).toFixed(3),
    maxScoreDelta,
    scoreCompared,
    worstQuery,
  };
  console.log(`${mode} done`);
}

console.log("\n=== latency, ms (measured from this machine) ===");
console.log("mode      n     new p50  new p95  new mean | old p50  old p95  old mean");
for (const [mode, r] of Object.entries(report)) {
  const f = (x) => String(x).padStart(7);
  console.log(
    `${mode.padEnd(9)} ${String(r.n).padStart(4)}  ${f(r.new.p50)}  ${f(r.new.p95)}  ${f(r.new.mean)} |` +
      ` ${f(r.old.p50)}  ${f(r.old.p95)}  ${f(r.old.mean)}`,
  );
}

console.log("\n=== results and scores ===");
console.log("mode      identical order  mean overlap@20  max |score delta|  (of n scores)");
for (const [mode, r] of Object.entries(report)) {
  console.log(
    `${mode.padEnd(9)} ${r.identicalOrder.padStart(15)}  ${String(r.meanOverlap).padStart(15)}` +
      `  ${r.maxScoreDelta.toExponential(2).padStart(17)}  (${r.scoreCompared})`,
  );
}
for (const [mode, r] of Object.entries(report)) {
  if (r.maxScoreDelta > 0) console.log(`largest ${mode} score gap: ${r.worstQuery}`);
}
