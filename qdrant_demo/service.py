import os

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from qdrant_demo.config import COLLECTION_NAME, STATIC_DIR, RESULT_LIMIT
from qdrant_demo.neural_searcher import NeuralSearcher
from qdrant_demo.text_searcher import TextSearcher

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

neural_searcher = NeuralSearcher(collection_name=COLLECTION_NAME)
text_searcher = TextSearcher(collection_name=COLLECTION_NAME)


@app.get("/api/search")
async def read_item(q: str, mode: str = "hybrid"):
    """mode = semantic (dense) | keyword (full-text) | hybrid (dense + keyword)."""
    if not q.strip():
        return {"result": [], "stats": {"mode": mode}}
    if mode == "keyword":
        return {"result": text_searcher.search(query=q, top=RESULT_LIMIT), "stats": {"mode": "keyword"}}
    out = neural_searcher.search(text=q, hybrid=(mode == "hybrid"))
    return {"result": out["results"], "stats": out["stats"]}


@app.get("/api/stats")
async def stats():
    """Live collection size, so the frontend can show off the scale."""
    try:
        count = neural_searcher.qdrant_client.count(COLLECTION_NAME).count
        return {"count": count, "collection": COLLECTION_NAME}
    except Exception as e:
        return {"count": None, "error": f"{type(e).__name__}: {str(e)[:120]}"}


# Mount the static files directory once the search endpoint is defined
if os.path.exists(STATIC_DIR):
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True))

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
