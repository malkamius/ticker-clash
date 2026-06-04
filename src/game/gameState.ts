// Shared Game Engine for TickerClash Multiplayer Game

export interface Company {
  id: string;
  name: string;
  symbol: string;
  price: number;
  priceHistory: number[];
  volatility: number;
  baseTrend: number;
  sharesOutstanding: number;
  description: string;
}

export interface Player {
  id: string;
  name: string;
  assignedEmail: string | null;
  cash: number;
  portfolio: { [companyId: string]: number }; // companyId -> quantity owned
  netWorthHistory: number[];
  isHost: boolean;
  endedTurn: boolean;
  lost: boolean;
  isAi?: boolean;
  aiDifficulty?: 'easy' | 'medium' | 'hard';
  isLocal?: boolean;
}

export interface MarketEvent {
  tick: number;
  headline: string;
  impacts: { [companyId: string]: number }; // companyId -> fractional price change multiplier (e.g., +0.2 for +20%)
}

export interface GameState {
  gameId: string;
  name: string;
  status: 'setup' | 'active' | 'completed';
  currentTick: number;
  maxTicks: number;
  companies: Company[];
  players: Player[];
  marketEvents: MarketEvent[];
  turnStyle: 'sequential' | 'simultaneous';
  activePlayerIdx: number;
  updatedAt: string;
}

// Simple helper to generate unique IDs in both Node and Browser environments
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

const DEFAULT_COMPANIES: Omit<Company, 'id' | 'priceHistory'>[] = [
  {
    name: "Megacorp Conglomerate",
    symbol: "MEGA",
    price: 150,
    volatility: 0.03,
    baseTrend: 0.003,
    sharesOutstanding: 1000000,
    description: "Diverse global market leader in consumer goods, infrastructure, and heavy industry."
  },
  {
    name: "Cyberdyne Systems",
    symbol: "CYBD",
    price: 85,
    volatility: 0.12,
    baseTrend: 0.012,
    sharesOutstanding: 500000,
    description: "Advanced artificial intelligence, autonomous robotics, and cybernetic hardware."
  },
  {
    name: "Stark Industries",
    symbol: "STRK",
    price: 120,
    volatility: 0.07,
    baseTrend: 0.007,
    sharesOutstanding: 750000,
    description: "Next-gen fusion clean energy, aerospace defence, and nanotechnology development."
  },
  {
    name: "Wayne Enterprises",
    symbol: "WAYN",
    price: 110,
    volatility: 0.05,
    baseTrend: 0.005,
    sharesOutstanding: 800000,
    description: "Satellite telecommunications, international logistics, and smart city infrastructure."
  },
  {
    name: "Umbrella Corp",
    symbol: "UMBR",
    price: 45,
    volatility: 0.20,
    baseTrend: -0.005,
    sharesOutstanding: 1500000,
    description: "Experimental pharmaceuticals, genetic research, and biochemical applications."
  },
  {
    name: "Aperture Science",
    symbol: "APER",
    price: 65,
    volatility: 0.15,
    baseTrend: 0.002,
    sharesOutstanding: 600000,
    description: "Quantum tunneling, portal mechanics, shower curtain manufacturing, and AI research."
  },
  {
    name: "Tyrell Nexus Corp",
    symbol: "TYRL",
    price: 95,
    volatility: 0.09,
    baseTrend: 0.009,
    sharesOutstanding: 650000,
    description: "Bio-engineered organic Replicants, neural mapping, and synthetic ecosystem design."
  },
  {
    name: "Virtucon Industries",
    symbol: "VIRT",
    price: 30,
    volatility: 0.06,
    baseTrend: 0.002,
    sharesOutstanding: 2000000,
    description: "Global conglomerate specializing in media, mining, steel production, and retail."
  }
];

