# Bluesky poster (TypeScript)

This project now uses TypeScript with the official AT Protocol JS client.

## Install

```bash
npm i -g typescript
npm i -g ts-node
npm install @atproto/api dotenv cron
```

## Credentials

The script reads credentials from `.env` using these variables:

- `BLUESKY_IDENTIFIER`
- `BLUESKY_APP_PASSWORD`

## Run

```bash
ts-node post_hello.ts
```
