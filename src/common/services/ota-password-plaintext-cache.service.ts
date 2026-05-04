import { Injectable } from '@nestjs/common'

/**
 * In-memory cache of encrypted OTA password string → decrypted plaintext.
 * Matches global report style: TTL-based entries, full invalidation on credential changes.
 * Safe across requests: identical ciphertext always maps to the same plaintext until rotation.
 */
@Injectable()
export class OtaPasswordPlaintextCacheService {
  /** Same default as global-report repository / service (5 minutes) */
  private readonly TTL_MS = 5 * 60 * 1000

  private readonly store = new Map<
    string,
    { plain: string; timestamp: number }
  >()

  private isValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.TTL_MS
  }

  /**
   * Split ciphertexts into cache hits vs values that need decrypt (misses / expired).
   */
  partition(ciphertexts: string[]): {
    hits: Map<string, string>
    misses: string[]
  } {
    const hits = new Map<string, string>()
    const misses: string[] = []

    for (const ct of ciphertexts) {
      const entry = this.store.get(ct)
      if (entry && this.isValid(entry.timestamp)) {
        hits.set(ct, entry.plain)
      } else {
        if (entry) {
          this.store.delete(ct)
        }
        misses.push(ct)
      }
    }

    return { hits, misses }
  }

  /** Store successful decryptions (call after workers / decryptWithKey). */
  recordDecrypted(pairs: Map<string, string>): void {
    const now = Date.now()
    for (const [enc, plain] of pairs) {
      this.store.set(enc, { plain, timestamp: now })
    }
  }

  /** Clear all entries (any property OTA password change). */
  invalidate(): void {
    this.store.clear()
  }
}
