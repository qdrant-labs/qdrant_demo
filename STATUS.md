# Status — Startup Search (qdrant_demo)

**Front end:** Qdrant-styled UI, wired to `GET /api/search?q&neural` (Semantic vs
Keyword). Builds via the existing Dockerfile.
**Back end:** original, unchanged. Modern qdrant-client, Qdrant-Cloud-ready.

## Closest to running. To finish:
1. Put the dataset at `data/startups_demo.json` (the standard Qdrant startups
   demo file — the same one the upstream repo uses).
2. Set env: `QDRANT_URL`, `QDRANT_API_KEY`, `COLLECTION_NAME`.
3. Load it: `python -m qdrant_demo.init_collection_startups` (embeds with
   fastembed all-MiniLM-L6-v2 and uploads).
4. Deploy on Render (New → Blueprint), instance ≥ 2 GB RAM.

Verified: frontend builds clean. Not verified against a live collection.
