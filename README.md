# Bluesky Hello World Poster

This repo contains a simple Python script that posts this text to Bluesky:

`Hello world (test post from Codex)`

It follows the Bluesky SDK pattern from the docs:

```python
from atproto import Client

client = Client()
client.login('handle.example.com', 'app-password')
client.send_post(text='Hello world (test post from Codex)')
```

## Docs used

- https://docs.bsky.app/docs/get-started
- https://docs.bsky.app/docs/tutorials/creating-a-post
- https://docs.bsky.app/docs/starter-templates/bots

## 1) Install dependency

```bash
python3 -m pip install atproto
```

## 2) Put credentials in environment variables

Required:

- `BLUESKY_IDENTIFIER` (your handle, e.g. `you.bsky.social`)
- `BLUESKY_APP_PASSWORD` (your Bluesky app password)

Optional:

- `BLUESKY_PDS_HOST` (defaults to `https://bsky.social`)

Example `.env` file:

```bash
BLUESKY_IDENTIFIER=you.bsky.social
BLUESKY_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
# BLUESKY_PDS_HOST=https://bsky.social
```

Load it into your shell:

```bash
set -a
source .env
set +a
```

## 3) Run

```bash
python3 post_hello.py
```

## 4) Dry-run

```bash
python3 post_hello.py --dry-run
```
