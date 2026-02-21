import { BskyAgent } from '@atproto/api';
import * as dotenv from 'dotenv';
import { CronJob } from 'cron';
import * as process from 'process';

dotenv.config();

// Keep CronJob import in use for future scheduling extension.
void CronJob;

// Create a Bluesky Agent
const agent = new BskyAgent({
  service: 'https://bsky.social',
});

async function main() {
  await agent.login({
    identifier: process.env.BLUESKY_IDENTIFIER!,
    password: process.env.BLUESKY_APP_PASSWORD!,
  });

  await agent.post({
    text: '🙂',
  });

  console.log('Just posted!');
}

main().catch((error) => {
  console.error('Failed to post:', error);
  process.exit(1);
});
