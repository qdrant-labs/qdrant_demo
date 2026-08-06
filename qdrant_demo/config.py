import os

CODE_DIR = os.path.dirname(__file__)
ROOT_DIR = os.path.dirname(CODE_DIR)
DATA_DIR = os.path.join(ROOT_DIR, "data")
STATIC_DIR = os.path.join(ROOT_DIR, "static")

QDRANT_URL = os.environ.get("QDRANT_URL", "http://localhost:6333/")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY", "")

COLLECTION_NAME = os.environ.get("COLLECTION_NAME", "startups_hybrid")
EMBEDDINGS_MODEL = os.environ.get("EMBEDDINGS_MODEL", "mixedbread-ai/mxbai-embed-large-v1")

TEXT_FIELD_NAME = os.environ.get("TEXT_FIELD_NAME", "description")

# Named vectors on the hybrid collection. Leave DENSE_VECTOR_NAME empty for a
# collection with a single unnamed vector.
DENSE_VECTOR_NAME = os.environ.get("DENSE_VECTOR_NAME", "dense")
SPARSE_VECTOR_NAME = os.environ.get("SPARSE_VECTOR_NAME", "sparse")

# Embed the query with Qdrant Cloud server-side inference. Defaults ON: the query
# model is a 1024-d mxbai, too heavy to embed per-request on a small CPU box.
# Parse leniently since some hosts keep the surrounding quotes on the value.
CLOUD_INFERENCE = os.environ.get("CLOUD_INFERENCE", "1").strip().strip('"').strip("'").lower() in ("1", "true", "yes")
RESULT_LIMIT = int(os.environ.get("RESULT_LIMIT", "20"))
HYBRID_PREFETCH = int(os.environ.get("HYBRID_PREFETCH", "40"))
