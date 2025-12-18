# BigBean Prototype

A flashcard learning application using "Anchored Chaining" - learning word combinations (Combos) rather than isolated words.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS
- **Database:** SQLite (local file `bigbean.db`)
- **State Management:** React Server Actions + Client Components

## Features

### Core Concept: Anchored Chaining

- **Combos (Molecules):** Flashcards built from multiple words
  - Examples: "Red Apple", "Eat Cake", "Broken Window"
- **Words (Atoms):** Individual words that form combos
  - Types: Nouns (n), Verbs (v), Adjectives (j)

### Learning Modes

1. **Cluster Mode:** See 3-4 cards centered around a target word
2. **Bridge Mode:** Find paths between words via shared combos (using BFS algorithm)

### Spaced Repetition System (SRS)

- **Pass ("I know it"):**
  - Combo: Increases interval using standard SRS
  - Words: Due date nudged forward 2-3 days (no interval change)
  
- **Fail ("Repeat"):**
  - Combo: Reset to interval 0, slightly reduce ease factor
  - Words: No punishment (context failure doesn't affect word knowledge)

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Seed the Database

```bash
npm run seed
```

This creates:
- 91 words (30 nouns, 31 adjectives, 30 verbs)
- 102 combos with logical connections
- 217 word-combo relationships

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start learning!

## Database Structure

### Words Table
```sql
- id: "apple-n-0", "eat-v-0", "green-j-0"
- content: "apple", "eat", "green"
- pos: "n" | "v" | "j" | "pv"
- SRS fields: interval, ease_factor, due_date
```

### Combos Table
```sql
- id: "red-apple-g-0", "eat-cake-g-0"
- display_text: "Red Apple", "Eat Cake"
- image_path: "/images/red-apple.jpg" (placeholder)
- SRS fields: interval, ease_factor, due_date
```

### ComboMap Table
```sql
- combo_id → word_id relationships
- Enables graph-based pathfinding
```

## Project Structure

```
bigbean-prototype/
├── app/
│   ├── actions.ts          # Server actions for DB operations
│   ├── page.tsx            # Main flashcard page
│   └── layout.tsx          # Root layout
├── components/
│   └── Flashcard.tsx       # Flashcard UI component
├── lib/
│   ├── db.ts               # Database initialization
│   ├── graph-service.ts    # BFS pathfinding for Bridge Mode
│   └── types.ts            # TypeScript interfaces
├── scripts/
│   └── seed.ts             # Database seeder
└── bigbean.db              # SQLite database (created on seed)
```

## Usage

### Reviewing Cards

1. The app shows you cards that are due for review
2. Click **"I know it"** if you recognize the combo
3. Click **"Repeat"** if you need to see it again
4. Stats appear in the header:
   - **Green:** Cards due now
   - **Blue:** New cards (never seen)
   - **Gray:** Total cards

### Understanding the System

- **Combo Intervals:** Follow standard SRS (1 day → 6 days → exponential)
- **Word Nudging:** When you pass a combo, constituent words get their due dates pushed forward slightly
- **No Word Punishment:** Failing a combo doesn't hurt individual word stats

## Future Enhancements (Not in Prototype)

- Real images for combos
- Bridge Mode UI (pathfinding visualization)
- Cluster Mode (showing related combos)
- Audio pronunciation
- Custom combo creation
- Export/import data

## Development Notes

### Re-seeding the Database

To reset all data and start fresh:

```bash
npm run seed
```

This will:
1. Drop existing data
2. Create 91 words
3. Generate 102 combos
4. Establish all connections

### Key Design Decisions

1. **In-Memory Graph:** ComboMap is loaded once on startup for fast BFS
2. **Server Actions:** All DB operations are server-side for security
3. **Client Component:** Main page for interactivity and state management
4. **Mobile-First:** UI optimized for phone screens (max-w-md cards)

## License

Prototype for educational purposes.
