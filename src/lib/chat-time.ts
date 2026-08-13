/** Chats live for 48 hours from the moment the match is created. */
export const CHAT_LIFETIME_MS = 48 * 3600 * 1000;

/** True while a match's 48-hour chat window is still open. */
export function isChatLive(createdAt: string): boolean {
  return Date.now() - +new Date(createdAt) < CHAT_LIFETIME_MS;
}