const MARKET_NEWS_TEMPLATES: { headline: string; type: 'positive' | 'negative' | 'neutral'; volatilityMultiplier: number; baseImpact: number }[] = [
  { headline: "announces breakthroughs in battery efficiency, shares climb.", type: 'positive', volatilityMultiplier: 1.2, baseImpact: 0.15 },
  { headline: "suffers database breach, security concerns spark selloff.", type: 'negative', volatilityMultiplier: 2.0, baseImpact: -0.22 },
  { headline: "awarded massive government defense contract.", type: 'positive', volatilityMultiplier: 1.0, baseImpact: 0.18 },
  { headline: "facing antitrust investigation by international regulators.", type: 'negative', volatilityMultiplier: 1.5, baseImpact: -0.15 },
  { headline: "reports earnings beating analysts estimates, stock surges.", type: 'positive', volatilityMultiplier: 1.1, baseImpact: 0.12 },
  { headline: "CEO unexpectedly steps down citing personal health reasons.", type: 'neutral', volatilityMultiplier: 2.5, baseImpact: -0.05 },
  { headline: "launches highly anticipated consumer product line to positive reviews.", type: 'positive', volatilityMultiplier: 1.0, baseImpact: 0.10 },
  { headline: "recalls defective products after quality control failures.", type: 'negative', volatilityMultiplier: 1.8, baseImpact: -0.18 },
  { headline: "rumored to be negotiating a major strategic merger.", type: 'positive', volatilityMultiplier: 2.0, baseImpact: 0.20 }
];

export function initializeGame(options: {
  name?: string;
  turnStyle?: 'sequential' | 'simultaneous';
  maxTicks?: number;
  startingCash?: number;
  maxPlayers?: number;
  hostName: string;
  hostEmail: string | null;
}): GameState {
  const gameId = generateId();
  const name = options.name || generateRandomGameName();
  const turnStyle = options.turnStyle || 'simultaneous';
  const maxTicks = (options.maxTicks !== undefined && options.maxTicks !== null) ? options.maxTicks : 40;
  const startingCash = options.startingCash || 100000;
  const maxPlayers = options.maxPlayers || 4;

  const companies: Company[] = DEFAULT_COMPANIES.map(c => ({
    id: generateId(),
    name: c.name,
    symbol: c.symbol,
    price: c.price,
    priceHistory: [c.price],
    volatility: c.volatility,
    baseTrend: c.baseTrend,
    sharesOutstanding: c.sharesOutstanding,
    description: c.description
  }));

  // Pre-simulate 100 ticks of history to populate charts and AI data pools
  const marketEvents: MarketEvent[] = [];
  for (let i = 1; i <= 100; i++) {
    const histTick = i - 100; // -99 to 0
    let activeEvent: MarketEvent | null = null;
    if (Math.random() < 0.25 && companies.length > 0) {
      const targetCompany = companies[Math.floor(Math.random() * companies.length)];
      const template = MARKET_NEWS_TEMPLATES[Math.floor(Math.random() * MARKET_NEWS_TEMPLATES.length)];
      
      const randomFactor = 0.8 + Math.random() * 0.4;
      const impactVal = template.baseImpact * randomFactor * (1 + targetCompany.volatility);

      activeEvent = {
        tick: histTick,
        headline: `[EVENT] ${targetCompany.symbol}: ${template.headline}`,
        impacts: { [targetCompany.id]: impactVal }
      };
      marketEvents.push(activeEvent);
    }

    companies.forEach(c => {
      const prevPrice = c.price;
      const baseTrend = c.baseTrend;
      const volatility = c.volatility;

      let rand = 0;
      for (let j = 0; j < 6; j++) {
        rand += Math.random();
      }
      const shock = (rand - 3) / 3;

      let pctChange = baseTrend + (shock * volatility);
      if (activeEvent && activeEvent.impacts[c.id] !== undefined) {
        pctChange += activeEvent.impacts[c.id];
      }

      pctChange = Math.max(-0.5, Math.min(0.5, pctChange));

      let nextPrice = Math.max(1, prevPrice * (1 + pctChange));
      nextPrice = Math.round(nextPrice * 100) / 100;

      c.price = nextPrice;
      c.priceHistory.push(nextPrice);
    });
  }

  const host: Player = {
    id: generateId(),
    name: options.hostName,
    assignedEmail: options.hostEmail,
    cash: startingCash,
    portfolio: {},
    netWorthHistory: [startingCash],
    isHost: true,
    endedTurn: false,
    lost: false,
    isLocal: true
  };

  const players: Player[] = [host];
  for (let i = 2; i <= maxPlayers; i++) {
    const emptyPlayer: Player = {
      id: `player_${i}`,
      name: `Trader ${i}`,
      assignedEmail: null,
      cash: startingCash,
      portfolio: {},
      netWorthHistory: [startingCash],
      isHost: false,
      endedTurn: false,
      lost: false,
      isLocal: true
    };
    players.push(emptyPlayer);
  }

  // Populate portfolios for all players
  players.forEach(p => {
    companies.forEach(c => {
      p.portfolio[c.id] = 0;
    });
  });

  return {
    gameId,
    name,
    status: 'setup',
    currentTick: 0,
    maxTicks,
    companies,
    players,
    marketEvents,
    turnStyle,
    activePlayerIdx: 0,
    updatedAt: new Date().toISOString()
  };
}

