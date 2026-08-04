"""Keyword sparse encoder for hybrid search. Tokenize, term-frequency, stable
hash to a u32 index. Qdrant applies IDF at query time (sparse index modifier=IDF),
so index-time values carry the term-frequency component only. The same function
runs for both documents and queries so tokenization stays consistent."""
import re
import zlib
import math
from collections import Counter

_STOP = set(
    "the a an and or of to in for on with is are was were be been being by at from as "
    "it its this that these those i you he she we they your our their his her".split()
)


def tokenize(text):
    return [w for w in re.findall(r"[a-z0-9]+", (text or "").lower()) if len(w) > 1 and w not in _STOP]


def to_sparse(text):
    tf = Counter(tokenize(text))
    indices, values = [], []
    for tok, c in tf.items():
        indices.append(zlib.crc32(tok.encode("utf-8")) & 0x7FFFFFFF)
        values.append(1.0 + math.log(c))
    return indices, values
