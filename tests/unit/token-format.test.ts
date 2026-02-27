import { describe, it, expect } from "vitest";

// --- Node-compatible re-implementations of the Deno token-utils logic ---

const BASE62_CHARS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

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

function numberToBase62(num: number): string {
  if (num === 0) return "0";
  const n = num >>> 0;
  let result = "";
  let remaining = n;
  while (remaining > 0) {
    result = BASE62_CHARS[remaining % 62] + result;
    remaining = Math.floor(remaining / 62);
  }
  return result;
}

function bytesToBase62(bytes: Uint8Array): string {
  let result = "";
  for (const byte of bytes) {
    result += BASE62_CHARS[byte % 62];
  }
  return result;
}

function generateToken(): string {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);

  const randomPart = bytesToBase62(randomBytes).slice(0, 30);
  const paddedRandom = randomPart.padEnd(30, "0");

  const crc = crc32(paddedRandom);
  const crcPart = numberToBase62(crc).padStart(6, "0");

  return `sdp_${paddedRandom}${crcPart}`;
}

function validateTokenFormat(token: string): boolean {
  if (!token.startsWith("sdp_")) return false;
  if (token.length !== 40) return false;

  const body = token.slice(4); // 36 chars: 30 random + 6 CRC
  const randomPart = body.slice(0, 30);
  const crcPart = body.slice(30);

  const expectedCrc = crc32(randomPart);
  const expectedCrcStr = numberToBase62(expectedCrc).padStart(6, "0");

  return crcPart === expectedCrcStr;
}

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// --- Tests ---

const BASE62_REGEX = /^[0-9A-Za-z]+$/;

describe("Token generation", () => {
  it("token starts with sdp_ prefix", () => {
    const token = generateToken();
    expect(token.startsWith("sdp_")).toBe(true);
  });

  it("token is exactly 40 characters long", () => {
    const token = generateToken();
    expect(token.length).toBe(40);
  });

  it("token body uses only base62 characters", () => {
    const token = generateToken();
    const body = token.slice(4); // strip "sdp_"
    expect(body).toMatch(BASE62_REGEX);
  });

  it("CRC32 checksum in last 6 chars validates against first 30 chars", () => {
    const token = generateToken();
    const body = token.slice(4);
    const randomPart = body.slice(0, 30);
    const crcPart = body.slice(30);

    const expectedCrc = crc32(randomPart);
    const expectedCrcStr = numberToBase62(expectedCrc).padStart(6, "0");

    expect(crcPart).toBe(expectedCrcStr);
  });

  it("validateTokenFormat returns true for valid tokens", () => {
    const token = generateToken();
    expect(validateTokenFormat(token)).toBe(true);
  });

  it("validateTokenFormat returns false for wrong prefix", () => {
    const token = generateToken();
    const bad = "xxx_" + token.slice(4);
    expect(validateTokenFormat(bad)).toBe(false);
  });

  it("validateTokenFormat returns false for wrong length", () => {
    const token = generateToken();
    const tooShort = token.slice(0, 30);
    expect(validateTokenFormat(tooShort)).toBe(false);

    const tooLong = token + "extra";
    expect(validateTokenFormat(tooLong)).toBe(false);
  });

  it("validateTokenFormat returns false for corrupted checksum", () => {
    const token = generateToken();
    // Flip the last character to corrupt the checksum
    const lastChar = token[token.length - 1];
    const replacement = lastChar === "A" ? "B" : "A";
    const corrupted = token.slice(0, -1) + replacement;

    expect(validateTokenFormat(corrupted)).toBe(false);
  });

  it("SHA-256 hashing produces consistent 64-char hex output", async () => {
    const token = generateToken();
    const hash1 = await hashToken(token);
    const hash2 = await hashToken(token);

    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });
});
