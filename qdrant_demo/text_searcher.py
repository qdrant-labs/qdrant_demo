import os
import re

from qdrant_client import QdrantClient, models
from qdrant_demo.config import (
    QDRANT_URL, QDRANT_API_KEY, TEXT_FIELD_NAME, SPARSE_EMBEDDINGS_MODEL,
    SPARSE_VECTOR_NAME, RESULT_LIMIT, CLOUD_INFERENCE,
)


class TextSearcher:
    """Keyword search over the bm25 sparse vector, ranked with IDF applied
    server-side. The previous version filtered on the payload text index, which
    only answers whether a document contains every term, then re-ranked that
    unordered subset by term frequency in Python."""

    def __init__(self, collection_name: str):
        self.highlight_field = TEXT_FIELD_NAME
        self.collection_name = collection_name
        timeout = int(os.environ.get("QDRANT_TIMEOUT", "60"))
        self.qdrant_client = QdrantClient(
            url=QDRANT_URL, api_key=QDRANT_API_KEY, prefer_grpc=True,
            cloud_inference=CLOUD_INFERENCE, timeout=timeout,
        )

    def highlight(self, record, query) -> dict:
        # Keep the original text intact; put the <b>-highlighted version in a
        # separate "highlight" field so the raw text stays usable (e.g. for
        # "find similar") and the UI can render bold matches for keyword search.
        text = record.get(self.highlight_field, "")

        for word in query.lower().split():
            if len(word) > 4:
                pattern = re.compile(fr"(\b{re.escape(word)}?.?\b)", flags=re.IGNORECASE)
            else:
                pattern = re.compile(fr"(\b{re.escape(word)}\b)", flags=re.IGNORECASE)
            text = re.sub(pattern, r"<b>\1</b>", text)

        record["highlight"] = text
        return record

    def search(self, query, top=RESULT_LIMIT):
        hits = self.qdrant_client.query_points(
            collection_name=self.collection_name,
            query=models.Document(text=query, model=SPARSE_EMBEDDINGS_MODEL),
            using=SPARSE_VECTOR_NAME,
            limit=top,
        ).points
        # bm25 scores are unbounded, unlike the cosine and RRF scores the other
        # modes return, so /api/search labels the scale as "bm25".
        return [{**self.highlight(hit.payload, query), "score": hit.score} for hit in hits]
