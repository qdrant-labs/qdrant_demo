# Semantic Search Engine

A small app that searches a list of startups by meaning.

[![Try it live](https://img.shields.io/badge/Try%20it%20live%20here!-purple?&style=flat-square&logo=react&logoColor=white)](https://demo.qdrant.tech/)

- **Neural search** reads each startup's description and finds similar ones.
- **Keyword search** matches your exact term in the description.

![Startup Search Demo](demo.gif)

## Run locally

Local runs use a throwaway Qdrant in Docker — no cloud account needed.

**Prerequisites:** Python 3.11, Docker

```bash
# 1. Environment
python -m venv .venv
source .venv/bin/activate

# 2. Dependencies
pip install poetry
poetry install

# 3. Dataset
wget https://storage.googleapis.com/generall-shared-data/startups_demo.json -P data/

# 4. Start Qdrant + the service
docker-compose -f docker-compose-local.yaml up

# 5. Load the data
python -m qdrant_demo.init_collection_startups
```

Then open [http://localhost:8000/](http://localhost:8000/).

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
| Qdrant | Vector database and search engine with full-text and semantic capabilities. |
| `mxbai-embed-large-v1` | The embedding model that turns startup data into vectors. |
| `Qdrant/bm25` | The sparse model behind keyword search. |
| Qdrant Cloud inference | Embeds the query server-side, so the app ships no local model. |
| React (Vite) | The frontend, styled with the Qdrant design system. |

| Component | |
|-|-|
| `init_collection_startups.py` | Loads startup data into a Qdrant collection (with a text index for keyword search). |
| `init_collection_crunchbase.py` | Same, for the larger Crunchbase dataset. |
| `neural_searcher.py` | Semantic search: embeds the query and returns the nearest startups. |
| `text_searcher.py` | Keyword search: full-text match on the `description` field. |
| `service.py` | FastAPI app exposing `GET /api/search?q&neural`, also serving the built frontend. |
| `config.py` | Reads env vars (Qdrant URL/key, collection, embeddings model). Text field defaults to `description`, overridable via `TEXT_FIELD_NAME`. |

## Deploy (Qdrant Cloud)

A deployed instance searches a **Qdrant Cloud** collection instead of a local one.
Load the collection first (the `init_collection_*` scripts above, pointed at your
cluster), then set these environment variables wherever you deploy:

| Variable | Value |
|-|-|
| `QDRANT_URL` | your Qdrant Cloud endpoint (`https://…:6333`) |
| `QDRANT_API_KEY` | your Qdrant Cloud API key |
| `COLLECTION_NAME` | the collection to search (e.g. `startups`) |

### Option A — one container (Railway or any Docker host)

The `Dockerfile` builds the React frontend and runs FastAPI serving it, so the
whole demo is a single service. On Railway: **New → Deploy from GitHub repo**,
pick this repo, add the variables above. The container binds `$PORT` automatically.

### Option B — frontend on Vercel, API on the container

To embed the demo behind a static link, host the UI on Vercel and keep the API on
the container from Option A:

1. Import this repo on Vercel with **Root Directory = `frontend`** (Vite is auto-detected).
2. Add one env var: `VITE_API_BASE` = the container's URL. The frontend then calls
   that API cross-origin; it defaults to same-origin, so Option A is unaffected.
