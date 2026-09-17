/**
 * GET /api/search?q=&mode=semantic|keyword|hybrid
 *
 * Replaces the FastAPI service that ran on Railway. That service already
 * embedded queries with Qdrant Cloud Inference, so it carried no model runtime:
 * its whole job was turning a query string into one Qdrant request. That fits in
 * a serverless function with no dependencies, which is what lets Railway go.
 *
 * Search behaviour, the response shape and the env var names are unchanged.
 */

const BASE = (process.env.QDRANT_URL ?? "").replace(/\/+$/, "");
const API_KEY = process.env.QDRANT_API_KEY ?? "";

const COLLECTION = process.env.COLLECTION_NAME || "startups_hybrid_v2";
const DENSE_MODEL = process.env.EMBEDDINGS_MODEL || "mixedbread-ai/mxbai-embed-large-v1";
const SPARSE_MODEL = process.env.SPARSE_EMBEDDINGS_MODEL || "Qdrant/bm25";
const DENSE_VECTOR = process.env.DENSE_VECTOR_NAME ?? "dense";
const SPARSE_VECTOR = process.env.SPARSE_VECTOR_NAME ?? "sparse";
const TEXT_FIELD = process.env.TEXT_FIELD_NAME || "document";
const RESULT_LIMIT = Number(process.env.RESULT_LIMIT ?? 20);
const HYBRID_PREFETCH = Number(process.env.HYBRID_PREFETCH ?? 200);
const TIMEOUT_MS = Number(process.env.QDRANT_TIMEOUT ?? 15) * 1000;

// mxbai is asymmetric: the query gets a prompt prefix, the stored documents do
// not. Cloud Inference applies this server-side already, so it is a no-op here;
// it is kept so the query text matches what the Python sent, byte for byte.
const QUERY_PREFIX = "Represent this sentence for searching relevant passages: ";

type Point = { score: number; payload: Record<string, unknown> };

async function query(body: unknown): Promise<Point[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/collections/${COLLECTION}/points/query`, {
      method: "POST",
      headers: { "api-key": API_KEY, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload: any = await res.json();
    if (!res.ok || !payload.result) {
      throw new Error(payload?.status?.error ?? `Qdrant returned ${res.status}`);
    }
    return payload.result.points;
  } finally {
    clearTimeout(timer);
  }
}

const dense = (text: string) => ({ text: QUERY_PREFIX + text, model: DENSE_MODEL });
const sparse = (text: string) => ({ text, model: SPARSE_MODEL });

/**
 * Wrap each query term in <b> tags.
 *
 * Ported from TextSearcher.highlight as-is, including the loose `?.?` stem match
 * on words over four characters, which is why a match can swallow the character
 * after it ("<b>online </b>"). Changing that would change what the demo looks
 * like, so it stays.
 */
export function highlight(text: string, q: string): string {
  for (const word of q.toLowerCase().split(/\s+/).filter(Boolean)) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = word.length > 4 ? `(\\b${escaped}?.?\\b)` : `(\\b${escaped}\\b)`;
    text = text.replace(new RegExp(pattern, "gi"), "<b>$1</b>");
  }
  return text;
}

type Req = { query: Record<string, string | string[] | undefined> };
type Res = { status(code: number): Res; json(body: unknown): void };

export default async function handler(req: Req, res: Res) {
  const q = String(req.query.q ?? "");
  // Back-compat with the older frontend, which passed `neural` (bool) rather
  // than a mode. Explicit `mode` always wins. Anything unrecognised falls
  // through to semantic, which is what the Python did too.
  const neural = req.query.neural;
  const mode =
    String(req.query.mode ?? "") ||
    (neural === "true" ? "semantic" : neural === "false" ? "keyword" : "hybrid");

  if (!q.trim()) {
    res.status(200).json({ result: [], stats: { mode } });
    return;
  }

  try {
    let points: Point[];
    let scoreType: string;
    let model = DENSE_MODEL;

    if (mode === "keyword") {
      points = await query({
        query: sparse(q),
        using: SPARSE_VECTOR,
        limit: RESULT_LIMIT,
        with_payload: true,
      });
      // bm25 scores are unbounded, unlike the cosine and RRF scores the other
      // modes return, so the scale is labelled for the client.
      scoreType = "bm25";
      model = SPARSE_MODEL;
      // The original text stays intact; the bolded copy goes in its own field so
      // "find similar" still has something clean to send.
      for (const p of points) {
        p.payload.highlight = highlight(String(p.payload[TEXT_FIELD] ?? ""), q);
      }
    } else if (mode === "hybrid") {
      points = await query({
        prefetch: [
          { query: dense(q), using: DENSE_VECTOR || null, limit: HYBRID_PREFETCH },
          { query: sparse(q), using: SPARSE_VECTOR, limit: HYBRID_PREFETCH },
        ],
        query: { fusion: "rrf" },
        limit: RESULT_LIMIT,
        with_payload: true,
      });
      // RRF fusion scores (~1/60) are not on the same scale as cosine (~0..1).
      scoreType = "rrf";
    } else {
      points = await query({
        query: dense(q),
        using: DENSE_VECTOR || null,
        limit: RESULT_LIMIT,
        with_payload: true,
      });
      scoreType = "cosine";
    }

    const result = points.map((p) => ({ ...p.payload, score: p.score }));
    res.status(200).json({
      result,
      stats: {
        mode: mode === "keyword" ? "keyword" : mode === "hybrid" ? "hybrid" : "semantic",
        embedding_model: model,
        score_type: scoreType,
        results: result.length,
      },
    });
  } catch (err) {
    console.error(`search failed for q=${JSON.stringify(q)} mode=${mode}:`, err);
    res.status(502).json({ detail: "Search is temporarily unavailable." });
  }
}
