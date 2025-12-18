'use server';

import db, { initDatabase } from '@/lib/db';
import { Combo } from '@/lib/types';

// Initialize database on first import
initDatabase();

/**
 * Get the next card based on anchor word learning
 * - Pick an anchor word to learn (unlearnt word with most combos)
 * - Show 3 cards containing that anchor word
 * - After 3 cards, mark anchor as learnt and pick a new one
 */
export async function getNextCard(lastComboId?: string, currentAnchor?: string | null, needNewAnchor?: boolean) {
  // If we need a new anchor word (or don't have one), pick one
  let anchorWord = currentAnchor;
  
  if (!anchorWord || needNewAnchor) {
    // Get an unlearnt word with the most combos (prioritize base words)
    const unlearntWord = db.prepare(`
      SELECT w.id, COUNT(cm.combo_id) as combo_count
      FROM Words w
      JOIN ComboMap cm ON w.id = cm.word_id
      WHERE w.learnt = 0
      GROUP BY w.id
      HAVING combo_count >= 4
      ORDER BY combo_count DESC, RANDOM()
      LIMIT 1
    `).get() as { id: string, combo_count: number } | undefined;

    if (!unlearntWord) {
      // All words learned! Return null
      return null;
    }

    anchorWord = unlearntWord.id;
  }

  // Find a combo containing the anchor word, preferably not the last one shown
  let combo: Combo | undefined;
  
  if (lastComboId) {
    // Try to find a different combo with the anchor word
    combo = db.prepare(`
      SELECT DISTINCT c.*
      FROM Combos c
      JOIN ComboMap cm ON c.id = cm.combo_id
      WHERE cm.word_id = ?
      AND c.id != ?
      ORDER BY RANDOM()
      LIMIT 1
    `).get(anchorWord, lastComboId) as Combo | undefined;
  }
  
  if (!combo) {
    // Get any combo with the anchor word
    combo = db.prepare(`
      SELECT DISTINCT c.*
      FROM Combos c
      JOIN ComboMap cm ON c.id = cm.combo_id
      WHERE cm.word_id = ?
      ORDER BY RANDOM()
      LIMIT 1
    `).get(anchorWord) as Combo | undefined;
  }

  if (!combo) return null;

  // Get word IDs for this combo
  const wordIds = db.prepare(`
    SELECT word_id FROM ComboMap WHERE combo_id = ?
  `).all(combo.id) as Array<{ word_id: string }>;

  return {
    card: {
      ...combo,
      wordIds: wordIds.map(w => w.word_id)
    },
    anchorWord
  };
}

/**
 * Mark a word as learnt after showing 3 cards with it as anchor
 */
export async function markWordAsLearnt(wordId: string): Promise<void> {
  db.prepare(`
    UPDATE Words
    SET learnt = 1
    WHERE id = ?
  `).run(wordId);
}

/**
 * Unmark a word as learnt (for back button)
 */
export async function unmarkWordAsLearnt(wordId: string): Promise<void> {
  db.prepare(`
    UPDATE Words
    SET learnt = 0
    WHERE id = ?
  `).run(wordId);
}

/**
 * Get combo details with word information
 */
export async function getComboDetails(comboId: string) {
  const combo = db.prepare('SELECT * FROM Combos WHERE id = ?').get(comboId) as Combo;
  
  if (!combo) return null;

  const words = db.prepare(`
    SELECT w.* FROM Words w
    JOIN ComboMap cm ON w.id = cm.word_id
    WHERE cm.combo_id = ?
  `).all(comboId);

  return {
    combo,
    words
  };
}

/**
 * Get statistics - only count base words (words with at least 4 combos)
 */
export async function getStats() {
  const baseWords = db.prepare(`
    SELECT w.id, w.learnt, COUNT(cm.combo_id) as combo_count
    FROM Words w
    JOIN ComboMap cm ON w.id = cm.word_id
    GROUP BY w.id
    HAVING combo_count >= 4
  `).all() as Array<{ id: string; learnt: number; combo_count: number }>;

  const learnt = baseWords.filter(w => w.learnt === 1).length;
  const unlearnt = baseWords.filter(w => w.learnt === 0).length;

  return {
    total: baseWords.length,
    learnt,
    unlearnt
  };
}
