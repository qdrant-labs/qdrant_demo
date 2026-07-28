import os
import re

from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchText
from qdrant_demo.config import QDRANT_URL, QDRANT_API_KEY, TEXT_FIELD_NAME


class TextSearcher:
    def __init__(self, collection_name: str):
        self.highlight_field = TEXT_FIELD_NAME
        self.collection_name = collection_name
        self.qdrant_client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)

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

    def _relevance(self, payload, terms) -> int:
        """Simple relevance score: term hits in the name count more than in the
        description, so results most about the query rank first."""
        name = (payload.get("name") or "").lower()
        text = (payload.get(self.highlight_field) or "").lower()
        score = 0
        for term in terms:
            score += len(re.findall(rf"\b{re.escape(term)}", name)) * 3
            score += len(re.findall(rf"\b{re.escape(term)}", text))
        return score

    def search(self, query, top=10):
        # Full-text match is a filter (no relevance score), so over-fetch a pool
        # of matches and rank them ourselves by term frequency.
        pool, _next_page = self.qdrant_client.scroll(
            collection_name=self.collection_name,
            scroll_filter=Filter(
                must=[
                    FieldCondition(
                        key=TEXT_FIELD_NAME,
                        match=MatchText(text=query),
                    )
                ]),
            with_payload=True,
            with_vectors=False,
            limit=max(top, 256),
        )
        terms = re.findall(r"\w+", query.lower())
        ranked = sorted(pool, key=lambda hit: self._relevance(hit.payload, terms), reverse=True)
        return [self.highlight(hit.payload, query) for hit in ranked[:top]]
