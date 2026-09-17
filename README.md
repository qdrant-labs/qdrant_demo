# Semantic Search Engine

A small app that searches a list of startups by meaning.

[![Try it live](https://img.shields.io/badge/Try%20it%20live%20here!-purple?&style=flat-square&logo=react&logoColor=white)](https://demo.qdrant.tech/)

- **Semantic search** reads each startup's description and finds similar ones.
- **Keyword search** matches your terms with BM25.
- **Hybrid** runs both and fuses the two rankings.

![Startup Search Demo](demo.gif)

## Two services, not three

The demo runs on **Vercel** and **Qdrant Cloud**, and nothing else.

Queries are embedded inside the cluster by **Qdrant Cloud Inference**, so there
is no model to load and no Python process to host. What used to be a FastAPI
container on Railway is now two serverless functions that post JSON to Qdrant:
[`frontend/api/search.ts`](frontend/api/search.ts) and
[`frontend/api/stats.ts`](frontend/api/stats.ts). Between them they have no
dependencies.

The indexing scripts are still Python, because they run once, by hand.

## Run locally

**Prerequisites:** Node 20+, a Qdrant Cloud cluster with Cloud Inference
enabled, and Python 3.11 only if you want to load the data yourself.

Querying needs Cloud Inference, so a local Qdrant in Docker cannot serve this
demo: nothing would embed the query.

```bash
# 1. Point at your cluster
cp .env.example .env    # then fill in QDRANT_URL and QDRANT_API_KEY

# 2. Run the frontend and the functions together
npm i -g vercel
cd frontend && vercel dev
```

To load the data first:

```bash
python -m venv .venv && source .venv/bin/activate
pip install poetry && poetry install
wget https://storage.googleapis.com/generall-shared-data/startups_demo.json -P data/
python -m qdrant_demo.init_collection_startups
```

### Larger dataset (Crunchbase)

To index a bigger set of companies, get a [Crunchbase](https://www.crunchbase.com/) API key, then:

```bash
wget 'https://api.crunchbase.com/odm/v4/odm.tar.gz?user_key=<CRUNCHBASE-API-KEY>' -O odm.tar.gz
tar -xvf odm.tar.gz
mv odm/organizations.csv ./data
python -m qdrant_demo.init_collection_crunchbase
```

## What's inside

| Software stack | |
|-|-|
| Qdrant | Vector search engine holding the collection. |
| Qdrant Cloud Inference | Embeds the query inside the cluster, so the app ships no model. |
| `mxbai-embed-large-v1` | The dense model. 1024 dimensions. |
| `Qdrant/bm25` | The sparse model behind keyword search. Computed in-engine, so it bills no inference tokens. |
| React (Vite) on Vercel | The frontend, styled with the Qdrant design system. |

| Component | |
|-|-|
| `frontend/api/search.ts` | `GET /api/search?q=&mode=semantic\|keyword\|hybrid`. The whole backend. |
| `frontend/api/stats.ts` | `GET /api/stats` — collection size for the scale badge. |
| `init_collection_startups.py` | Loads startup data into a Qdrant collection. |
| `init_collection_crunchbase.py` | Same, for the larger Crunchbase dataset. |
| `config.py` | Env vars shared by the indexing scripts. |

## How a search works

One request to Qdrant per search, whatever the mode.

Hybrid sends two `prefetch` legs, dense and sparse, and fuses them server-side
with reciprocal rank fusion. That needs a **Qdrant server at 1.10 or newer**, and
Cloud Inference switched on: a 1.19 cluster with inference off still cannot embed
the query.

Keyword search ranks on the BM25 sparse vector rather than filtering the payload
text, so results come back ordered instead of as an unordered subset.

## Measured against the backend it replaces

40 queries, 3 modes, 3 repetitions each, both backends called from the same
machine and interleaved so neither gets the warmer socket. `test/compare.mjs`
re-runs it.

Latency, milliseconds:

| mode | p50 | p95 | mean | old p50 | old p95 | old mean |
|-|-|-|-|-|-|-|
| semantic | 124 | 198 | 133 | 275 | 370 | 294 |
| keyword | 29 | 79 | 42 | 189 | 273 | 203 |
| hybrid | 152 | 277 | 168 | 283 | 391 | 299 |

The old path was laptop to Railway to Qdrant. The new one is laptop to Qdrant.
The difference is the hop that was removed, and nothing else: both call the same
cluster with the same query. Keyword gains most because BM25 is computed in the
engine, so almost all of its old 189ms was the container in the middle.

Results, over the same 40 queries:

| mode | same 20 documents | same order | largest score difference |
|-|-|-|-|
| semantic | 40/40 | 38/40 | 0.00023 |
| keyword | 40/40 | 40/40 | 0 |
| hybrid | 40/40 | 20/40 | 0.064 |

Keyword is exact. Semantic differs only in the fifth decimal, which is float32
rounding between the gRPC client the old backend used and this one's JSON.

Hybrid ordering looks unstable until you measure the control: **asked the same
question twice, the old backend returned a different order 21 times out of 40,
and so did this one.** Old matched new 20/40, which is as close as either
backend gets to matching itself. The variance is approximate search over three
million points, not the port.

## Deploy

Load the collection first, then import this repo on Vercel with
**Root Directory = `frontend`**. The functions live in `frontend/api`, so they
deploy from the same root the Vite build already uses.

| Variable | Value |
|-|-|
| `QDRANT_URL` | your Qdrant Cloud endpoint (`https://…:6333`) |
| `QDRANT_API_KEY` | your Qdrant Cloud API key |
| `COLLECTION_NAME` | the collection to search. Defaults to `startups_hybrid_v2`. |

`VITE_API_BASE` must be **unset**. It pointed the frontend at the old Railway
API; empty means same-origin, which is where the functions now are.

## Checks

```bash
node --test test/highlight.test.mjs   # keyword highlighting matches the Python it replaces
node test/parity.mjs                  # rankings and latency against a reference backend
node --env-file=.env test/serve.mjs   # the built frontend and both functions on one port
node --env-file=.env test/compare.mjs # the latency and ranking table above
```
