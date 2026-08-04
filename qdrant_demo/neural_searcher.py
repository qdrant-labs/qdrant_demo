import os
import time

from qdrant_client import QdrantClient, models

from qdrant_demo.config import (
    QDRANT_URL, QDRANT_API_KEY, EMBEDDINGS_MODEL,
    DENSE_VECTOR_NAME, SPARSE_VECTOR_NAME, RESULT_LIMIT, HYBRID_PREFETCH,
    CLOUD_INFERENCE,
)
from qdrant_demo.sparse import to_sparse


class NeuralSearcher:
    """Dense (semantic) and hybrid (dense + keyword, fused with RRF) search over a
    collection with a named dense vector and a sparse keyword vector."""

    def __init__(self, collection_name: str):
        self.collection_name = collection_name
        self.qdrant_client = QdrantClient(
            url=QDRANT_URL, api_key=QDRANT_API_KEY, cloud_inference=CLOUD_INFERENCE
        )

    def _dense(self, text: str):
        return models.Document(text=text, model=EMBEDDINGS_MODEL)

    def search(self, text: str, hybrid: bool = False) -> dict:
        using = DENSE_VECTOR_NAME or None
        t0 = time.perf_counter()

        if hybrid:
            idx, val = to_sparse(text)
            hits = self.qdrant_client.query_points(
                collection_name=self.collection_name,
                prefetch=[
                    models.Prefetch(query=self._dense(text), using=using, limit=HYBRID_PREFETCH),
                    models.Prefetch(
                        query=models.SparseVector(indices=idx, values=val),
                        using=SPARSE_VECTOR_NAME, limit=HYBRID_PREFETCH,
                    ),
                ],
                query=models.FusionQuery(fusion=models.Fusion.RRF),
                limit=RESULT_LIMIT,
            ).points
        else:
            hits = self.qdrant_client.query_points(
                collection_name=self.collection_name,
                query=self._dense(text),
                using=using,
                limit=RESULT_LIMIT,
            ).points

        latency_ms = round((time.perf_counter() - t0) * 1000)
        results = [{**hit.payload, "score": hit.score} for hit in hits]
        stats = {
            "mode": "hybrid" if hybrid else "semantic",
            "embedding_model": EMBEDDINGS_MODEL,
            "latency_ms": latency_ms,
            "results": len(results),
        }
        return {"results": results, "stats": stats}
