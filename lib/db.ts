import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'bigbean.db');
const db = new Database(dbPath);

// Initialize database schema
export function initDatabase() {
  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // 1. The Atoms (Individual Words)
  db.exec(`
    CREATE TABLE IF NOT EXISTS Words (
      id TEXT PRIMARY KEY,        -- "apple-n-0"
      content TEXT NOT NULL,      -- "apple"
      pos TEXT NOT NULL,          -- "n"
      learnt INTEGER DEFAULT 0    -- 0 = not learnt, 1 = learnt
    );
  `);

  // 2. The Molecules (The Flashcards)
  db.exec(`
    CREATE TABLE IF NOT EXISTS Combos (
      id TEXT PRIMARY KEY,        -- "green-apple-g-0"
      display_text TEXT,          -- "Green Apple"
      image_path TEXT             -- "/images/green-apple.jpg"
    );
  `);

  // 3. The Connections (Graph)
  db.exec(`
    CREATE TABLE IF NOT EXISTS ComboMap (
      combo_id TEXT,
      word_id TEXT,
      PRIMARY KEY (combo_id, word_id),
      FOREIGN KEY(combo_id) REFERENCES Combos(id) ON DELETE CASCADE,
      FOREIGN KEY(word_id) REFERENCES Words(id) ON DELETE CASCADE
    );
  `);

  // Index for fast pathfinding
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_combomap_word ON ComboMap(word_id);
  `);
}

export default db;
