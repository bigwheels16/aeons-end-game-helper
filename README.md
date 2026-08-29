# Aeon's End Turn Order Randomizer

A mobile-optimized, client-side web application designed to randomize and manage turn order for the cooperative deck-building board game **Aeon's End**.

---

## Features

### 1. Game Setup & Configuration
- **Player Count:** Supports 1 to 4 players with official card distributions.
- **Nemesis Rules:** Option to allow or prevent consecutive Nemesis turns.
- **Visibility Options:**
  - *Current only:* Displays only the current turn card face; all draw pile cards are shown face-down.
  - *Current + Next:* Shows the current turn card and reveals the next upcoming card in the draw pile.
  - *All following:* Reveals all upcoming turn cards in the round.
- **Start Game:** Instantly initializes the deck, applies shuffling rules, and launches Round 1.

### 2. Turn Order Deck Logic
Decks are constructed according to official Aeon's End rules:
- **1 Player:** 3x Player 1, 2x Nemesis (5 cards total)
- **2 Players:** 2x Player 1, 2x Player 2, 2x Nemesis (6 cards total)
- **3 Players:** 1x Player 1, 1x Player 2, 1x Player 3, 1x Wild, 2x Nemesis (6 cards total)
- **4 Players:** 1x Player 1, 1x Player 2, 1x Player 3, 1x Player 4, 2x Nemesis (6 cards total)

### 3. Nemesis Turn Rules & Shuffling Logic
- **Consecutive Nemesis Prevention:** When disabled, the deck engine ensures no two Nemesis cards appear consecutively within a round.
- **Cross-Round Transitions:** If the previous round concluded on a Nemesis turn, the subsequent round will not begin with a Nemesis turn upon reshuffling.
- **Unavoidable Case Fallback:** If the remaining cards in a deck are all Nemesis cards, the rule is gracefully suspended.

### 4. Interactive Gameplay Screen
- **Header & Navigation (Top):** Header bar displaying the current round number alongside top-level controls:
  - **Custom Actions:** Opens the mid-round deck manipulation modal (Shuffle Draw Pile, Edit Mode, Reveal Cards). Positioned directly in the top header adjacent to End Game for immediate accessibility without obstructing turn cards.
  - **End Game:** Resets the session and returns to setup configuration at any time.
- **Discard Pile (Top):** Horizontal scrolling display showing up to 6 previously played cards in the active round. All cards in the discard pile are rendered face-up with their official artwork (`isRevealed: true`).
- **Current Turn (Center):** Prominent display featuring official game artwork for the active card face (Player 1–4, Nemesis, or Wild), with a clear decision banner for Wild turns. The active turn is directly represented by the top card of the discard pile (`discardPile[discardPile.length - 1]`), rather than a separate disconnected state, enabling it to be moved or rearranged manually if needed.
- **Draw Queue (Bottom):** Horizontal queue showing upcoming cards. Face orientation (face-up artwork vs card back) is governed directly and solely by each card's `isRevealed` property, populated dynamically based on the configured visibility option or manual reveals.
- **Next Turn / New Round:** Large, thumb-friendly tap target to advance turns or seamlessly shuffle a new deck for the next round. When a card is drawn, it is moved to the discard pile with `isRevealed: true`.
- **Mobile Viewport Optimization:** Styled with dynamic viewport units (`100dvh`) and flex layout constraints to guarantee that all gameplay elements—including header controls, discard pile, active turn card, draw queue, and the Next Turn button—fit completely within mobile screens without requiring page scrolling.