export function calculateNetWorth(player: Player, companies: Company[]): number {
  let stockValue = 0;
  companies.forEach(c => {
    const shares = player.portfolio[c.id] || 0;
    stockValue += shares * c.price;
  });
  return Math.round((player.cash + stockValue) * 100) / 100;
}

export function tickMarket(state: GameState): GameState {
  const nextTick = state.currentTick + 1;
  const events: MarketEvent[] = [];

  // Generate a random market event with a 25% chance
  let activeEvent: MarketEvent | null = null;
  if (Math.random() < 0.25 && state.companies.length > 0) {
    const targetCompany = state.companies[Math.floor(Math.random() * state.companies.length)];
    const template = MARKET_NEWS_TEMPLATES[Math.floor(Math.random() * MARKET_NEWS_TEMPLATES.length)];
    
    // Impact amount influenced by company volatility
    const randomFactor = 0.8 + Math.random() * 0.4; // 80% to 120% of base impact
    const impactVal = template.baseImpact * randomFactor * (1 + targetCompany.volatility);

    activeEvent = {
      tick: nextTick,
      headline: `[EVENT] ${targetCompany.symbol}: ${template.headline}`,
      impacts: { [targetCompany.id]: impactVal }
    };
    events.push(activeEvent);
  }

  // Update stock prices
  const updatedCompanies = state.companies.map(c => {
    const prevPrice = c.price;
    const baseTrend = c.baseTrend;
    const volatility = c.volatility;

    // Standard random shock (Gaussian approximation using Central Limit Theorem)
    let rand = 0;
    for (let i = 0; i < 6; i++) {
      rand += Math.random();
    }
    const shock = (rand - 3) / 3; // range approx -1.0 to 1.0

    // Calculate percentage change
    let pctChange = baseTrend + (shock * volatility);

    // Add news event impact if applicable
    if (activeEvent && activeEvent.impacts[c.id] !== undefined) {
      pctChange += activeEvent.impacts[c.id];
    }

    // Cap the percentage change to reasonable bounds (-50% to +50% per tick)
    pctChange = Math.max(-0.5, Math.min(0.5, pctChange));

    let nextPrice = Math.max(1, prevPrice * (1 + pctChange));
    nextPrice = Math.round(nextPrice * 100) / 100;

    return {
      ...c,
      price: nextPrice,
      priceHistory: [...c.priceHistory, nextPrice]
    };
  });

  // Update players net worth and reset endedTurn status
  const updatedPlayers = state.players.map(p => {
    const netWorth = calculateNetWorth(p, updatedCompanies);
    return {
      ...p,
      endedTurn: false,
      netWorthHistory: [...p.netWorthHistory, netWorth]
    };
  });

  const nextStatus = (state.maxTicks > 0 && nextTick >= state.maxTicks) ? 'completed' : state.status;

  const nextState: GameState = {
    ...state,
    status: nextStatus,
    currentTick: nextTick,
    companies: updatedCompanies,
    players: updatedPlayers,
    marketEvents: [...state.marketEvents, ...events],
    activePlayerIdx: 0,
    updatedAt: new Date().toISOString()
  };

  return executeAiTurns(nextState);
}

