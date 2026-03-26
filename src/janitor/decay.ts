/**
 * decay.ts — Memory decay logic.
 * Memories that haven't been used or confirmed recently lose confidence over time.
 * When confidence drops below a threshold, they're marked as deprecated.
 */
import { getDb, getSetting } from "../shared-db.js";
import { SETTING_KEYS, getDefault } from "./providers/types.js";

/** Get decay configuration from settings. */
function getDecayConfig(): {
  graceDays: number;
  rate: number;
  minConfidence: number;
} {
  return {
    graceDays: Number.parseInt(
      getSetting(SETTING_KEYS.DECAY_GRACE_DAYS) ||
        getDefault(SETTING_KEYS.DECAY_GRACE_DAYS),
      10,
    ),
    rate: Number.parseFloat(
      getSetting(SETTING_KEYS.DECAY_RATE) ||
        getDefault(SETTING_KEYS.DECAY_RATE),
    ),
    minConfidence: Number.parseFloat(
      getSetting(SETTING_KEYS.DECAY_MIN_CONFIDENCE) ||
        getDefault(SETTING_KEYS.DECAY_MIN_CONFIDENCE),
    ),
  };
}

export interface DecayResult {
  /** Number of memories whose confidence was reduced. */
  decayed: number;
  /** Number of memories that crossed the threshold and were deprecated. */
  deprecated: number;
  /** Total active memories scanned. */
  scanned: number;
}

/**
 * Run decay on all active memories.
 *
 * Logic:
 * 1. For each active memory, compute days since max(last_used_at, last_confirmed_at)
 * 2. If days > graceDays, reduce confidence by rate * (days - graceDays)
 * 3. If confidence drops below minConfidence, mark as deprecated
 * 4. High-importance (5) memories decay at half rate
 * 5. Never decay memories with confirm_count >= 10 (deeply reinforced)
 */
export function runDecay(): DecayResult {
  const db = getDb();
  const { graceDays, rate, minConfidence } = getDecayConfig();

  const now = new Date();
  const result: DecayResult = { decayed: 0, deprecated: 0, scanned: 0 };

  const memories = db
    .query<
      {
        id: number;
        confidence: number;
        importance: number;
        confirm_count: number;
        last_used_at: string;
        last_confirmed_at: string;
      },
      []
    >(
      `SELECT id, confidence, importance, confirm_count, last_used_at, last_confirmed_at
       FROM memories WHERE status = 'active'`,
    )
    .all();

  result.scanned = memories.length;

  for (const mem of memories) {
    // Skip deeply reinforced memories
    if (mem.confirm_count >= 10) continue;

    // Use the most recent activity date
    const lastActivity = new Date(
      Math.max(
        new Date(mem.last_used_at).getTime(),
        new Date(mem.last_confirmed_at).getTime(),
      ),
    );

    const daysSinceActivity = Math.floor(
      (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysSinceActivity <= graceDays) continue;

    const excessDays = daysSinceActivity - graceDays;
    // High-importance memories decay at half rate
    const effectiveRate = mem.importance >= 5 ? rate / 2 : rate;
    const decayAmount = effectiveRate * excessDays;

    const newConfidence = Math.max(0, mem.confidence - decayAmount);

    if (newConfidence < minConfidence) {
      // Mark as deprecated
      db.run(
        `UPDATE memories SET confidence = ?, status = 'deprecated' WHERE id = ?`,
        [newConfidence, mem.id],
      );
      result.deprecated++;
      result.decayed++;
    } else if (newConfidence < mem.confidence) {
      // Reduce confidence but keep active
      db.run(`UPDATE memories SET confidence = ? WHERE id = ?`, [
        Math.round(newConfidence * 1000) / 1000,
        mem.id,
      ]);
      result.decayed++;
    }
  }

  return result;
}

/**
 * Touch a memory's last_used_at timestamp.
 * Called when a memory is recalled/used in a session.
 */
export function touchMemory(memoryId: number): void {
  const db = getDb();
  db.run(
    `UPDATE memories SET last_used_at = datetime('now') WHERE id = ?`,
    [memoryId],
  );
}
