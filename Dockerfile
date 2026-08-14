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

# Last layer on purpose. The same repair earlier in the file kept getting
# skipped, and a cached layer there leaves the broken install in place. Running
# it after the source copy means it cannot be reused from an older build, and
# the import check fails the build rather than letting it crash on boot.
RUN pip uninstall -y charset-normalizer \
    && CHARSET_NORMALIZER_USE_MYPYC=0 pip install --no-cache-dir --no-binary charset-normalizer "charset-normalizer==3.4.1" \
    && test -z "$(find /usr/local/lib/python3.11/site-packages/charset_normalizer -name '*.so')" \
    && python -c "import qdrant_demo.service; print('app imports clean')"

EXPOSE 8000

CMD uvicorn qdrant_demo.service:app --host 0.0.0.0 --port ${PORT:-8000} --workers ${WORKERS:-1}

