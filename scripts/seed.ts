import db, { initDatabase } from '../lib/db';
import { POS } from '../lib/types';

// Seed data from specification
const NOUNS = [
  'apple', 'banana', 'pillow', 'toothbrush', 'tree', 'door', 'scarf', 'car', 
  'phone', 'laptop', 'camera', 'keyboard', 'window', 'cup', 'plate', 'spoon', 
  'knife', 'shirt', 'shoe', 'book', 'bicycle', 'cat', 'dog', 'flower', 'cake', 
  'water', 'coffee', 'sun', 'ball', 'table', 'milk', 'juice', 'tablet', 
  'battery', 'sandwich', 'breakfast', 'orange', 'potato', 'bread', 'cheese',
  'glass', 'vase', 'mirror', 'bike', 'computer', 'problem', 'box', 'present',
  'safe', 'hands', 'face', 'room', 'floor', 'kitchen', 'house', 'ticket',
  'gift', 'truck', 'bus', 'taxi', 'horse', 'motorcycle', 'scooter', 'newspaper',
  'magazine', 'article', 'story', 'letter', 'email', 'note', 'baby', 'umbrella',
  'bag', 'hand', 'frisbee', 'stone', 'garbage', 'fish', 'train', 'can', 'seed',
  'garden', 'plant', 'dinner', 'meal', 'cookies', 'pie', 'bed', 'couch', 'hammock',
  'hat', 'jacket'
];

const ADJECTIVES = [
  'purple', 'red', 'green', 'yellow', 'blue', 'black', 'broken', 'brand-new', 
  'shiny', 'white', 'orange', 'pink', 'big', 'small', 'tall', 'long', 'soft', 
  'hard', 'wet', 'dry', 'dirty', 'clean', 'hot', 'cold', 'empty', 'full', 
  'fast', 'slow', 'heavy', 'light', 'retro', 'ripe', 'fresh', 'fluffy', 'old',
  'locked', 'warm', 'smart', 'digital', 'mechanical', 'wireless', 'open', 
  'silver', 'sharp', 'thick', 'new', 'interesting', 'fat', 'friendly', 
  'beautiful', 'chocolate', 'birthday', 'sweet', 'delicious', 'bright', 
  'bouncy', 'wooden', 'strong'
];

const VERBS = [
  'drink', 'charge', 'eat', 'peel', 'slice', 'break', 'fix', 'open', 'close', 
  'lock', 'unlock', 'wash', 'clean', 'buy', 'sell', 'wear', 'drive', 'ride', 
  'read', 'write', 'hold', 'drop', 'throw', 'catch', 'kick', 'plant', 'water', 
  'cook', 'bake', 'sleep'
];

function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '-');
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function createWordId(word: string, pos: POS, variant: number = 0): string {
  return `${slugify(word)}-${pos}-${variant}`;
}

function createComboId(words: string[], variant: number = 0): string {
  return `${slugify(words.join('-'))}-g-${variant}`;
}

function seedWords() {
  const insertWord = db.prepare(`
    INSERT OR REPLACE INTO Words (id, content, pos, learnt)
    VALUES (?, ?, ?, 0)
  `);

  const insertMany = db.transaction((words: Array<{id: string, content: string, pos: POS}>) => {
    for (const word of words) {
      insertWord.run(word.id, word.content, word.pos);
    }
  });

  const allWords = [
    ...NOUNS.map(n => ({ id: createWordId(n, 'n'), content: n, pos: 'n' as POS })),
    ...ADJECTIVES.map(a => ({ id: createWordId(a, 'j'), content: a, pos: 'j' as POS })),
    ...VERBS.map(v => ({ id: createWordId(v, 'v'), content: v, pos: 'v' as POS }))
  ];

  insertMany(allWords);
  console.log(`✓ Inserted ${allWords.length} words`);
}

