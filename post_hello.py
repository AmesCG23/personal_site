#!/usr/bin/env python3
"""Post a single message to Bluesky using the official atproto SDK.

Built from Bluesky docs patterns:
- https://docs.bsky.app/docs/get-started
- https://docs.bsky.app/docs/tutorials/creating-a-post
- https://docs.bsky.app/docs/starter-templates/bots
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone

DEFAULT_TEXT = "Hello world (test post from Codex)"
DEFAULT_PDS_HOST = "https://bsky.social"


def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Post a message to Bluesky")
    parser.add_argument("--text", default=DEFAULT_TEXT, help="Post text")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be sent without posting",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    identifier = require_env("BLUESKY_IDENTIFIER")
    app_password = require_env("BLUESKY_APP_PASSWORD")
    pds_host = os.getenv("BLUESKY_PDS_HOST", DEFAULT_PDS_HOST)

    if args.dry_run:
        print("Dry run only. No post was sent.")
        print(f"PDS host: {pds_host}")
        print(f"Identifier: {identifier}")
        print(f"Text: {args.text}")
        print(
            "createdAt:",
            datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "(SDK fills this automatically on send_post)",
        )
        return 0

    try:
        from atproto import Client
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "Missing dependency: atproto. Install it with: python3 -m pip install atproto"
        ) from exc

    client = Client(base_url=pds_host)
    client.login(identifier, app_password)
    response = client.send_post(text=args.text)

    print("Post created successfully.")
    print(f"URI: {getattr(response, 'uri', '(unknown)')}")
    print(f"CID: {getattr(response, 'cid', '(unknown)')}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        raise SystemExit(1)
