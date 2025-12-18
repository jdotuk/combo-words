'use server';

import db, { initDatabase } from '@/lib/db';
import { Combo } from '@/lib/types';

// Initialize database on first import
initDatabase();

/**
 * Get the next card based on anchor word learning with chaining
 * - Show up to 3 cards with the current anchor word (or fewer if word has fewer combos)
 * - Chain to a non-anchor word from the last combo
 * - That word becomes the new anchor (can be any word, even non-base or learnt)
 * - This allows "bridging" through words with fewer combos to reach new vocabulary
 */
export async function getNextCard(lastComboId?: string, currentAnchor?: string | null, needNewAnchor?: boolean, lastComboWordIds?: string[], currentCardCount?: number, maxCards?: number, shownCombosForAnchor?: string[]) {
  // If we need a new anchor word, chain from the last combo
  let anchorWord = currentAnchor;
  
  if (!anchorWord || needNewAnchor) {
    if (needNewAnchor && lastComboWordIds && currentAnchor) {
      // Chain: pick a non-anchor word from the last combo to be the new anchor
      const otherWords = lastComboWordIds.filter(id => id !== currentAnchor);
      
      if (otherWords.length > 0) {
        // Prioritize unlearnt base words, but allow any word as fallback
        const unlearntBaseWord = db.prepare(`
          SELECT w.id, COUNT(cm.combo_id) as combo_count
          FROM Words w
          JOIN ComboMap cm ON w.id = cm.word_id
          WHERE w.id IN (${otherWords.map(() => '?').join(',')})
          AND w.learnt = 0
          GROUP BY w.id
          HAVING combo_count >= 4
          ORDER BY combo_count DESC, RANDOM()
          LIMIT 1
        `).get(...otherWords) as { id: string, combo_count: number } | undefined;
        
        if (unlearntBaseWord) {
          anchorWord = unlearntBaseWord.id;
        } else {
          // No unlearnt base word? Try any base word (even if learnt)
          const anyBaseWord = db.prepare(`
            SELECT w.id, COUNT(cm.combo_id) as combo_count
            FROM Words w
            JOIN ComboMap cm ON w.id = cm.word_id
            WHERE w.id IN (${otherWords.map(() => '?').join(',')})
            GROUP BY w.id
            HAVING combo_count >= 4
            ORDER BY w.learnt ASC, combo_count DESC, RANDOM()
            LIMIT 1
          `).get(...otherWords) as { id: string, combo_count: number } | undefined;
          
          if (anyBaseWord) {
            anchorWord = anyBaseWord.id;
          } else {
            // No base words? Pick any word (for bridging) - prioritize unlearnt
            const anyWord = db.prepare(`
              SELECT w.id, w.learnt
              FROM Words w
              WHERE w.id IN (${otherWords.map(() => '?').join(',')})
              ORDER BY w.learnt ASC, RANDOM()
              LIMIT 1
            `).get(...otherWords) as { id: string, learnt: number } | undefined;
            
            if (anyWord) {
              anchorWord = anyWord.id;
            } else {
              // Ultimate fallback: just pick the first other word
              anchorWord = otherWords[0];
            }
          }
        }
      } else {
        // Fallback: pick a random unlearnt base word
        anchorWord = null;
      }
    }
    
    // If still no anchor (first load or couldn't chain), pick an unlearnt base word
    if (!anchorWord) {
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
        // All base words learned! Return null
        return null;
      }

      anchorWord = unlearntWord.id;
    }
  }

  // Get the combo count for the anchor word to determine max cards
  const comboCount = db.prepare(`
    SELECT COUNT(DISTINCT cm.combo_id) as count
    FROM ComboMap cm
    WHERE cm.word_id = ?
  `).get(anchorWord) as { count: number };
  
  const maxCardsForAnchor = Math.min(comboCount.count, 3);
  const isLastCard = currentCardCount && maxCards && currentCardCount >= maxCards - 1;
  const excludeComboIds = shownCombosForAnchor || [];

  // Find a combo containing the anchor word
  let combo: Combo | undefined;
  
  // If this is the last card for the anchor, try to find a combo where the other word has good connectivity
  if (isLastCard) {
    combo = db.prepare(`
      SELECT DISTINCT c.*
      FROM Combos c
      JOIN ComboMap cm1 ON c.id = cm1.combo_id
      JOIN ComboMap cm2 ON c.id = cm2.combo_id
      JOIN (
        SELECT w.id, COUNT(cm.combo_id) as combo_count
        FROM Words w
        JOIN ComboMap cm ON w.id = cm.word_id
        GROUP BY w.id
      ) w ON cm2.word_id = w.id
      WHERE cm1.word_id = ?
      AND cm2.word_id != ?
      AND c.id NOT IN (${excludeComboIds.length > 0 ? excludeComboIds.map(() => '?').join(',') : 'SELECT NULL WHERE 1=0'})
      AND w.combo_count >= 2
      ORDER BY w.combo_count DESC, RANDOM()
      LIMIT 1
    `).get(anchorWord, anchorWord, ...excludeComboIds) as Combo | undefined;
  }
  
  if (!combo) {
    // Try to find a combo with the anchor word that hasn't been shown yet
    combo = db.prepare(`
      SELECT DISTINCT c.*
      FROM Combos c
      JOIN ComboMap cm ON c.id = cm.combo_id
      WHERE cm.word_id = ?
      AND c.id NOT IN (${excludeComboIds.length > 0 ? excludeComboIds.map(() => '?').join(',') : 'SELECT NULL WHERE 1=0'})
      ORDER BY RANDOM()
      LIMIT 1
    `).get(anchorWord, ...excludeComboIds) as Combo | undefined;
  }
  
  if (!combo) {
    // Get any combo with the anchor word (fallback if all have been shown)
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
    anchorWord,
    maxCardsForAnchor
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
 * Reset all progress - mark all words as unlearnt
 */
export async function resetProgress(): Promise<void> {
  db.prepare(`
    UPDATE Words
    SET learnt = 0
  `).run();
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