export function executeAction(
  state: GameState,
  action: { type: 'buy' | 'sell'; companyId: string; quantity: number },
  playerId: string
): GameState {
  if (state.status !== 'active') {
    throw new Error('Game session is not active.');
  }

  const playerIdx = state.players.findIndex(p => p.id === playerId);
  if (playerIdx === -1) {
    throw new Error('Player not found in game session.');
  }

  const player = state.players[playerIdx];
  const companyIdx = state.companies.findIndex(c => c.id === action.companyId);
  if (companyIdx === -1) {
    throw new Error('Company stock not found.');
  }

  const company = state.companies[companyIdx];
  const qty = Math.floor(action.quantity);
  if (qty <= 0) {
    throw new Error('Quantity must be greater than zero.');
  }

  const updatedPlayers = [...state.players];
  const updatedCompanies = [...state.companies];

  if (action.type === 'buy') {
    const totalCost = qty * company.price;
    if (player.cash < totalCost) {
      throw new Error('Insufficient capital for stock purchase.');
    }

    // Modify player cash and holdings
    const currentOwned = player.portfolio[company.id] || 0;
    const nextPlayer: Player = {
      ...player,
      cash: Math.round((player.cash - totalCost) * 100) / 100,
      portfolio: {
        ...player.portfolio,
        [company.id]: currentOwned + qty
      }
    };
    nextPlayer.netWorthHistory[nextPlayer.netWorthHistory.length - 1] = calculateNetWorth(nextPlayer, state.companies);
    updatedPlayers[playerIdx] = nextPlayer;

    // MARKET IMPACT: Buying stock drives up the price slightly due to demand
    const purchaseFraction = qty / company.sharesOutstanding;
    // Price shift: +5% for buying 10% of company outstanding shares
    const impactFactor = 0.5; // multiplier
    const priceShift = 1 + (purchaseFraction * impactFactor);
    const nextPrice = Math.round(company.price * priceShift * 100) / 100;

    updatedCompanies[companyIdx] = {
      ...company,
      price: nextPrice,
      priceHistory: company.priceHistory.map((val, idx) => 
        idx === company.priceHistory.length - 1 ? nextPrice : val
      )
    };
  } else if (action.type === 'sell') {
    const currentOwned = player.portfolio[company.id] || 0;
    if (currentOwned < qty) {
      throw new Error('Insufficient shares in portfolio to execute sale.');
    }

    const totalPayout = qty * company.price;
    const nextPlayer: Player = {
      ...player,
      cash: Math.round((player.cash + totalPayout) * 100) / 100,
      portfolio: {
        ...player.portfolio,
        [company.id]: currentOwned - qty
      }
    };
    nextPlayer.netWorthHistory[nextPlayer.netWorthHistory.length - 1] = calculateNetWorth(nextPlayer, state.companies);
    updatedPlayers[playerIdx] = nextPlayer;

    // MARKET IMPACT: Selling stock drives down the price slightly due to supply
    const saleFraction = qty / company.sharesOutstanding;
    // Price shift: -5% for selling 10% of company outstanding shares
    const impactFactor = 0.5; // multiplier
    const priceShift = 1 - (saleFraction * impactFactor);
    const nextPrice = Math.round(company.price * priceShift * 100) / 100;

    updatedCompanies[companyIdx] = {
      ...company,
      price: nextPrice,
      priceHistory: company.priceHistory.map((val, idx) => 
        idx === company.priceHistory.length - 1 ? nextPrice : val
      )
    };
  }

  return {
    ...state,
    players: updatedPlayers,
    companies: updatedCompanies,
    updatedAt: new Date().toISOString()
  };
}

