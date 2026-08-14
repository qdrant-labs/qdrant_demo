# Dockerfile is based on the following tutorial:
# https://www.erraticbits.ca/post/2021/fastapi/

# Build step #1: build the React front end
FROM node:20-bookworm-slim as build-step

WORKDIR /app

ENV PATH /app/node_modules/.bin:$PATH

COPY frontend/package.json  ./

RUN npm install

COPY ./frontend/ ./

RUN npm run build


FROM python:3.11-slim-bookworm

# Bump this to force every layer below to rebuild. The registry kept serving a
# stale runtime while builds cached clean, so this plus the startup marker in
# CMD makes it provable which image is actually running.
ENV IMAGE_MARKER=fastembed-free-v5

RUN apt-get update -y && apt-get install -y gcc && rm -rf /var/lib/apt/lists/*

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Install poetry for packages management
RUN python -m pip install -U pip poetry
RUN poetry config virtualenvs.create false

# Use /app as the working directory
WORKDIR /app

# Copy poetry files & install the dependencies
COPY ./pyproject.toml /app
COPY ./poetry.lock /app
COPY --from=build-step /app/dist /app/static

RUN poetry install --no-interaction --no-ansi --no-root --without dev
# Bump the client past the lock so Cloud inference (mxbai) and the hybrid query
# API work. The query is embedded server-side, so no local model download here.
#
# charset-normalizer is reinstalled at the version the lock pins because `-U`
# upgrades transitive dependencies over the ones poetry just installed, and that
# package ships a compiled extension alongside its Python module. Mixing
# versions leaves them disagreeing and the app dies on import with
# `module 'charset_normalizer.md' has no attribute 'CharInfo'`. Nothing here is
# pinned otherwise, so which versions land depends on the day the image builds.
RUN pip install -U "qdrant-client==1.18.0" \
    && pip uninstall -y charset-normalizer \
    && CHARSET_NORMALIZER_USE_MYPYC=0 pip install --no-cache-dir --no-binary charset-normalizer "charset-normalizer==3.4.1" \
    && python -c "import charset_normalizer, requests; print('charset-normalizer', charset_normalizer.__version__, 'imports clean')"

# Finally copy the application source code and install root
COPY qdrant_demo /app/qdrant_demo

# Drop fastembed. Embedding happens in Qdrant Cloud, so nothing here runs a
# model locally, but qdrant-client imports fastembed on load and that pulls in
# requests and charset_normalizer. A rebuild landed a charset_normalizer whose
# compiled extension disagreed with its Python module, and the service died on
# boot with `module 'charset_normalizer.md' has no attribute 'CharInfo'` before
# serving anything. Removing the unused dependency removes the import path
# rather than trying to keep it healthy.
#
# Last layer on purpose, so a cached earlier layer cannot skip it, and the
# import check fails the build instead of letting it crash on boot.
RUN echo "cache-bust v6" \
    && pip uninstall -y fastembed \
    && pip install --no-cache-dir "chardet>=5.2.0" \
    && python -c "import qdrant_demo.service; print('app imports clean')" \
    && python -c "import fastembed" 2>/dev/null && exit 1 || echo "fastembed confirmed absent"

EXPOSE 8000

CMD echo "STARTING $IMAGE_MARKER" && uvicorn qdrant_demo.service:app --host 0.0.0.0 --port ${PORT:-8000} --workers ${WORKERS:-1}

