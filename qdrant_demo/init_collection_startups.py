"""Build the startups collection the search path expects: a named `dense` vector
(mxbai) plus a `sparse` keyword vector with IDF, and a text index for keyword
search. Documents are embedded with no prefix (mxbai is asymmetric; the query
prefix is added at search time), so the same text drives dense, sparse, and
keyword. Run:  python -m qdrant_demo.init_collection_startups
"""
import json
import os
from typing import Iterable

from qdrant_client import QdrantClient, models
from fastembed import TextEmbedding
from tqdm import tqdm

from qdrant_demo.config import (
    DATA_DIR, QDRANT_URL, QDRANT_API_KEY, COLLECTION_NAME, TEXT_FIELD_NAME,
    EMBEDDINGS_MODEL, DENSE_VECTOR_NAME, SPARSE_VECTOR_NAME,
)
from qdrant_demo.sparse import to_sparse

DENSE_DIM = 1024  # mxbai-embed-large-v1


def _records() -> Iterable[dict]:
    path = os.path.join(DATA_DIR, "startups_demo.json")
    with open(path, encoding="utf-8") as fd:
        for line in fd:
            line = line.strip()
            if line:
                yield json.loads(line)


def _doc_text(obj: dict) -> str:
    # Same text the searcher will match against: name + description.
    return f"{obj.get('name', '')}. {obj.get(TEXT_FIELD_NAME) or obj.get('description', '')}".strip()


def build():
    client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
    embedder = TextEmbedding(EMBEDDINGS_MODEL)  # local dense embedding for ingest

    if client.collection_exists(COLLECTION_NAME):
        print(f"{COLLECTION_NAME} exists, recreating.")
        client.delete_collection(COLLECTION_NAME)

    client.create_collection(
        COLLECTION_NAME,
        vectors_config={
            DENSE_VECTOR_NAME: models.VectorParams(
                size=DENSE_DIM, distance=models.Distance.COSINE, on_disk=True,
            )
        },
        sparse_vectors_config={
            # IDF is applied at query time; sparse values carry term frequency only.
            SPARSE_VECTOR_NAME: models.SparseVectorParams(modifier=models.Modifier.IDF)
        },
        quantization_config=models.ScalarQuantization(
            scalar=models.ScalarQuantizationConfig(
                type=models.ScalarType.INT8, quantile=0.99, always_ram=True,
            )
        ),
    )
    client.create_payload_index(
        COLLECTION_NAME, field_name=TEXT_FIELD_NAME,
        field_schema=models.TextIndexParams(
            type=models.TextIndexType.TEXT, tokenizer=models.TokenizerType.WORD,
            min_token_len=2, max_token_len=20, lowercase=True,
        ),
    )

    def points() -> Iterable[models.PointStruct]:
        for idx, obj in enumerate(_records()):
            text = _doc_text(obj)
            dense = next(iter(embedder.embed([text]))).tolist()
            s_idx, s_val = to_sparse(text)
            yield models.PointStruct(
                id=idx,
                vector={
                    DENSE_VECTOR_NAME: dense,
                    SPARSE_VECTOR_NAME: models.SparseVector(indices=s_idx, values=s_val),
                },
                payload=obj,  # original keys; the API maps them to the frontend schema
            )

    client.upload_points(COLLECTION_NAME, points=tqdm(points()), batch_size=64)
    print(f"built {COLLECTION_NAME}: {client.count(COLLECTION_NAME).count} points")


if __name__ == "__main__":
    build()
