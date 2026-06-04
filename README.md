# TickerClash

TickerClash is a high-frequency multiplayer trading terminal simulation game. Trade virtual stocks of mega-corporations, monitor real-time news shocks, and climb the global net-worth leaderboard.

## Features

- **Multiplayer Lobby & Presence**: Host games and approve incoming join requests from other traders.
- **Real-time Market Shifts**: Stock prices adjust dynamically each turn (tick) based on random walk noise and company-specific news events.
- **Market Impacts**: High-volume purchases drive prices up, while massive sell-offs drag prices down.
- **Cyberpunk UI Aesthetics**: Responsive, interactive dashboard themed with neon styling, interactive sparklines, and a scrolling ticker tape.
- **SQLite Persistence**: Factions/accounts registration, user profiles, game history, and active sessions are stored locally in a relational database.

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Vanilla CSS
- **Backend**: Express (Node.js), SQLite3, bcryptjs, cookie-parser, CORS
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server (runs backend on port 3001, frontend on 5173):
   ```bash
   npm run dev
   ```

3. Open your browser and navigate to `http://localhost:5173`.

### Building for Production

To compile the TypeScript game logic and build the static frontend assets:
```bash
npm run build
```
The compiled output will be in `dist/`. The Express backend can then serve these static assets directly.

## License

MIT