### 5. Custom Actions & Deck Manipulation
Supports card abilities, player relics/spells, and Nemesis effects that manipulate turn order cards during active gameplay:
- **Inline Drag-and-Drop Edit Mode (`@dnd-kit`):**
  - *Inter-Pile Transfers:* Drag cards seamlessly between the Draw Pile and Discard Pile (including the currently active turn card on top of the Discard Pile).
  - *Intra-Pile Reordering:* Rearrange the specific order of cards within either pile by dragging them to the desired position.
  - *Empty Pile Drop Zones:* Dedicated droppable zones allow dragging cards into piles even when they are completely empty.
  - *Frozen Visibility State:* Cards maintain their snapshot face-up or face-down visual state (captured from each card's `isRevealed` status) while being dragged, and only re-evaluate visibility against game settings after saving.
  - *Consecutive Nemesis Exemption:* Manual card arrangements committed in Edit Mode are honored as intentional player choices (e.g. resolving card effects), bypassing automatic consecutive Nemesis prevention.
  - *State Integrity Validation:* Deck integrity checks prevent accidental card duplication or deletion by validating that the total card count across both piles is strictly preserved before saving.
  - *Save & Cancel Controls:* "Save" commits the newly arranged piles to active game state (marking discard cards as `isRevealed: true` and applying visibility settings to draw pile cards) and displays a success or error notification based on validation; "Cancel" discards all local edits and reverts piles to their previous state without mutating gameplay.
- **Shuffle Remaining Draw Pile:** Re-randomizes remaining cards in the active round's draw pile without modifying discarded cards or round progression, resetting reveals and re-applying visibility settings. A success notification confirms the action.
- **Reveal Cards from Draw Pile:** Opens an interactive visual modal allowing players to select any unrevealed cards in the draw pile to reveal (`isRevealed: true`) or cancel without making changes. Already revealed cards are indicated and disabled from selection. Revealed state persists even if cards are moved during Edit Mode, but is cleared when drawn or when the draw pile is shuffled. A success notification confirms the action.
- **Dynamic Visibility Updates:** Revealed cards instantly update when cards are moved or shuffled according to the active visibility setting (*Current + Next* or *All following*).

### 6. Offline & Session Persistence
- **Client-Side State:** Uses Zustand with `localStorage` persistence and Zod schema validation to preserve game state across accidental browser refreshes or reloads.
- **Zero Ongoing Network Calls:** Once initial assets are loaded, all turn logic executes entirely client-side.

---

## Artwork & Assets

Official card faces and card backs are sourced directly from the [Aeon's End Wiki](https://aeonsend.wiki.gg/wiki/Turn_Order_Deck):
- Player 1–4 Cards
- Nemesis Card
- Wild Card
- Turn Order Card Back

---

## Tech Stack & Architecture

- **Frontend:** React 18, TypeScript, Vite
- **Drag and Drop:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- **State Management:** Zustand with `persist` middleware & Zod validation
- **Testing:** Vitest, React Testing Library, jsdom
- **Container / Web Server:** Nginx Alpine (multi-stage Docker build)
- **Security:**
  - Strict Content Security Policy (`img-src 'self' https://aeonsend.wiki.gg data:`)
  - HTTP security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`)
  - Non-root container execution (`nginxuser`)

---

## Data Model & State Management

### Card Data Model

Each card object in the turn order deck conforms to the `Card` interface:

| Property | Type | Description |
|---|---|---|
| `id` | `string` | Unique identifier for the card instance within a round (e.g. `'Player 1-0'`, `'Nemesis-1'`). |
| `type` | `CardType` | Turn designation: `'Player 1'`, `'Player 2'`, `'Player 3'`, `'Player 4'`, `'Nemesis'`, or `'Wild'`. |
| `imageFaceUrl` | `string` | URL path to the card's official face artwork. |
| `isRevealed` | `boolean \| undefined` | **Single source of truth for card face orientation.** When `true`, the card renders face-up showing its artwork; when `false` or `undefined`, the card renders face-down showing the turn order card back. |

### State Management & API

The core game state is managed via Zustand (`src/store.ts`) with client-side localStorage persistence:

| Property / Method | Type / Signature | Description |
|---|---|---|
| `playerCount` | `number` (1–4) | Number of players in the session |
| `allowConsecutiveNemesis` | `boolean` | Whether consecutive Nemesis turns are allowed |
| `visibilityOption` | `'current' \| 'next' \| 'all'` | Draw pile card preview configuration |
| `isPlaying` | `boolean` | Flag indicating whether a game session is active |
| `drawPile` | `Card[]` | Remaining unplayed cards in current round (face orientation driven by `isRevealed`) |
| `discardPile` | `Card[]` | Cards played/discarded during the current round with `isRevealed: true` (the top card, `discardPile[discardPile.length - 1]`, represents the active turn) |
| `roundNumber` | `number` | Current round index (1-based during play) |
| `setPlayerCount(count)` | `(count: number) => void` | Updates configured player count |
| `setAllowConsecutiveNemesis(allow)` | `(allow: boolean) => void` | Toggles consecutive Nemesis rule |
| `setVisibilityOption(opt)` | `(opt: VisibilityOption) => void` | Sets draw pile visibility option |
| `startGame()` | `() => void` | Generates initial deck, applies shuffle, sets `isRevealed` based on visibility settings, and begins Round 1 |
| `nextTurn()` | `() => void` | Advances turn or starts a new round when draw pile is exhausted, marking drawn cards with `isRevealed: true` |
| `endGame()` | `() => void` | Resets game state and returns to setup screen |
| `shuffleDrawPile()` | `() => void` | Re-shuffles remaining draw pile cards, clearing reveals and reapplying visibility settings |
| `revealCards(indices)` | `(indices: number[]) => void` | Manually sets `isRevealed: true` on the specified cards in the draw pile by index until drawn or shuffled |
| `moveCard(source, id, dest, pos)` | `(source, id, dest, pos) => void` | Moves a card between Draw and Discard piles with placement options (`'top'`, `'bottom'`, `'shuffled'`), updating `isRevealed` accordingly |
| `setPiles(newDrawPile, newDiscardPile)` | `(newDrawPile: Card[], newDiscardPile: Card[]) => boolean` | Commits validated draw and discard piles from Edit Mode, setting discard cards to `isRevealed: true` and applying visibility to draw pile, returning true on success and false on failure |

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation
```bash
# Clone the repository and navigate to the project directory
cd aeons-end-turn-order

# Install dependencies
npm install
```

### Development Scripts
```bash
# Start Vite development server
npm run dev

# Run unit and integration tests
npm test

# Build production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## Docker & Container Deployment

The application includes a multi-stage `Dockerfile` and `nginx.conf` designed for deployment to **Google Cloud Run** or any container runtime.

### Build and Run Locally with Docker
```bash
# Build Docker image
docker build -t aeons-end-turn-order .

# Run container on port 8080
docker run -p 8080:8080 aeons-end-turn-order
```
Access the application at `http://localhost:8080`.

### Deploy to Google Cloud Run
```bash
# Build and submit image to Google Container Registry / Artifact Registry
gcloud builds submit --tag gcr.io/<PROJECT_ID>/aeons-end-turn-order

# Deploy to Cloud Run
gcloud run deploy aeons-end-turn-order \
  --image gcr.io/<PROJECT_ID>/aeons-end-turn-order \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080
```
