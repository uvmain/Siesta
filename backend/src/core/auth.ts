import { Buffer } from 'node:buffer'
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)

export const SESSION_COOKIE_NAME = 'siesta_session'
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('base64url')
  const derivedKey = await scrypt(password, salt, 64) as Buffer
  return `${salt}:${derivedKey.toString('base64url')}`
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const [salt, encodedHash] = passwordHash.split(':')
  if (!salt || !encodedHash) {
    return false
  }

  const expectedHash = Buffer.from(encodedHash, 'base64url')
  const actualHash = await scrypt(password, salt, expectedHash.length) as Buffer
  return expectedHash.length === actualHash.length && timingSafeEqual(expectedHash, actualHash)
}

export function createSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url')
}
