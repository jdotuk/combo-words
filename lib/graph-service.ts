import db from './db';

interface GraphData {
  [wordId: string]: string[]; // wordId -> array of comboIds
}

class GraphService {
  private graph: GraphData = {};

  constructor() {
    this.buildGraph();
  }

  /**
   * Build in-memory graph from ComboMap table
   * Structure: { "apple-n-0": ["red-apple-g-0", "green-apple-g-0", ...], ... }
   */
  private buildGraph() {
    const rows = db.prepare('SELECT combo_id, word_id FROM ComboMap').all() as Array<{
      combo_id: string;
      word_id: string;
    }>;

    for (const row of rows) {
      if (!this.graph[row.word_id]) {
        this.graph[row.word_id] = [];
      }
      this.graph[row.word_id].push(row.combo_id);
    }
  }

  /**
   * Find a path of combos from wordA to wordB using BFS
   * Returns array of combo IDs that bridge the two words
   */
  findPath(wordIdA: string, wordIdB: string): string[] | null {
    if (!this.graph[wordIdA] || !this.graph[wordIdB]) {
      return null;
    }

    // If both words share a combo, return it immediately
    const sharedCombos = this.graph[wordIdA].filter(combo => 
      this.graph[wordIdB].includes(combo)
    );
    if (sharedCombos.length > 0) {
      return [sharedCombos[0]];
    }

    // BFS to find shortest path
    interface QueueItem {
      comboId: string;
      path: string[];
    }

    const queue: QueueItem[] = [];
    const visited = new Set<string>();
    
    // Start with all combos containing wordA
    for (const comboId of this.graph[wordIdA]) {
      queue.push({ comboId, path: [comboId] });
      visited.add(comboId);
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      
      // Get all words in current combo
      const wordsInCombo = db.prepare(
        'SELECT word_id FROM ComboMap WHERE combo_id = ?'
      ).all(current.comboId) as Array<{ word_id: string }>;

      // Check if any word connects to target
      for (const { word_id } of wordsInCombo) {
        const combosWithThisWord = this.graph[word_id] || [];
        
        for (const nextComboId of combosWithThisWord) {
          if (visited.has(nextComboId)) continue;

          // Check if this combo contains wordB
          const wordsInNextCombo = db.prepare(
            'SELECT word_id FROM ComboMap WHERE combo_id = ?'
          ).all(nextComboId) as Array<{ word_id: string }>;

          if (wordsInNextCombo.some(w => w.word_id === wordIdB)) {
            return [...current.path, nextComboId];
          }

          queue.push({
            comboId: nextComboId,
            path: [...current.path, nextComboId]
          });
          visited.add(nextComboId);
        }
      }

      // Limit search depth to prevent infinite loops
      if (current.path.length > 10) {
        break;
      }
    }

    return null; // No path found
  }

  /**
   * Get all combos that contain a specific word
   */
  getCombosForWord(wordId: string): string[] {
    return this.graph[wordId] || [];
  }

  /**
   * Rebuild the graph (call after database changes)
   */
  rebuild() {
    this.graph = {};
    this.buildGraph();
  }
}

// Singleton instance
let graphServiceInstance: GraphService | null = null;

export function getGraphService(): GraphService {
  if (!graphServiceInstance) {
    graphServiceInstance = new GraphService();
  }
  return graphServiceInstance;
}

export default GraphService;