export function executeAiTurns(state: GameState): GameState {
  let currentState = state;
  for (const player of currentState.players) {
    if (!player.isAi || player.lost) {
      continue;
    }
    try {
      currentState = runSingleAiPlayer(currentState, player.id);
    } catch (e) {
      console.error(`Error running AI player ${player.name} (${player.id}):`, e);
    }
  }
  return currentState;
}

export function runSingleAiPlayer(state: GameState, playerId: string): GameState {
  let currentState = state;
  const player = currentState.players.find(p => p.id === playerId);
  if (!player || !player.isAi || player.lost) return currentState;

  const difficulty = player.aiDifficulty || 'easy';

  // Decide if we should trade on this tick
  let tradeChance = 0.3;
  if (difficulty === 'medium') tradeChance = 0.65;
  if (difficulty === 'hard') tradeChance = 0.90;

  if (Math.random() > tradeChance) {
    return currentState;
  }

  const companies = currentState.companies;
  if (companies.length === 0) return currentState;

  if (difficulty === 'easy') {
    // Easy AI: Select 1 random company and randomly buy or sell a small amount
    const company = companies[Math.floor(Math.random() * companies.length)];
    const isBuy = Math.random() < 0.5;
    const qty = Math.floor(Math.random() * 16) + 5; // 5 to 20 shares

    if (isBuy) {
      const maxQty = Math.floor(player.cash / company.price);
      const finalQty = Math.min(qty, maxQty);
      if (finalQty > 0) {
        try {
          currentState = executeAction(currentState, { type: 'buy', companyId: company.id, quantity: finalQty }, playerId);
        } catch (e) {}
      }
    } else {
      const owned = player.portfolio[company.id] || 0;
      const finalQty = Math.min(qty, owned);
      if (finalQty > 0) {
        try {
          currentState = executeAction(currentState, { type: 'sell', companyId: company.id, quantity: finalQty }, playerId);
        } catch (e) {}
      }
    }
  } else if (difficulty === 'medium') {
    // Medium AI: momentum & mean reversion. Evaluate all companies and maybe trade 1 or 2.
    const shuffled = [...companies].sort(() => Math.random() - 0.5);
    let tradesExecuted = 0;

    for (const company of shuffled) {
      if (tradesExecuted >= 2) break; // Limit to 2 trades per tick

      const history = company.priceHistory;
      if (history.length < 2) continue;

      const lastPrice = company.price;
      const prevPrice = history[history.length - 2];
      const pctChange = (lastPrice - prevPrice) / prevPrice;

      // Calculate 5-tick moving average (mean)
      const sliceLen = Math.min(5, history.length);
      const avg5 = history.slice(-sliceLen).reduce((a, b) => a + b, 0) / sliceLen;

      let decision: 'buy' | 'sell' | null = null;

      // 1. Mean reversion check
      if (lastPrice < avg5 * 0.95) {
        decision = 'buy';
      } else if (lastPrice > avg5 * 1.05) {
        decision = 'sell';
      } 
      // 2. Momentum check
      else if (pctChange > 0.02) {
        decision = 'buy';
      } else if (pctChange < -0.02) {
        decision = 'sell';
      }

      if (decision === 'buy') {
        const activePlayer = currentState.players.find(p => p.id === playerId);
        if (!activePlayer) break;
        // Spend up to 15% of cash
        const budget = activePlayer.cash * 0.15;
        const qty = Math.floor(budget / company.price);
        const finalQty = Math.min(qty, 50); // limit to 50 shares
        if (finalQty > 0) {
          try {
            currentState = executeAction(currentState, { type: 'buy', companyId: company.id, quantity: finalQty }, playerId);
            tradesExecuted++;
          } catch (e) {}
        }
      } else if (decision === 'sell') {
        const activePlayer = currentState.players.find(p => p.id === playerId);
        if (!activePlayer) break;
        const owned = activePlayer.portfolio[company.id] || 0;
        if (owned > 0) {
          // Sell 50% of portfolio
          const finalQty = Math.min(Math.ceil(owned * 0.5), owned);
          if (finalQty > 0) {
            try {
              currentState = executeAction(currentState, { type: 'sell', companyId: company.id, quantity: finalQty }, playerId);
              tradesExecuted++;
            } catch (e) {}
          }
        }
      }
    }
  } else if (difficulty === 'hard') {
    // Hard AI: News scanning + technical analysis
    const currentTickEvents = currentState.marketEvents.filter(ev => ev.tick === currentState.currentTick);
    
    // Build a map of company impacts from news
    const newsImpactMap: { [companyId: string]: number } = {};
    for (const ev of currentTickEvents) {
      if (ev.impacts) {
        for (const cid of Object.keys(ev.impacts)) {
          newsImpactMap[cid] = ev.impacts[cid];
        }
      }
    }

    const shuffled = [...companies].sort(() => Math.random() - 0.5);
    let tradesExecuted = 0;

    for (const company of shuffled) {
      if (tradesExecuted >= 3) break; // Limit to 3 trades per tick

      const newsImpact = newsImpactMap[company.id];
      const history = company.priceHistory;
      let decision: 'buy' | 'sell' | null = null;
      let isNewsTrade = false;

      if (newsImpact !== undefined) {
        // News logic (dominant)
        if (newsImpact > 0) {
          decision = 'buy';
          isNewsTrade = true;
        } else if (newsImpact < 0) {
          decision = 'sell';
          isNewsTrade = true;
        }
      }

      // Technical fallback if no news
      if (decision === null && history.length >= 2) {
        const lastPrice = company.price;
        const sliceLen = Math.min(5, history.length);
        const avg5 = history.slice(-sliceLen).reduce((a, b) => a + b, 0) / sliceLen;

        if (lastPrice < avg5 * 0.90) {
          decision = 'buy'; // Deep discount
        } else if (lastPrice > avg5 * 1.10) {
          decision = 'sell'; // Heavily overvalued
        } else if (history.length >= 3) {
          // Strong 3-tick momentum check
          const p2 = history[history.length - 2];
          const p3 = history[history.length - 3];
          if (lastPrice > p2 && p2 > p3) {
            decision = 'buy';
          } else if (lastPrice < p2 && p2 < p3) {
            decision = 'sell';
          }
        }
      }

      if (decision === 'buy') {
        const activePlayer = currentState.players.find(p => p.id === playerId);
        if (!activePlayer) break;
        // Spend up to 40% of cash on news trade, 20% on technical trade
        const budgetPercent = isNewsTrade ? 0.40 : 0.20;
        const budget = activePlayer.cash * budgetPercent;
        const qty = Math.floor(budget / company.price);
        const finalQty = Math.min(qty, 200); // Up to 200 shares
        if (finalQty > 0) {
          try {
            currentState = executeAction(currentState, { type: 'buy', companyId: company.id, quantity: finalQty }, playerId);
            tradesExecuted++;
          } catch (e) {}
        }
      } else if (decision === 'sell') {
        const activePlayer = currentState.players.find(p => p.id === playerId);
        if (!activePlayer) break;
        const owned = activePlayer.portfolio[company.id] || 0;
        if (owned > 0) {
          // Dump 100% on bad news, 50% otherwise
          const finalQty = isNewsTrade ? owned : Math.min(Math.ceil(owned * 0.5), owned);
          if (finalQty > 0) {
            try {
              currentState = executeAction(currentState, { type: 'sell', companyId: company.id, quantity: finalQty }, playerId);
              tradesExecuted++;
            } catch (e) {}
          }
        }
      }
    }
  }

  return currentState;
}

