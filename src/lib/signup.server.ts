import { createHash, randomBytes, timingSafeEqual } from "crypto";

export const SIGNUP_PIN_KEY = "signup_pin";

export function hashPin(pin: string, salt: string) {
  return createHash("sha256").update(`${salt}:${pin.trim()}`).digest("hex");
}

export function newSalt() {
  return randomBytes(16).toString("hex");
}

/** Stored format: "<salt>$<sha256>" */
export function encodePin(pin: string) {
  const salt = newSalt();
  return `${salt}$${hashPin(pin, salt)}`;
}

export function verifyPin(pin: string, stored: string | null | undefined) {
  if (!stored) return false;
  const [salt, digest] = stored.split("$");
  if (!salt || !digest) return false;
  const candidate = hashPin(pin, salt);
  const a = Buffer.from(candidate);
  const b = Buffer.from(digest);
  return a.length === b.length && timingSafeEqual(a, b);
}
