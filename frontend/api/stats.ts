/**
 * GET /api/stats, the live collection size for the "N startups indexed" badge.
 */

const BASE = (process.env.QDRANT_URL ?? "").replace(/\/+$/, "");
const API_KEY = process.env.QDRANT_API_KEY ?? "";
const COLLECTION = process.env.COLLECTION_NAME || "startups_hybrid_v2";
const MODEL = process.env.EMBEDDINGS_MODEL || "mixedbread-ai/mxbai-embed-large-v1";

type Res = { status(code: number): Res; json(body: unknown): void };

export default async function handler(_req: unknown, res: Res) {
  try {
    const r = await fetch(`${BASE}/collections/${COLLECTION}/points/count`, {
      method: "POST",
      headers: { "api-key": API_KEY, "content-type": "application/json" },
      // Approximate: an exact count walks every segment, and this number only
      // feeds a rounded badge.
      body: JSON.stringify({ exact: false }),
    });
    const payload: any = await r.json();
    if (!r.ok || !payload.result) {
      throw new Error(payload?.status?.error ?? `Qdrant returned ${r.status}`);
    }
    res.status(200).json({
      count: payload.result.count,
      collection: COLLECTION,
      // Always true now: there is no local-embedding path left to fall back to.
      cloud_inference: true,
      model: MODEL,
    });
  } catch (err) {
    console.error("stats failed:", err);
    res.status(502).json({ detail: "Stats are temporarily unavailable." });
  }
}
