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
- **Discard Pile (Top):** Horizontal scrolling display showing up to 6 previously played cards in the active round.
- **Current Turn (Center):** Prominent display featuring official game artwork for the active card face (Player 1–4, Nemesis, or Wild), with a clear decision banner for Wild turns.
- **Custom Actions (Middle):** Dedicated button opening a modal for mid-round deck manipulation:
  - **Shuffle Draw Pile:** Re-shuffles remaining unplayed cards in the draw pile while preserving consecutive Nemesis rules (gracefully disabled when 1 or 0 cards remain).
  - **Move Cards:** Move specific cards between the Draw Pile and Discard Pile with precise placement options (**Top**, **Bottom**, or **Shuffled** into the draw pile).
- **Draw Queue (Bottom):** Horizontal queue showing upcoming cards as either card backs or revealed card faces based on the configured visibility option.
- **Next Turn / New Round:** Large, thumb-friendly tap target to advance turns or seamlessly shuffle a new deck for the next round.
- **End Game Control:** Reset the session and return to configuration at any time.

### 5. Custom Actions & Deck Manipulation
Supports card abilities, player relics/spells, and Nemesis effects that manipulate turn order cards during active gameplay:
- **Shuffle Remaining Draw Pile:** Re-randomizes remaining cards in the active round's draw pile without modifying discarded cards or round progression.
- **Move Card Between Piles:**
  - *From Draw to Discard:* Remove an upcoming card and add it to the active round's discard pile.
  - *From Discard to Draw:* Retrieve a discarded card and place it at the **Top**, **Bottom**, or **Shuffled** into the remaining draw pile.
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
- **State Management:** Zustand with `persist` middleware & Zod validation
- **Testing:** Vitest, React Testing Library, jsdom
- **Container / Web Server:** Nginx Alpine (multi-stage Docker build)
- **Security:**
  - Strict Content Security Policy (`img-src 'self' https://aeonsend.wiki.gg data:`)
  - HTTP security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`)
  - Non-root container execution (`nginxuser`)

---

## State Management & API

The core game state is managed via Zustand (`src/store.ts`) with client-side localStorage persistence:

| Property / Method | Type / Signature | Description |
|---|---|---|
| `playerCount` | `number` (1–4) | Number of players in the session |
| `allowConsecutiveNemesis` | `boolean` | Whether consecutive Nemesis turns are allowed |
| `visibilityOption` | `'current' \| 'next' \| 'all'` | Draw pile card preview configuration |
| `isPlaying` | `boolean` | Flag indicating whether a game session is active |
| `drawPile` | `Card[]` | Remaining unplayed cards in current round |
| `discardPile` | `Card[]` | Cards played/discarded during the current round |
| `currentTurn` | `Card \| null` | Currently revealed turn card |
| `roundNumber` | `number` | Current round index (1-based during play) |
| `setPlayerCount(count)` | `(count: number) => void` | Updates configured player count |
| `setAllowConsecutiveNemesis(allow)` | `(allow: boolean) => void` | Toggles consecutive Nemesis rule |
| `setVisibilityOption(opt)` | `(opt: VisibilityOption) => void` | Sets draw pile visibility option |
| `startGame()` | `() => void` | Generates initial deck, applies shuffle, and begins Round 1 |
| `nextTurn()` | `() => void` | Advances turn or starts a new round when draw pile is exhausted |
| `endGame()` | `() => void` | Resets game state and returns to setup screen |
| `shuffleDrawPile()` | `() => void` | Re-shuffles remaining draw pile cards enforcing Nemesis rules |
| `moveCard(source, id, dest, pos)` | `(source, id, dest, pos) => void` | Moves a card between Draw and Discard piles with placement options (`'top'`, `'bottom'`, `'shuffled'`) |

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
