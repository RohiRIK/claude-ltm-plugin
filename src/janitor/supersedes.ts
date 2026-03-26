/**
 * supersedes.ts — Manage supersedes relations between memories.
 * When a new memory supersedes an old one, the old memory is marked
 * as 'superseded' and a directed relation is created.
 */
import { getDb } from "../shared-db.js";

/**
 * Mark a memory as superseding another.
 * - Creates a 'supersedes' relation from newId -> oldId
 * - Sets the old memory's status to 'superseded'
 * - Optionally transfers tags from old to new
 *
 * @param newId - The memory that supersedes
 * @param oldId - The memory being superseded
 * @param transferTags - Whether to copy tags from old to new (default true)
 */
export function supersede(
  newId: number,
  oldId: number,
  transferTags = true,
): void {
  const db = getDb();

  // Validate both memories exist
  const newMem = db
    .query<{ id: number; status: string }, [number]>(
      "SELECT id, status FROM memories WHERE id = ?",
    )
    .get(newId);
  const oldMem = db
    .query<{ id: number; status: string }, [number]>(
      "SELECT id, status FROM memories WHERE id = ?",
    )
    .get(oldId);

  if (!newMem) throw new Error(`New memory ${newId} not found`);
  if (!oldMem) throw new Error(`Old memory ${oldId} not found`);
  if (newId === oldId) throw new Error("Cannot supersede self");

  db.transaction(() => {
    // Create supersedes relation
    db.run(
      `INSERT OR IGNORE INTO memory_relations (source_memory_id, target_memory_id, relationship_type)
       VALUES (?, ?, 'supersedes')`,
      [newId, oldId],
    );

    // Mark old memory as superseded
    db.run("UPDATE memories SET status = 'superseded' WHERE id = ?", [
      oldId,
    ]);

    // Transfer tags if requested
    if (transferTags) {
      db.run(
        `INSERT OR IGNORE INTO memory_tags (memory_id, tag_id)
         SELECT ?, tag_id FROM memory_tags WHERE memory_id = ?`,
        [newId, oldId],
      );
    }

    // Repoint context_items from old to new
    db.run(
      "UPDATE context_items SET memory_id = ? WHERE memory_id = ?",
      [newId, oldId],
    );
  })();
}

/**
 * Get all memories that a given memory supersedes (direct and transitive).
 * Follows the supersedes chain to find the full history.
 */
export function getSupersededChain(
  memoryId: number,
): Array<{ id: number; content: string; created_at: string }> {
  const db = getDb();
  const chain: Array<{ id: number; content: string; created_at: string }> =
    [];
  const visited = new Set<number>();
  const queue = [memoryId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const superseded = db
      .query<{ id: number; content: string; created_at: string }, [number]>(
        `SELECT m.id, m.content, m.created_at
         FROM memories m
         JOIN memory_relations r ON r.target_memory_id = m.id
         WHERE r.source_memory_id = ? AND r.relationship_type = 'supersedes'`,
      )
      .all(currentId);

    for (const s of superseded) {
      chain.push(s);
      queue.push(s.id);
    }
  }

  return chain;
}

/**
 * Get the memory that supersedes a given memory (if any).
 * Returns null if the memory hasn't been superseded.
 */
export function getSupersededBy(
  memoryId: number,
): { id: number; content: string } | null {
  const db = getDb();
  return db
    .query<{ id: number; content: string }, [number]>(
      `SELECT m.id, m.content
       FROM memories m
       JOIN memory_relations r ON r.source_memory_id = m.id
       WHERE r.target_memory_id = ? AND r.relationship_type = 'supersedes'
       LIMIT 1`,
    )
    .get(memoryId) ?? null;
}

/**
 * Undo a supersedes relation: restore the old memory to active status.
 */
export function unsupersede(newId: number, oldId: number): void {
  const db = getDb();

  db.transaction(() => {
    // Remove the supersedes relation
    db.run(
      `DELETE FROM memory_relations
       WHERE source_memory_id = ? AND target_memory_id = ? AND relationship_type = 'supersedes'`,
      [newId, oldId],
    );

    // Check if the old memory is still superseded by something else
    const stillSuperseded = db
      .query<{ cnt: number }, [number]>(
        `SELECT COUNT(*) as cnt FROM memory_relations
         WHERE target_memory_id = ? AND relationship_type = 'supersedes'`,
      )
      .get(oldId);

    // If not superseded by anything else, restore to active
    if ((stillSuperseded?.cnt ?? 0) === 0) {
      db.run(
        "UPDATE memories SET status = 'active' WHERE id = ? AND status = 'superseded'",
        [oldId],
      );
    }
  })();
}
