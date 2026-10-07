// Talks to the Google Apps Script "doorman" (docs/meet/Code.gs).
import { API_URL } from './config.js';

export class ApiError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

export const configured = () => !!API_URL;

// Sent as plain text so the browser doesn't need a separate permission check
// that Apps Script can't answer.
export async function call(action, data = {}) {
  if (!API_URL) throw new ApiError('not_configured', 'This page isn’t connected to its Google Sheet yet.');
  let res;
  try {
    res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action, ...data }) });
  } catch {
    throw new ApiError('network', 'Couldn’t reach the server. Check your connection and try again.');
  }
  let body;
  try { body = await res.json(); } catch {
    throw new ApiError('server', 'The server sent back something unexpected. Try again in a moment.');
  }
  if (!body.ok) throw new ApiError(body.error || 'server', body.message || 'Something went wrong.');
  return body;
}
