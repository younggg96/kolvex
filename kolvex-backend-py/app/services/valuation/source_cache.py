"""Persistent public-source cache; no credentials or private user data."""
from hashlib import sha256
import json
import os
from pathlib import Path
import time
from uuid import uuid4

from app.services.sec.client import SecClient


class ValuationSecClient(SecClient):
    def __init__(self, directory=None):
        super().__init__()
        self.directory = Path(directory or os.getenv("VALUATION_SOURCE_CACHE", ".cache/valuation-sec"))

    async def read(self, url, ttl=21600):
        if not (url.startswith("https://www.sec.gov/") or url.startswith("https://data.sec.gov/")):
            raise ValueError("Unsupported SEC source")
        key = sha256(url.encode()).hexdigest()
        manifest = self.directory / f"{key}.json"
        immutable = "/Archives/edgar/data/" in url
        try:
            meta = json.loads(manifest.read_text())
            if meta["url"] == url and (immutable or time.time() - meta["fetched_at"] < ttl):
                digest = meta["sha256"]
                if len(digest) == 64 and all(c in "0123456789abcdef" for c in digest):
                    raw = (self.directory / f"{digest}.body").read_bytes()
                    if len(raw) <= 12_000_000 and sha256(raw).hexdigest() == digest:
                        return raw
        except (OSError, ValueError, KeyError, TypeError):
            pass
        raw = await super().read(url, ttl)
        self.directory.mkdir(parents=True, exist_ok=True)
        digest = sha256(raw).hexdigest()
        (self.directory / f"{digest}.body").write_bytes(raw)
        temporary = self.directory / f"{key}-{uuid4().hex}.tmp"
        temporary.write_text(json.dumps({"url": url, "sha256": digest, "fetched_at": time.time()}))
        temporary.replace(manifest)
        return raw
