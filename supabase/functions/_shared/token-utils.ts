const BASE62_CHARS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/**
 * Generate a Simple Dimple PAT token.
 * Format: sdp_<30 base62 random chars><6 base62 CRC32>
 * Total: 40 characters
 */
export function generateToken(): string {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);

  const randomPart = bytesToBase62(randomBytes).slice(0, 30);
  const paddedRandom = randomPart.padEnd(30, "0");

  const crc = crc32(paddedRandom);
  const crcPart = numberToBase62(crc).padStart(6, "0");

  return `sdp_${paddedRandom}${crcPart}`;
}

/**
 * Hash a token using SHA-256, returning hex-encoded string.
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Validate that a token has the correct sdp_ prefix and CRC32 checksum.
 */
export function validateTokenFormat(token: string): boolean {
  if (!token.startsWith("sdp_")) return false;
  if (token.length !== 40) return false;

  const body = token.slice(4); // 36 chars: 30 random + 6 CRC
  const randomPart = body.slice(0, 30);
  const crcPart = body.slice(30);

  const expectedCrc = crc32(randomPart);
  const expectedCrcStr = numberToBase62(expectedCrc).padStart(6, "0");

  return crcPart === expectedCrcStr;
}

function bytesToBase62(bytes: Uint8Array): string {
  let result = "";
  for (const byte of bytes) {
    result += BASE62_CHARS[byte % 62];
  }
  return result;
}

function numberToBase62(num: number): string {
  if (num === 0) return "0";
  const n = num >>> 0; // ensure unsigned
  let result = "";
  let remaining = n;
  while (remaining > 0) {
    result = BASE62_CHARS[remaining % 62] + result;
    remaining = Math.floor(remaining / 62);
  }
  return result;
}

/**
 * CRC32 implementation for token checksum validation.
 */
function crc32(str: string): number {
  let crc = 0xffffffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i);
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