function seedCombos() {
  const insertCombo = db.prepare(`
    INSERT OR REPLACE INTO Combos (id, display_text, image_path)
    VALUES (?, ?, ?)
  `);

  const insertComboMap = db.prepare(`
    INSERT OR REPLACE INTO ComboMap (combo_id, word_id)
    VALUES (?, ?)
  `);

  const combos: Array<{
    id: string;
    displayText: string;
    imagePath: string;
    wordIds: string[];
  }> = [];

  // Helper to add a combo
  function addCombo(words: string[], poses: POS[], displayText: string) {
    const comboId = createComboId(words);
    const wordIds = words.map((word, i) => createWordId(word, poses[i]));
    const imagePath = `/images/${slugify(words.join('-'))}.jpg`;
    
    combos.push({
      id: comboId,
      displayText,
      imagePath,
      wordIds
    });
  }

  // Helper to create natural display text for verb + noun
  function makeVerbNounDisplay(verb: string, noun: string): string {
    // Mass nouns and uncountable nouns don't need articles
    const noArticle = ['water', 'coffee', 'milk', 'juice', 'breakfast', 'dinner', 'garbage', 'furniture'];
    const needsArticle = !noArticle.includes(noun);
    
    if (!needsArticle) {
      return `${capitalize(verb)} ${noun}`;
    }
    
    const article = isVowel(noun[0]) ? 'an' : 'a';
    return `${capitalize(verb)} ${article} ${noun}`;
  }

  // Helper to check if character is a vowel
  function isVowel(char: string): boolean {
    return ['a', 'e', 'i', 'o', 'u'].includes(char.toLowerCase());
  }

  // Generate comprehensive Adjective + Noun combos
  // Ensuring every noun appears at least 4 times
  const adjNounPairs: Array<[string, string]> = [
    // apple (5)
    ['red', 'apple'], ['green', 'apple'], ['yellow', 'apple'], ['big', 'apple'], ['small', 'apple'],
    
    // banana (5)
    ['yellow', 'banana'], ['green', 'banana'], ['long', 'banana'], ['ripe', 'banana'], ['fresh', 'banana'],
    
    // pillow (5)
    ['soft', 'pillow'], ['white', 'pillow'], ['big', 'pillow'], ['small', 'pillow'], ['fluffy', 'pillow'],
    
    // toothbrush (4)
    ['wet', 'toothbrush'], ['dry', 'toothbrush'], ['clean', 'toothbrush'], ['blue', 'toothbrush'],
    
    // tree (5)
    ['big', 'tree'], ['tall', 'tree'], ['green', 'tree'], ['old', 'tree'], ['small', 'tree'],
    
    // door (5)
    ['red', 'door'], ['white', 'door'], ['big', 'door'], ['heavy', 'door'], ['locked', 'door'],
    
    // scarf (5)
    ['soft', 'scarf'], ['long', 'scarf'], ['pink', 'scarf'], ['purple', 'scarf'], ['warm', 'scarf'],
    
    // car (6)
    ['brand-new', 'car'], ['fast', 'car'], ['blue', 'car'], ['red', 'car'], ['old', 'car'], ['clean', 'car'],
    
    // phone (5)
    ['broken', 'phone'], ['brand-new', 'phone'], ['black', 'phone'], ['old', 'phone'], ['smart', 'phone'],
    
    // laptop (5)
    ['brand-new', 'laptop'], ['old', 'laptop'], ['black', 'laptop'], ['fast', 'laptop'], ['slow', 'laptop'],
    
    // camera (5)
    ['broken', 'camera'], ['retro', 'camera'], ['brand-new', 'camera'], ['digital', 'camera'], ['old', 'camera'],
    
    // keyboard (5)
    ['retro', 'keyboard'], ['mechanical', 'keyboard'], ['wireless', 'keyboard'], ['broken', 'keyboard'], ['clean', 'keyboard'],
    
    // window (5)
    ['broken', 'window'], ['clean', 'window'], ['big', 'window'], ['dirty', 'window'], ['open', 'window'],
    
    // cup (5)
    ['empty', 'cup'], ['full', 'cup'], ['clean', 'cup'], ['small', 'cup'], ['blue', 'cup'],
    
    // plate (5)
    ['broken', 'plate'], ['dirty', 'plate'], ['full', 'plate'], ['clean', 'plate'], ['empty', 'plate'],
    
    // spoon (4)
    ['shiny', 'spoon'], ['clean', 'spoon'], ['silver', 'spoon'], ['dirty', 'spoon'],
    
    // knife (4)
    ['shiny', 'knife'], ['sharp', 'knife'], ['clean', 'knife'], ['dirty', 'knife'],
    
    // shirt (5)
    ['dry', 'shirt'], ['pink', 'shirt'], ['blue', 'shirt'], ['clean', 'shirt'], ['dirty', 'shirt'],
    
    // shoe (4)
    ['red', 'shoe'], ['black', 'shoe'], ['dirty', 'shoe'], ['clean', 'shoe'],
    
    // book (5)
    ['big', 'book'], ['old', 'book'], ['thick', 'book'], ['new', 'book'], ['interesting', 'book'],
    
    // bicycle (5)
    ['slow', 'bicycle'], ['retro', 'bicycle'], ['red', 'bicycle'], ['old', 'bicycle'], ['fast', 'bicycle'],
    
    // cat (5)
    ['black', 'cat'], ['orange', 'cat'], ['white', 'cat'], ['fat', 'cat'], ['small', 'cat'],
    
    // dog (5)
    ['white', 'dog'], ['black', 'dog'], ['big', 'dog'], ['small', 'dog'], ['friendly', 'dog'],
    
    // flower (5)
    ['purple', 'flower'], ['pink', 'flower'], ['red', 'flower'], ['yellow', 'flower'], ['beautiful', 'flower'],
    
    // cake (5)
    ['chocolate', 'cake'], ['birthday', 'cake'], ['big', 'cake'], ['sweet', 'cake'], ['delicious', 'cake'],
    
    // coffee (4)
    ['hot', 'coffee'], ['cold', 'coffee'], ['black', 'coffee'], ['strong', 'coffee'],
    
    // sun (4)
    ['yellow', 'sun'], ['bright', 'sun'], ['hot', 'sun'], ['warm', 'sun'],
    
    // ball (5)
    ['red', 'ball'], ['blue', 'ball'], ['big', 'ball'], ['small', 'ball'], ['bouncy', 'ball'],
    
    // table (5)
    ['big', 'table'], ['heavy', 'table'], ['wooden', 'table'], ['clean', 'table'], ['dirty', 'table']
  ];

  for (const [adj, noun] of adjNounPairs) {
    addCombo([adj, noun], ['j', 'n'], `${capitalize(adj)} ${capitalize(noun)}`);
  }

  // Generate comprehensive Verb + Noun combos with natural articles
  // Ensuring every verb appears at least 4 times
  const verbNounPairs: Array<[string, string]> = [
    // drink (4)
    ['drink', 'water'], ['drink', 'coffee'], ['drink', 'milk'], ['drink', 'juice'],
    
    // charge (4)
    ['charge', 'phone'], ['charge', 'laptop'], ['charge', 'tablet'], ['charge', 'battery'],
    
    // eat (5)
    ['eat', 'apple'], ['eat', 'banana'], ['eat', 'cake'], ['eat', 'sandwich'], ['eat', 'breakfast'],
    
    // peel (4)
    ['peel', 'banana'], ['peel', 'apple'], ['peel', 'orange'], ['peel', 'potato'],
    
    // slice (4)
    ['slice', 'apple'], ['slice', 'cake'], ['slice', 'bread'], ['slice', 'cheese'],
    
    // break (5)
    ['break', 'window'], ['break', 'plate'], ['break', 'glass'], ['break', 'vase'], ['break', 'mirror'],
    
    // fix (5)
    ['fix', 'car'], ['fix', 'phone'], ['fix', 'bike'], ['fix', 'computer'], ['fix', 'problem'],
    
    // open (5)
    ['open', 'door'], ['open', 'window'], ['open', 'book'], ['open', 'box'], ['open', 'present'],
    
    // close (5)
    ['close', 'door'], ['close', 'window'], ['close', 'book'], ['close', 'box'], ['close', 'laptop'],
    
    // lock (4)
    ['lock', 'door'], ['lock', 'car'], ['lock', 'bike'], ['lock', 'safe'],
    
    // unlock (4)
    ['unlock', 'door'], ['unlock', 'car'], ['unlock', 'phone'], ['unlock', 'safe'],
    
    // wash (5)
    ['wash', 'plate'], ['wash', 'cup'], ['wash', 'car'], ['wash', 'hands'], ['wash', 'face'],
    
    // clean (5)
    ['clean', 'table'], ['clean', 'window'], ['clean', 'room'], ['clean', 'floor'], ['clean', 'kitchen'],
    
    // buy (5)
    ['buy', 'book'], ['buy', 'car'], ['buy', 'house'], ['buy', 'ticket'], ['buy', 'gift'],
    
    // sell (4)
    ['sell', 'bicycle'], ['sell', 'car'], ['sell', 'house'], ['sell', 'ticket'],
    
    // wear (5)
    ['wear', 'shirt'], ['wear', 'shoe'], ['wear', 'scarf'], ['wear', 'hat'], ['wear', 'jacket'],
    
    // drive (4)
    ['drive', 'car'], ['drive', 'truck'], ['drive', 'bus'], ['drive', 'taxi'],
    
    // ride (4)
    ['ride', 'bicycle'], ['ride', 'horse'], ['ride', 'motorcycle'], ['ride', 'scooter'],
    
    // read (5)
    ['read', 'book'], ['read', 'newspaper'], ['read', 'magazine'], ['read', 'article'], ['read', 'story'],
    
    // write (5)
    ['write', 'book'], ['write', 'letter'], ['write', 'email'], ['write', 'story'], ['write', 'note'],
    
    // hold (5)
    ['hold', 'cup'], ['hold', 'baby'], ['hold', 'umbrella'], ['hold', 'bag'], ['hold', 'hand'],
    
    // drop (4)
    ['drop', 'plate'], ['drop', 'cup'], ['drop', 'ball'], ['drop', 'phone'],
    
    // throw (4)
    ['throw', 'ball'], ['throw', 'frisbee'], ['throw', 'stone'], ['throw', 'garbage'],
    
    // catch (4)
    ['catch', 'ball'], ['catch', 'fish'], ['catch', 'bus'], ['catch', 'train'],
    
    // kick (4)
    ['kick', 'ball'], ['kick', 'door'], ['kick', 'stone'], ['kick', 'can'],
    
    // plant (4)
    ['plant', 'flower'], ['plant', 'tree'], ['plant', 'seed'], ['plant', 'garden'],
    
    // water (4)
    ['water', 'flower'], ['water', 'tree'], ['water', 'plant'], ['water', 'garden'],
    
    // cook (4)
    ['cook', 'cake'], ['cook', 'dinner'], ['cook', 'breakfast'], ['cook', 'meal'],
    
    // bake (4)
    ['bake', 'cake'], ['bake', 'bread'], ['bake', 'cookies'], ['bake', 'pie'],
    
    // sleep (4)
    ['sleep', 'bed'], ['sleep', 'floor'], ['sleep', 'couch'], ['sleep', 'hammock']
  ];

  for (const [verb, noun] of verbNounPairs) {
    addCombo([verb, noun], ['v', 'n'], makeVerbNounDisplay(verb, noun));
  }

  // Insert all combos
  const insertAll = db.transaction(() => {
    for (const combo of combos) {
      insertCombo.run(combo.id, combo.displayText, combo.imagePath);
      for (const wordId of combo.wordIds) {
        try {
          insertComboMap.run(combo.id, wordId);
        } catch (error) {
          console.error(`Failed to insert combo ${combo.id} with word ${wordId}`);
          console.error(`Display text: ${combo.displayText}`);
          throw error;
        }
      }
    }
  });

  insertAll();
  console.log(`✓ Inserted ${combos.length} combos`);
}

function seed() {
  console.log('🌱 Starting database seed...\n');
  
  // Initialize database
  initDatabase();
  console.log('✓ Database schema initialized\n');
  
  // Clear existing data
  db.prepare('DELETE FROM ComboMap').run();
  db.prepare('DELETE FROM Combos').run();
  db.prepare('DELETE FROM Words').run();
  console.log('✓ Cleared existing data\n');
  
  // Seed data
  seedWords();
  seedCombos();
  
  // Show statistics
  const wordCount = db.prepare('SELECT COUNT(*) as count FROM Words').get() as { count: number };
  const comboCount = db.prepare('SELECT COUNT(*) as count FROM Combos').get() as { count: number };
  const mapCount = db.prepare('SELECT COUNT(*) as count FROM ComboMap').get() as { count: number };
  
  console.log('\n📊 Database Statistics:');
  console.log(`   Words: ${wordCount.count}`);
  console.log(`   Combos: ${comboCount.count}`);
  console.log(`   Connections: ${mapCount.count}`);
  console.log('\n✅ Seed completed successfully!');
}

// Run seed
seed();
db.close();
