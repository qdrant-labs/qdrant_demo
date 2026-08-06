"""Keyword sparse encoder for hybrid search. Tokenize, term-frequency, stable
hash to a u32 index. Qdrant applies IDF at query time (sparse index modifier=IDF),
so index-time values carry the term-frequency component only. The same function
runs for both documents and queries so tokenization stays consistent.

This is a small self-contained encoder so the demo has no extra model download.
The idiomatic replacement is Qdrant's BM25 sparse model (`Qdrant/bm25`), which
adds stemming and a tuned scoring; switching to it is a follow-up because it means
re-indexing the collection."""
import re
import zlib
import math
from collections import Counter

_STOP = set(
    "the a an and or of to in for on with is are was were be been being by at from as "
    "it its this that these those i you he she we they your our their his her".split()
)


def tokenize(text):
    # Keep single characters (languages like "c"/"r", versions like "3"); drop
    # only stopwords. Dropping short tokens silently lost real query terms.
    return [w for w in re.findall(r"[a-z0-9+#]+", (text or "").lower()) if w not in _STOP]


def to_sparse(text):
    tf = Counter(tokenize(text))
    indices, values = [], []
    for tok, c in tf.items():
        # Qdrant sparse indices are unsigned 32-bit; use the full width.
        indices.append(zlib.crc32(tok.encode("utf-8")) & 0xFFFFFFFF)
        values.append(1.0 + math.log(c))
    return indices, values
