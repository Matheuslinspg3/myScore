import { timingSafeEqual } from "node:crypto";

export function verifyWebhookSecret(
  received: string | null,
  expected: string,
): boolean {
  if (!received) return false;
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  if (receivedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(receivedBuffer, expectedBuffer);
}