export function isPlayerVacant(player: Player, status?: string): boolean {
  if (status && status !== 'setup') return false;
  const isDefaultName = player.name.startsWith('Trader ');
  const hasAssets = Object.values(player.portfolio || {}).some(qty => qty > 0);
  return !player.isHost && !player.isAi && player.assignedEmail === null && isDefaultName && !hasAssets;
}

export function endTurn(state: GameState, playerId: string): GameState {
  if (state.status !== 'active') {
    throw new Error('Game session is not active.');
  }

  const playerIdx = state.players.findIndex(p => p.id === playerId);
  if (playerIdx === -1) {
    throw new Error('Player not found in game session.');
  }

  // Deep clone state to avoid mutation
  const updatedState: GameState = JSON.parse(JSON.stringify(state));
  const player = updatedState.players[playerIdx];
  player.endedTurn = true;

  const activeHumans = updatedState.players.filter(p => !p.lost && !p.isAi && !isPlayerVacant(p, updatedState.status));
  const allEnded = activeHumans.every(p => p.endedTurn);

  if (allEnded) {
    // Advance tick
    const tickedState = tickMarket(updatedState);
    
    // Set activePlayerIdx to the first active human player on the new tick
    const firstActiveHuman = tickedState.players.find(p => !p.lost && !p.isAi && !isPlayerVacant(p, tickedState.status));
    if (firstActiveHuman) {
      tickedState.activePlayerIdx = tickedState.players.indexOf(firstActiveHuman);
    } else {
      tickedState.activePlayerIdx = 0;
    }
    return tickedState;
  } else {
    // Find next active human player who hasn't ended their turn
    let nextIdx = updatedState.activePlayerIdx;
    for (let i = 0; i < updatedState.players.length; i++) {
      nextIdx = (nextIdx + 1) % updatedState.players.length;
      const p = updatedState.players[nextIdx];
      if (!p.lost && !p.isAi && !isPlayerVacant(p, updatedState.status) && !p.endedTurn) {
        updatedState.activePlayerIdx = nextIdx;
        break;
      }
    }
    updatedState.updatedAt = new Date().toISOString();
    return updatedState;
  }
}

