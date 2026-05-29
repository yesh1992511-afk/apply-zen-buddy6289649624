# Playwright base ships Chromium + all OS deps + Python
FROM mcr.microsoft.com/playwright/python:v1.48.0-jammy

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Tectonic for LaTeX → PDF (single static binary, no TeXLive needed)
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl ca-certificates xz-utils \
    && curl -L https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.15.0/tectonic-0.15.0-x86_64-unknown-linux-musl.tar.gz \
        | tar -xz -C /usr/local/bin \
    && rm -rf /var/lib/apt/lists/*

# Python deps
COPY pyproject.toml ./
RUN pip install -e . && playwright install chromium

# App
COPY app ./app

CMD ["python", "-m", "app.main"]
