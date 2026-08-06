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
        # Generous timeout: the first Cloud-inference call after idle has to load
        # the model server-side, which can take longer than the default timeout.
        timeout = int(os.environ.get("QDRANT_TIMEOUT", "60"))
        self.qdrant_client = QdrantClient(
            url=QDRANT_URL, api_key=QDRANT_API_KEY,
            cloud_inference=CLOUD_INFERENCE, timeout=timeout,
        )

    # mxbai is an asymmetric retrieval model: the query gets a prompt prefix, the
    # stored documents do not, so applying it only here needs no re-indexing.
    # Note: Qdrant Cloud inference already applies this prompt server-side, so on
    # the Cloud path the prefix is a verified no-op (identical scores). It matters
    # for the self-hosted / local-embedding path, where nothing adds it otherwise.
    QUERY_PREFIX = "Represent this sentence for searching relevant passages: "

    def _dense(self, text: str):
        return models.Document(text=self.QUERY_PREFIX + text, model=EMBEDDINGS_MODEL)

    def _dense_only(self, text: str):
        return self.qdrant_client.query_points(
            collection_name=self.collection_name,
            query=self._dense(text),
            using=DENSE_VECTOR_NAME or None,
            limit=RESULT_LIMIT,
        ).points

    def search(self, text: str, hybrid: bool = False) -> dict:
        t0 = time.perf_counter()
        mode = "hybrid" if hybrid else "semantic"

        idx, val = to_sparse(text) if hybrid else ([], [])
        if hybrid and idx:
            hits = self.qdrant_client.query_points(
                collection_name=self.collection_name,
                prefetch=[
                    models.Prefetch(query=self._dense(text), using=DENSE_VECTOR_NAME or None, limit=HYBRID_PREFETCH),
                    models.Prefetch(
                        query=models.SparseVector(indices=idx, values=val),
                        using=SPARSE_VECTOR_NAME, limit=HYBRID_PREFETCH,
                    ),
                ],
                query=models.FusionQuery(fusion=models.Fusion.RRF),
                limit=RESULT_LIMIT,
            ).points
        else:
            # No usable keyword tokens (e.g. a stopword-only query) -> dense only.
            hits = self._dense_only(text)
            if hybrid:
                mode = "semantic"  # honestly report what actually ran

        latency_ms = round((time.perf_counter() - t0) * 1000)
        results = [{**hit.payload, "score": hit.score} for hit in hits]
        stats = {
            "mode": mode,
            "embedding_model": EMBEDDINGS_MODEL,
            # RRF fusion scores (~1/60) are not on the same scale as cosine (~0..1).
            "score_type": "rrf" if mode == "hybrid" else "cosine",
            "latency_ms": latency_ms,
            "results": len(results),
        }
        return {"results": results, "stats": stats}