export function cancelEndTurn(state: GameState, playerId: string): GameState {
  if (state.status !== 'active') {
    throw new Error('Game session is not active.');
  }

  const playerIdx = state.players.findIndex(p => p.id === playerId);
  if (playerIdx === -1) {
    throw new Error('Player not found in game session.');
  }

  // Deep clone state to avoid mutation
  const updatedState: GameState = JSON.parse(JSON.stringify(state));
  const player = updatedState.players[playerIdx];
  player.endedTurn = false;

  // Set this player as active
  updatedState.activePlayerIdx = playerIdx;
  updatedState.updatedAt = new Date().toISOString();
  return updatedState;
}

const NAME_PREFIXES = ["Neo-Tokyo", "Megacorp", "WallStreet", "Chiba", "Sector-7", "Cyberdyne", "Orbital", "Nakamoto", "Omni", "Quantum", "Aether", "Synthetix", "Carbon", "Weyland", "Hyperion"];
const NAME_ADJECTIVES = ["Algorithmic", "High-Frequency", "Offshore", "Shadow", "Dark-Pool", "Synthetic", "Quantitative", "Predatory", "Autonomous", "Decentralized", "Speculative", "Terminal", "Deep-State", "Velocity"];
const NAME_NOUNS = ["Simulation", "Index", "Node", "Nexus", "Exchange", "Clash", "Coliseum", "Arena", "Ledger", "Matrix", "Subnet", "Pipeline", "Sandbox", "Vortex", "Horizon"];

export function generateRandomGameName(): string {
  const p = NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)];
  const a = NAME_ADJECTIVES[Math.floor(Math.random() * NAME_ADJECTIVES.length)];
  const n = NAME_NOUNS[Math.floor(Math.random() * NAME_NOUNS.length)];
  return `${p} ${a} ${n}`;
}
