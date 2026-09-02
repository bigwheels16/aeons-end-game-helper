# Aeon's End Companion Tools

A mobile-optimized, client-side web application suite designed for the cooperative deck-building board game **Aeon's End**. The suite provides two core tools:
1. **Turn Order Helper:** Randomizes, tracks, and manipulates turn order decks with official rules, visibility settings, drag-and-drop mid-round edits, and wake lock support.
2. **Card Search:** A fast, multi-expansion card browser and lookup tool covering Gems, Relics, and Spells across 13 sets with debounced text search, type filters, expansion chips, cost range sliders, and sanitized HTML effect rendering.
3. **Mage Search:**
4. **Nemesis Search:**

See a live version here: https://aeons-end.jkbff.com/

---

## Features

### 1. Turn Order Helper

#### Game Setup & Configuration
- **Player Count:** Supports standard 1 to 4 player counts with official card distributions, as well as a **Custom** option for constructing user-defined turn order decks.
- **Consecutive Turns:** Option to allow or prevent consecutive Nemesis turns or same-player turns.
- **Card Visibility:**
  - *Current turn:* Displays only the current turn card face; all draw pile cards are shown face-down. (default)
  - *Current and next turn:* Shows the current turn card and reveals the next upcoming card in the draw pile.
  - *All turns:* Reveals all upcoming turn cards in the round.

#### Nemesis Turn Rules & Shuffling Logic
- **Consecutive Nemesis Prevention:** When disabled, the deck engine ensures no two Nemesis cards appear consecutively within a round.
- **Cross-Round Transitions:** If the previous round concluded on a Nemesis turn, the subsequent round will not begin with a Nemesis turn upon reshuffling.
- **Unavoidable Case Fallback:** If the remaining cards in a deck are all Nemesis cards, the rule is gracefully suspended.

#### Custom Actions & Deck Manipulation
Supports card abilities, player relics/spells, and Nemesis effects that manipulate turn order cards during active gameplay:
- **Shuffle Remaining Draw Pile**
- **Move Cards**
- **Reveal Cards**
- **Show Turn History**

---

### 2. Card Search Tool

The integrated **Card Search** tool allows quick browsing, searching, and filtering of player market cards (Gems, Relics, Spells).

---

### 3. Mage Search Tool

The integrated **Mage Search** tool allows quick browsing, searching, and filtering of mages.

---

### 4. Nemesis Search Tool

The integrated **Nemesis Search** tool allows quick browsing, searching, and filtering of Nemesis.

---

### 5. Offline & Session Persistence

Once the tool has been loaded in the browser, no network connection is needed.  All functionality executes locally (except for card and mat images).

---

## Artwork & Assets

Official card faces and card backs for the turn order deck are sourced directly from the [Aeon's End Wiki](https://aeonsend.wiki.gg/wiki/Turn_Order_Deck):

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

The application includes a multi-stage `Dockerfile` and `nginx.conf` designed for deployment to any container runtime.

### Build and Run Locally with Docker
```bash
# Build Docker image
docker build -t aeons-end-turn-order .

# Run container on port 8080
docker run -p 8080:8080 aeons-end-turn-order
```
Access the application at `http://localhost:8080`.
