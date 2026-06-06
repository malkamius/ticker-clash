import { useState, useEffect, useRef } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Users, 
  User, 
  LogOut, 
  Activity, 
  Play, 
  RefreshCw, 
  ArrowRightLeft, 
  Building,
  Bell,
  Trash2,
  Globe,
  X,
  Bot,
  Shield,
  PieChart,
  Coins,
  Eye
} from 'lucide-react';
import { calculateNetWorth } from './game/gameState';
import type { GameState, Company, Player } from './game/gameState';
import type { UserAccount } from './game/auth';
import { authService } from './game/services/OnlineAuthService';
import { gameService } from './game/services/OnlineGameService';

// SVG Sparkline Chart Component
function StockChart({ history, isUp }: { history: number[]; isUp: boolean }) {
  if (history.length < 2) return <div style={{ height: '140px' }} className="flex items-center justify-center text-gray-500 font-mono text-xs">Awaiting market data...</div>;

  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min === 0 ? 1 : max - min;

  const width = 500;
  const height = 140;
  const padding = 10;

  // Map history to points
  const points = history.map((val, idx) => {
    const x = padding + (idx / (history.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((val - min) / range) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');

  // SVG closed path for gradient fill
  const firstX = padding;
  const lastX = width - padding;
  const fillPoints = `${firstX},${height - padding} ${points} ${lastX},${height - padding}`;

  const strokeColor = isUp ? '#39ff14' : '#ff007f';
  const gradId = `grad-${Math.random().toString(36).substring(2, 7)}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
      {/* Gradient Fill */}
      <polygon points={fillPoints} fill={`url(#${gradId})`} />
      {/* Line plot */}
      <polyline points={points} fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Dot on last coordinate */}
      {history.length > 0 && (
        <circle 
          cx={padding + (width - 2 * padding)} 
          cy={height - padding - ((history[history.length - 1] - min) / range) * (height - 2 * padding)} 
          r="4" 
          fill={strokeColor} 
          className="pulse-light"
        />
      )}
    </svg>
  );
}

function LobbyPlayerRow({ 
  player, 
  isHost, 
  onUpdateSlot
}: { 
  player: Player; 
  isHost: boolean; 
  onUpdateSlot: (playerId: string, updates: { name?: string; email?: string | null; isAi?: boolean; aiDifficulty?: 'easy' | 'medium' | 'hard'; isLocal?: boolean }) => void;
}) {
  const [localName, setLocalName] = useState(player.name);
  const [localEmail, setLocalEmail] = useState(player.assignedEmail || '');

  useEffect(() => {
    setLocalName(player.name);
  }, [player.name]);

  useEffect(() => {
    setLocalEmail(player.assignedEmail || '');
  }, [player.assignedEmail]);

  const handleNameBlur = () => {
    if (localName.trim() && localName.trim() !== player.name) {
      onUpdateSlot(player.id, { name: localName.trim() });
    }
  };

  const handleEmailBlur = () => {
    if (localEmail.trim() !== (player.assignedEmail || '')) {
      onUpdateSlot(player.id, { email: localEmail.trim() || null, isLocal: !localEmail.trim() });
    }
  };

  const isHostPlayer = player.isHost;

  return (
    <div className="flex flex-wrap md:flex-nowrap gap-3 items-center border border-white/5 bg-white/2 p-3 rounded font-mono text-sm">
      {/* Color indicator */}
      <div className={`h-3 w-3 rounded-full flex-shrink-0 ${isHostPlayer ? 'bg-neon-cyan shadow-[0_0_8px_#00f0ff]' : player.assignedEmail ? (player.isAi ? 'bg-neon-yellow shadow-[0_0_8px_#ffaa00]' : 'bg-neon-green shadow-[0_0_8px_#39ff14]') : 'bg-secondary'}`} />

      {/* Name field */}
      <input
        type="text"
        disabled={!isHost}
        value={localName}
        onChange={e => setLocalName(e.target.value)}
        onBlur={handleNameBlur}
        className="terminal-input py-1 px-2 text-xs w-full md:w-48 bg-black/40"
        placeholder="Trader Name"
      />

      {/* Controller Type */}
      <select
        disabled={!isHost || isHostPlayer}
        value={player.isAi ? 'ai' : 'human'}
        onChange={e => {
          const val = e.target.value;
          if (val === 'ai') {
            onUpdateSlot(player.id, { isAi: true, aiDifficulty: 'medium', isLocal: false });
          } else {
            onUpdateSlot(player.id, { isAi: false, isLocal: true, email: null });
          }
        }}
        className="terminal-input py-1 px-2 text-xs w-full md:w-32 bg-black/80"
      >
        <option value="human">🌐 HUMAN</option>
        <option value="ai">🤖 AI</option>
      </select>

      {/* Local checkbox or AI difficulty */}
      {player.isAi ? (
        <div className="flex items-center gap-2 w-full md:w-auto flex-grow">
          <span className="text-3xs text-secondary font-mono">DIFFICULTY:</span>
          <select
            disabled={!isHost}
            value={player.aiDifficulty || 'medium'}
            onChange={e => onUpdateSlot(player.id, { isAi: true, aiDifficulty: e.target.value as any })}
            className="terminal-input py-1 px-2 text-xs w-full md:w-32 bg-black/80 text-neon-yellow"
          >
            <option value="easy">🟢 Novice</option>
            <option value="medium">🟡 Standard</option>
            <option value="hard">🔴 Brutal</option>
          </select>
        </div>
      ) : (
        <div className="flex flex-wrap md:flex-nowrap items-center gap-3 w-full md:w-auto flex-grow">
          {/* LOCAL checkbox */}
          <label className={`flex items-center gap-1 cursor-pointer text-xs ${isHostPlayer ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <input
              type="checkbox"
              disabled={!isHost || isHostPlayer}
              checked={!!player.isLocal}
              onChange={e => {
                const checked = e.target.checked;
                onUpdateSlot(player.id, { isLocal: checked, email: checked ? null : '' });
              }}
              className="accent-[#00f0ff]"
            />
            <span className="text-secondary text-2xs uppercase">LOCAL</span>
          </label>

          {/* Email Input */}
          {!player.isLocal && !isHostPlayer && (
            <input
              type="email"
              disabled={!isHost}
              value={localEmail}
              onChange={e => setLocalEmail(e.target.value)}
              onBlur={handleEmailBlur}
              className="terminal-input py-1 px-2 text-2xs w-full md:w-56 bg-black/40"
              placeholder="Commander Email"
            />
          )}
        </div>
      )}

      {/* Status / Kick */}
      <div className="flex-shrink-0 ml-auto flex items-center gap-2">
        {isHostPlayer && <span className="text-3xs border border-neon-cyan px-1 rounded text-neon-cyan">HOST</span>}
        {!isHostPlayer && player.assignedEmail && (
          <span className={`text-3xs ${player.isAi ? 'text-neon-yellow' : 'text-neon-green'} truncate max-w-[120px]`}>
            {player.isAi ? 'BOT ACTIVE' : player.assignedEmail}
          </span>
        )}
        {isHost && !isHostPlayer && (player.assignedEmail || player.isAi) && (
          <button
            onClick={() => onUpdateSlot(player.id, { email: null, isAi: false, isLocal: true })}
            className="btn-terminal btn-magenta text-3xs py-0.5 px-2"
          >
            CLEAR
          </button>
        )}
      </div>
    </div>
  );
}

// Helper to detect vacant player slots that haven't participated in the game
function isPlayerVacant(player: Player, status?: string) {
  if (status && status !== 'setup') return false;
  const isDefaultName = player.name.startsWith('Trader ');
  const hasAssets = Object.values(player.portfolio).some(qty => qty > 0);
  return !player.isHost && !player.isAi && player.assignedEmail === null && isDefaultName && !hasAssets;
}

interface PassTurnOverlayProps {
  nextPlayer: Player;
  onStartTurn: () => void;
  onCancelEndTurn?: () => void;
  endedPlayerName?: string;
}

function PassTurnOverlay({ nextPlayer, onStartTurn, onCancelEndTurn, endedPlayerName }: PassTurnOverlayProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-panel glass-panel-cyan w-full max-w-md p-8 flex flex-col gap-6 text-center shadow-[0_0_50px_rgba(0,240,255,0.2)]">
        <div className="flex justify-center">
          <Activity className="h-10 w-10 text-neon-cyan animate-pulse" />
        </div>
        <h2 className="font-mono text-2xl font-bold tracking-wider text-neon-cyan border-b border-[#00f0ff]/15 pb-3">
          SECURE TURN TRANSITION
        </h2>
        
        <div className="font-mono text-sm text-[#94a3b8] leading-relaxed py-2 flex flex-col gap-4">
          {endedPlayerName && (
            <div className="border border-[#39ff14]/20 bg-[#39ff14]/5 p-2 rounded text-xs text-neon-green uppercase">
              ✓ {endedPlayerName}'s turn complete
            </div>
          )}
          <div className="text-xs uppercase text-secondary">
            Please pass the terminal console to:
          </div>
          <div className="text-2xl font-bold text-white text-shadow-glow uppercase tracking-wider py-1 border border-white/5 bg-white/2 rounded">
            {nextPlayer.name}
          </div>
        </div>

        <div className="flex flex-col gap-3 mt-2">
          <button 
            onClick={onStartTurn}
            className="btn-sci-fi w-full py-3 font-mono text-sm font-bold tracking-widest"
          >
            START {nextPlayer.name.toUpperCase()}'S TURN
          </button>
          
          {onCancelEndTurn && (
            <button 
              onClick={onCancelEndTurn}
              className="btn-terminal btn-magenta w-full py-2 font-mono text-xs uppercase"
            >
              Cancel End Turn
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


export default function App() {
  const [user, setUser] = useState<UserAccount | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [isGooglePolling, setIsGooglePolling] = useState(false);

  // Dashboard state
  const [games, setGames] = useState<any[]>([]);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joinSuccess, setJoinSuccess] = useState('');

  // Create Game dialog state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createGameName, setCreateGameName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [startingCash, setStartingCash] = useState(100000);
  const [maxTicks, setMaxTicks] = useState(40);

  // Active Game State
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);
  const [currentGame, setCurrentGame] = useState<GameState | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [tradeQuantity, setTradeQuantity] = useState<number>(10);
  const [gameActionError, setGameActionError] = useState('');

  // Active Local Player (for pass and play or local trading slots)
  const [activeLocalPlayerId, setActiveLocalPlayerId] = useState<string | null>(null);
  const [passTurnActive, setPassTurnActive] = useState(false);
  const [lastEndedPlayerName, setLastEndedPlayerName] = useState<string | undefined>(undefined);
  // Join request slot assignments (joinRequestId -> playerId)
  const [joinAssignSlot, setJoinAssignSlot] = useState<Record<number, string>>({});

  // Player Dossier state variables
  const [selectedDossierPlayerId, setSelectedDossierPlayerId] = useState<string | null>(null);
  const [isDossierOpen, setIsDossierOpen] = useState(false);

  // Lobby details
  const [joinRequests, setJoinRequests] = useState<any[]>([]);

  // Telemetry timer for background polling
  const pollIntervalRef = useRef<any | null>(null);
  const isHost = currentGame ? (user ? currentGame.players[0].assignedEmail === user.email : false) : false;
  const currentTick = currentGame?.currentTick || 0;

  // Ref to track latest state for background polling to prevent stale closures
  const stateRef = useRef({ selectedCompanyId, activeLocalPlayerId, user, currentGameId });
  useEffect(() => {
    stateRef.current = { selectedCompanyId, activeLocalPlayerId, user, currentGameId };
  }, [selectedCompanyId, activeLocalPlayerId, user, currentGameId]);

  // Initialize CSRF
  useEffect(() => {
    localStorage.removeItem('tickerclash_auth_pending_token');

    authService.initCSRF().then(() => {
      authService.checkSession().then((u) => {
        setUser(u);
        setAuthLoading(false);
        if (u) {
          loadGames();
        } else {
          // Check for URL errors from OAuth redirect
          const params = new URLSearchParams(window.location.search);
          const error = params.get('error');
          if (error) {
            if (error === 'db_fail') {
              setAuthError('Database operation failed during sign-in.');
            } else if (error === 'oauth_failed') {
              setAuthError('Google authentication failed. Please try again.');
            } else if (error === 'session_fail') {
              setAuthError('Session establishment failed. Please try again.');
            } else {
              setAuthError(error);
            }
            // Clear search params
            window.history.replaceState(null, '', window.location.pathname);
          }
        }
      });
    });  }, []);

  // Poll for Google Sign-in completion if pending token exists
  useEffect(() => {
    let active = true;
    let pollInterval: any = null;
    let currentPollingToken: string | null = null;

    const startPolling = (token: string) => {
      if (currentPollingToken === token) return;
      currentPollingToken = token;
      setIsGooglePolling(true);

      if (pollInterval) clearInterval(pollInterval);

      pollInterval = setInterval(async () => {
        if (!active) return;
        try {
          const response = await authService.pollAuth(token);
          if (response.status === 'success' && response.sessionId) {
            if (pollInterval) clearInterval(pollInterval);
            localStorage.removeItem('tickerclash_auth_pending_token');
            setIsGooglePolling(false);
            
            const user = await authService.checkSession();
            if (user) {
              setUser(user);
              loadGames();
            } else {
              setAuthError('Failed to establish user session.');
            }
          } else if (response.status === 'error') {
            if (pollInterval) clearInterval(pollInterval);
            localStorage.removeItem('tickerclash_auth_pending_token');
            setIsGooglePolling(false);
            setAuthError(`Google Sign-in failed: ${response.error || 'unknown error'}`);
          }
        } catch (e) {
          console.error('Error polling auth status:', e);
        }
      }, 2000);
    };

    const checkPendingToken = () => {
      const pendingToken = localStorage.getItem('tickerclash_auth_pending_token');
      if (pendingToken) {
        startPolling(pendingToken);
      } else {
        if (currentPollingToken) {
          currentPollingToken = null;
          setIsGooglePolling(false);
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        }
      }
    };

    const tokenCheckInterval = setInterval(checkPendingToken, 1000);
    checkPendingToken();

    return () => {
      active = false;
      if (pollInterval) clearInterval(pollInterval);
      clearInterval(tokenCheckInterval);
    };
  }, []);

  // Poll current game state if in an active game session
  useEffect(() => {
    if (currentGameId) {
      pollGame();
      pollIntervalRef.current = setInterval(() => {
        pollGame();
      }, 3000);
    } else {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [currentGameId]);

  const loadGames = async () => {
    const res = await gameService.listGames();
    if (res.success && res.games) {
      setGames(res.games);
    }
  };

  // Removed local registration/login handlers (managed centrally by KBS SSO)

  const handleLogout = async () => {
    await authService.logoutUser();
    setUser(null);
    setCurrentGameId(null);
    setCurrentGame(null);

    const isPackaged = typeof window !== 'undefined' && 
                       (window.location.protocol === 'file:' || 
                        window.location.hostname === '' ||
                        navigator.userAgent.toLowerCase().includes('electron'));

    if (!isPackaged) {
      const authProto = window.location.protocol === 'https:' ? 'https:' : 'http:';
      const getAuthServerUrl = () => {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          const port = window.location.port;
          if (port === '28003' || port === '29003') {
            return 'http://localhost:28001';
          }
          return 'http://localhost:19001';
        }
        return `${authProto}//auth.kbs-cloud.com`;
      };
      window.location.href = `${getAuthServerUrl()}/api/auth/logout?redirect_uri=${encodeURIComponent(window.location.origin)}`;
    }
  };

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();

    const options = {
      maxPlayers,
      startingCash,
      maxTicks
    };

    const res = await gameService.createGame(createGameName, null, options);
    if (res.success && res.gameId) {
      setShowCreateModal(false);
      setCreateGameName('');
      setCurrentGameId(res.gameId);
      loadGames();
    }
  };

  const handleJoinGame = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');
    setJoinSuccess('');
    if (!inviteCodeInput) return;

    // Search game by invite code or ID
    const inviteLower = inviteCodeInput.trim();
    const res = await gameService.listGames({ limit: 10, offset: 0, search: inviteLower });
    if (res.success && res.games && res.games.length > 0) {
      const match = res.games[0];
      const reqRes = await gameService.requestToJoin(match.id, user?.email || undefined);
      if (reqRes.success) {
        setJoinSuccess('Join request submitted. Awaiting host slot assignment.');
        setInviteCodeInput('');
        loadGames();
      } else {
        setJoinError(reqRes.error || 'Failed to submit join request.');
      }
    } else {
      setJoinError('Game session not found with code.');
    }
  };

  const pollGame = async () => {
    const { currentGameId: currentId, selectedCompanyId: selCompId, activeLocalPlayerId: activePlId, user: currentUser } = stateRef.current;
    if (!currentId) return;
    const res = await gameService.getGame(currentId);
    if (res.success && res.game) {
      const gameState = res.game.gameState;
      setCurrentGame(gameState);
      
      // Auto select first company if none selected
      if (!selCompId && gameState.companies.length > 0) {
        setSelectedCompanyId(gameState.companies[0].id);
      }

      // Auto select active local player
      const players = gameState.players;
      if (players && players.length > 0) {
        const userEmail = currentUser?.email;
        const hostEmail = players[0]?.assignedEmail;
        const isUserHost = userEmail && hostEmail === userEmail;

        const myPlayerSlot = players.find(p => userEmail && p.assignedEmail === userEmail);
        const localHumans = players.filter(p => !isPlayerVacant(p, gameState.status) && (p.assignedEmail === userEmail || (p.isLocal && isUserHost)));

        if (localHumans.length > 1 && isUserHost) {
          const activeStatePlayer = players[gameState.activePlayerIdx || 0];
          if (activeStatePlayer && (activeStatePlayer.assignedEmail === userEmail || activeStatePlayer.isLocal)) {
            setActiveLocalPlayerId(activeStatePlayer.id);
          }
        } else {
          const isCurrentValid = activePlId && players.some(p => p.id === activePlId && (p.assignedEmail === userEmail || (p.isLocal && isUserHost)));
          if (!isCurrentValid) {
            if (myPlayerSlot) {
              setActiveLocalPlayerId(myPlayerSlot.id);
            } else if (isUserHost) {
              setActiveLocalPlayerId(players[0].id);
            } else {
              setActiveLocalPlayerId(null);
            }
          }
        }
      }

      // If in lobby (setup state), fetch pending requests
      if (res.game.gameState.status === 'setup') {
        const joins = await gameService.fetchPendingJoins(currentId);
        if (joins.success && joins.requests) {
          setJoinRequests(joins.requests);
        }
      }
    } else {
      setCurrentGameId(null);
      setCurrentGame(null);
    }
  };

  // Dispatch game action to the backend
  const dispatchAction = async (actionBody: { type: 'buy' | 'sell' | 'start' | 'tick' | 'end_turn' | 'cancel_end_turn'; companyId?: string; quantity?: number }) => {
    if (!currentGameId || !currentGame) return;
    setGameActionError('');

    let playerId = '';
    if (actionBody.type === 'start' || actionBody.type === 'tick') {
      playerId = currentGame.players[0].id;
    } else if (actionBody.type === 'cancel_end_turn') {
      const userEmail = user?.email;
      const endedPlayer = currentGame.players.find(p => p.endedTurn && (p.assignedEmail === userEmail || (p.isLocal && isHost)));
      playerId = endedPlayer ? endedPlayer.id : (activeLocalPlayerId || '');
    } else {
      playerId = activeLocalPlayerId || '';
    }

    if (!playerId) {
      setGameActionError('You are not assigned to a slot in this session.');
      return;
    }

    const res = await gameService.performGameAction(currentGameId, actionBody, playerId);
    if (res.success && res.gameState) {
      const nextGameState = res.gameState;
      setCurrentGame(nextGameState);
      
      const nextPlayer = nextGameState.players[nextGameState.activePlayerIdx];
      const localHumans = nextGameState.players.filter((p: Player) => !isPlayerVacant(p, nextGameState.status) && (p.assignedEmail === (user?.email || null) || (p.isLocal && isHost)));
      
      if (actionBody.type === 'end_turn' && localHumans.length > 1 && (nextPlayer.assignedEmail === user?.email || nextPlayer.isLocal)) {
        const justEnded = currentGame.players.find(p => p.id === playerId);
        setLastEndedPlayerName(justEnded?.name);
        setPassTurnActive(true);
      } else if (actionBody.type === 'cancel_end_turn') {
        setPassTurnActive(false);
      }
    } else {
      setGameActionError(res.error || 'Action failed.');
    }
  };

  const handleAssignSlot = async (
    playerId: string,
    reqEmail: string | null,
    requestId?: number,
    isAi?: boolean,
    aiDifficulty?: 'easy' | 'medium' | 'hard',
    isLocal?: boolean,
    name?: string
  ) => {
    if (!currentGameId) return;
    const res = await gameService.assignPlayerSlot(currentGameId, playerId, reqEmail, requestId, isAi, aiDifficulty, isLocal, name);
    if (res.success) {
      pollGame();
    }
  };

  const handleRejectRequest = async (requestId: number) => {
    if (!currentGameId) return;
    const res = await gameService.rejectJoinRequest(currentGameId, requestId);
    if (res.success) {
      pollGame();
    }
  };

  const handleDeleteGame = async (gameId: string) => {
    if (confirm('Decommission this game session? This cannot be undone.')) {
      const res = await gameService.deleteGame(gameId);
      if (res.success) {
        loadGames();
      }
    }
  };

  if (isGooglePolling) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#07050f] text-[#00f0ff] z-50 px-4">
        <div className="terminal-grid" />
        <div className="glass-panel glass-panel-cyan w-full max-w-md p-8 text-center flex flex-col gap-6 z-10">
          <h2 className="font-mono text-xl font-bold tracking-widest text-neon-cyan border-b border-[#00f0ff]/15 pb-3">
            ESTABLISHING SECURE LINK
          </h2>
          <div className="font-mono text-sm text-[#94a3b8] leading-relaxed">
            Please complete authentication in your default web browser.
          </div>
          <div className="inline-block mx-auto w-10 h-10 border-4 border-t-neon-cyan border-white/10 rounded-full animate-spin" />
          <div className="font-mono text-xs uppercase text-secondary tracking-wider">
            [Waiting for browser validation...]
          </div>
          <button 
            onClick={() => {
              localStorage.removeItem('tickerclash_auth_pending_token');
              setIsGooglePolling(false);
            }}
            className="btn-sci-fi py-2 font-mono text-xs uppercase"
          >
            Cancel Connection Request
          </button>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#07050f] text-[#00f0ff]">
        <div className="text-center font-mono">
          <Activity className="mx-auto mb-4 h-12 w-12 spin-loader" />
          <div className="tracking-widest">INITIALIZING TERMINAL SECURITY...</div>
        </div>
      </div>
    );
  }

  // Helper redirect to central auth
  const redirectToAuth = () => {
    const isPackaged = typeof window !== 'undefined' && 
                       (window.location.protocol === 'file:' || 
                        window.location.hostname === '' ||
                        navigator.userAgent.toLowerCase().includes('electron'));
                        
    // Callback endpoint on Ticker-Clash backend
    const localBackendBase = isPackaged ? 'http://localhost:20003' : window.location.origin;
    const redirectUri = `${localBackendBase}/api/auth/callback`;
    
    const authProto = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const getAuthServerUrl = () => {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        const port = window.location.port;
        if (port === '28003' || port === '29003') {
          return 'http://localhost:28001';
        }
        return 'http://localhost:19001';
      }
      return `${authProto}//auth.kbs-cloud.com`;
    };
    let targetUrl = `${getAuthServerUrl()}/api/auth/authorize?client_id=tickerclash&redirect_uri=${encodeURIComponent(redirectUri)}`;
    
    if (isPackaged) {
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('tickerclash_auth_pending_token', token);
      
      const stateParam = `source=electron&token=${token}`;
      targetUrl += `&state=${encodeURIComponent(stateParam)}`;
      
      // In electron, open external browser
      window.open(targetUrl, '_blank');
      setIsGooglePolling(true); // Open the backdrop modal showing "waiting for browser validation"
    } else {
      window.location.href = targetUrl;
    }
  };

  // --- LOGIN SCREEN ---
  if (!user) {
    return (
      <div className="relative flex h-screen w-screen items-center justify-center bg-[#07050f] px-4">
        <div className="terminal-grid" />
        <div className="glass-panel glass-panel-cyan z-10 w-full max-w-md p-8">
          <div className="mb-8 text-center">
            <Activity className="mx-auto mb-3 h-10 w-10 text-neon-cyan" />
            <h1 className="font-mono text-2xl font-bold tracking-wider text-neon-cyan">TICKER CLASH</h1>
            <p className="text-sm uppercase tracking-widest text-[#94a3b8]">Financial Simulation Node</p>
          </div>

          {authError && (
            <div className="mb-6 border border-[#ff007f]/30 bg-[#ff007f]/10 p-3 text-center font-mono text-xs text-neon-magenta">
              ERROR: {authError}
            </div>
          )}

          <div className="flex flex-col gap-4 text-center font-mono text-xs text-[#94a3b8] mb-6">
            Authentication is managed centrally by KBS Cloud SSO. Click below to establish a secure trader connection link.
          </div>

          <button onClick={redirectToAuth} className="btn-sci-fi w-full py-3 font-mono tracking-widest">
            ESTABLISH CONNECTION
          </button>
        </div>
      </div>
    );
  }

  // Helper calculation values
  const activeFactions = currentGame ? currentGame.players.filter(p => p.assignedEmail !== null || p.isLocal) : [];
  const myPlayer = currentGame ? currentGame.players.find(p => p.id === activeLocalPlayerId) : null;
  const isSetup = currentGame?.status === 'setup';
  const localHumanPlayers = currentGame
    ? currentGame.players.filter(p => p.assignedEmail === user?.email || (p.isLocal && isHost))
    : [];
  const selectedCompany = currentGame?.companies.find(c => c.id === selectedCompanyId);
  const myStockCount = myPlayer && selectedCompany ? (myPlayer.portfolio[selectedCompany.id] || 0) : 0;
  const isCompleted = currentGame?.status === 'completed';

  // Sort players by net worth for leaderboard (filtering out vacant slots)
  const sortedLeaderboard = currentGame ? [...currentGame.players]
    .filter(p => !isPlayerVacant(p, currentGame.status))
    .map(p => ({
      ...p,
      netWorth: calculateNetWorth(p, currentGame.companies)
    }))
    .sort((a, b) => b.netWorth - a.netWorth) : [];

  return (
    <div className="flex h-screen w-screen flex-col bg-[#07050f] text-[#e2e8f0]">
      {/* Header bar */}
      <header className="flex h-14 items-center justify-between border-b border-[#00f0ff]/15 bg-black/60 px-6 z-10">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-neon-cyan" />
          <span className="font-mono text-lg font-bold tracking-wider text-neon-cyan">TICKER CLASH TERMINAL</span>
        </div>
        <div className="flex items-center gap-6 font-mono text-sm">
          {currentGameId && (
            <button 
              onClick={() => { setCurrentGameId(null); setCurrentGame(null); loadGames(); }}
              className="text-secondary hover:text-neon-cyan flex items-center gap-1 bg-transparent border-0 cursor-pointer"
            >
              <Globe className="h-4 w-4" /> DASHBOARD
            </button>
          )}
          {currentGame && currentGame.status !== 'setup' && localHumanPlayers.length > 1 ? (
            <div className="flex items-center gap-2 border-l border-white/10 pl-6 font-mono">
              <span className="text-secondary uppercase text-[10px]">ACTING AS:</span>
              <select
                value={activeLocalPlayerId || ''}
                onChange={e => setActiveLocalPlayerId(e.target.value)}
                className="py-1 px-2 bg-black border border-[#00f0ff]/30 text-[#00f0ff] rounded text-xs font-bold"
              >
                {localHumanPlayers.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2 border-l border-white/10 pl-6">
              <User className="h-4 w-4 text-neon-cyan" />
              <span className="text-secondary uppercase">{user.displayName || user.email.split('@')[0]}</span>
            </div>
          )}
          <button onClick={handleLogout} className="text-[#ff007f] hover:text-neon-magenta flex items-center gap-1 bg-transparent border-0 cursor-pointer">
            <LogOut className="h-4 w-4" /> DISCONNECT
          </button>
        </div>
      </header>

      {/* --- DASHBOARD VIEW --- */}
      {!currentGameId ? (
        <main className="relative flex-1 overflow-y-auto p-8 flex flex-col gap-6">
          <div className="terminal-grid" />
          
          <div className="flex justify-between items-center z-10">
            <div>
              <h2 className="text-2xl font-bold tracking-wide">TRADING MODULES</h2>
              <p className="text-xs text-secondary uppercase">Initiate or join simulated stock markets</p>
            </div>
            <button onClick={() => setShowCreateModal(true)} className="btn-terminal btn-sci-fi">
              <Plus className="h-4 w-4" /> LAUNCH NEW MARKET
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 z-10">
            {/* Join game by code card */}
            <div className="glass-panel glass-panel-cyan p-6 flex flex-col gap-4">
              <div>
                <h3 className="font-mono text-neon-cyan font-semibold uppercase">JOIN SESSION</h3>
                <p className="text-xs text-secondary">Enter an invite code to request slot authorization</p>
              </div>

              {joinError && <div className="border border-[#ff007f]/30 bg-[#ff007f]/10 p-2 font-mono text-xs text-neon-magenta">ERROR: {joinError}</div>}
              {joinSuccess && <div className="border border-[#39ff14]/30 bg-[#39ff14]/10 p-2 font-mono text-xs text-neon-green">SUCCESS: {joinSuccess}</div>}

              <form onSubmit={handleJoinGame} className="flex gap-2">
                <input 
                  type="text" 
                  required
                  placeholder="INVITE CODE" 
                  className="terminal-input flex-1 uppercase"
                  value={inviteCodeInput}
                  onChange={e => setInviteCodeInput(e.target.value)}
                />
                <button type="submit" className="btn-terminal">JOIN</button>
              </form>
            </div>

            {/* Profile Statistics Card */}
            <div className="glass-panel p-6 flex flex-col justify-between">
              <div>
                <h3 className="font-mono text-secondary font-semibold uppercase">TRADING PROFILE</h3>
                <p className="text-xs text-secondary">Historical records for commander faction</p>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="border border-white/5 bg-white/2 p-3 rounded">
                  <div className="text-xs text-secondary uppercase font-mono">Sessions Run</div>
                  <div className="text-xl font-bold telemetry">{user.stats?.gamesPlayed || 0}</div>
                </div>
                <div className="border border-white/5 bg-white/2 p-3 rounded">
                  <div className="text-xs text-secondary uppercase font-mono">Highest Rank</div>
                  <div className="text-xl font-bold telemetry text-neon-green">{user.stats?.gamesWon || 0} Wins</div>
                </div>
              </div>
            </div>
          </div>

          {/* Active Games Factions List */}
          <div className="glass-panel p-6 z-10 flex-1 flex flex-col min-h-[300px]">
            <h3 className="font-mono text-secondary font-semibold uppercase mb-4">ACTIVE SIMULATIONS</h3>
            
            <div className="flex-grow overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-xs text-secondary uppercase font-mono">
                    <th className="py-3 px-4">Market Name</th>
                    <th className="py-3 px-4">Invite Code</th>
                    <th className="py-3 px-4">Tick State</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Host</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {games.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-secondary uppercase font-mono text-sm">
                        No active simulated markets found. Launch one above!
                      </td>
                    </tr>
                  ) : (
                    games.map((g: any) => {
                      const hostEmail = g.ownerEmail || g.owner_email;
                      const amHost = hostEmail === user.email;
                      const tickVal = g.gameState?.currentTick || 0;
                      const maxTickVal = g.gameState?.maxTicks !== undefined ? g.gameState.maxTicks : 40;
                      const gStatus = g.gameState?.status || 'setup';

                      return (
                        <tr key={g.id} className="border-b border-white/5 hover:bg-white/2 font-mono text-sm">
                          <td className="py-3 px-4 font-bold text-neon-cyan">{g.name}</td>
                          <td className="py-3 px-4 uppercase text-[#ffaa00]">{g.inviteCode || g.invite_code}</td>
                          <td className="py-3 px-4">{tickVal} / {maxTickVal === 0 ? '∞' : maxTickVal}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              gStatus === 'active' ? 'bg-[#39ff14]/10 text-neon-green' :
                              gStatus === 'setup' ? 'bg-[#ffaa00]/10 text-neon-yellow' :
                              'bg-white/10 text-secondary'
                            }`}>
                              {gStatus.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-secondary text-xs">{hostEmail}</td>
                          <td className="py-3 px-4 text-right flex items-center justify-end gap-2">
                            <button 
                              onClick={() => setCurrentGameId(g.id)}
                              className="btn-terminal text-xs py-1 px-3"
                            >
                              CONNECT
                            </button>
                            {amHost && (
                              <button 
                                onClick={() => handleDeleteGame(g.id)}
                                className="btn-terminal btn-magenta text-xs py-1 px-2"
                                title="Decommission"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Create game dialog */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
              <div className="glass-panel glass-panel-cyan w-full max-w-md p-6 flex flex-col gap-4">
                <h3 className="font-mono text-neon-cyan text-lg uppercase font-bold border-b border-[#00f0ff]/15 pb-2">
                  LAUNCH SIMULATED MARKET
                </h3>

                <form onSubmit={handleCreateGame} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-xs uppercase text-secondary">Simulation Name (Optional)</label>
                    <input 
                      type="text" 
                      placeholder="Leave blank for random name"
                      className="terminal-input"
                      value={createGameName}
                      onChange={e => setCreateGameName(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-xs uppercase text-secondary">Max Players</label>
                      <input 
                        type="number" 
                        min={1} 
                        max={8}
                        className="terminal-input"
                        value={maxPlayers}
                        onChange={e => setMaxPlayers(parseInt(e.target.value))}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-xs uppercase text-secondary">Max Ticks (Turns) (0 for Infinite)</label>
                      <input 
                        type="number" 
                        min={0} 
                        max={100}
                        className="terminal-input"
                        value={maxTicks}
                        onChange={e => setMaxTicks(isNaN(parseInt(e.target.value)) ? 0 : parseInt(e.target.value))}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-xs uppercase text-secondary">Starting Capital ($)</label>
                    <input 
                      type="number" 
                      min={1000} 
                      className="terminal-input"
                      value={startingCash}
                      onChange={e => setStartingCash(parseInt(e.target.value))}
                    />
                  </div>

                  <div className="flex justify-end gap-3 mt-2">
                    <button 
                      type="button" 
                      onClick={() => setShowCreateModal(false)}
                      className="btn-terminal btn-magenta"
                    >
                      ABORT
                    </button>
                    <button type="submit" className="btn-terminal btn-green">
                      LAUNCH
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      ) : (
        /* --- GAME SIMULATION VIEW --- */
        <div className="flex-1 flex flex-col overflow-hidden relative">
          
          {/* Scrolling News Ticker */}
          <div className="ticker-wrap z-10">
            <div className="ticker">
              {/* Loop events to ensure infinite scroll content */}
              {(currentGame?.marketEvents.length === 0 
                ? [{ tick: 0, headline: "MARKET STATUS: Normal operations active. Awaiting shocks." }] 
                : [...(currentGame?.marketEvents || [])].reverse().slice(0, 5)
              ).map((ev, idx) => (
                <div key={idx} className="ticker-item">
                  <span className="text-[#ffaa00] mr-2">[TICK {ev.tick}]</span>
                  <span className="text-secondary">{ev.headline}</span>
                </div>
              ))}
              {/* Duplicate items for marquee layout flow */}
              {(currentGame?.marketEvents.length === 0 
                ? [{ tick: 0, headline: "MARKET STATUS: Normal operations active. Awaiting shocks." }] 
                : [...(currentGame?.marketEvents || [])].reverse().slice(0, 5)
              ).map((ev, idx) => (
                <div key={`dup-${idx}`} className="ticker-item">
                  <span className="text-[#ffaa00] mr-2">[TICK {ev.tick}]</span>
                  <span className="text-secondary">{ev.headline}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Lobby View Faction Assignment (setup state) */}
          {isSetup ? (
            <main className="flex-1 p-8 flex flex-col gap-6 z-10 overflow-y-auto">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold tracking-wide uppercase text-neon-yellow">Lobby setup: {currentGame?.name}</h2>
                  <p className="text-xs text-secondary uppercase font-mono">
                    Session invite code: <span className="text-neon-cyan font-bold">{currentGame?.gameId.substring(0, 8).toUpperCase()}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={pollGame} className="btn-terminal">
                    <RefreshCw className="h-4 w-4" /> FORCE REFRESH
                  </button>
                  {isHost && (
                    <button 
                      onClick={() => dispatchAction({ type: 'start' })}
                      className="btn-terminal btn-green"
                      disabled={activeFactions.length < 2}
                    >
                      <Play className="h-4 w-4" /> START TRADING SESSION
                    </button>
                  )}
                </div>
              </div>

              {activeFactions.length < 2 && (
                <div className="border border-[#ffaa00]/30 bg-[#ffaa00]/10 p-4 font-mono text-sm text-neon-yellow">
                  WARNING: A minimum of 2 active players are required to start the simulation. Configure slots or share the invite code with other commanders.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
                {/* Players Slots Card */}
                <div className="glass-panel p-6 md:col-span-2 flex flex-col">
                  <h3 className="font-mono text-secondary font-semibold uppercase mb-4 flex items-center gap-2">
                    <Users className="h-5 w-5" /> ASSIGNED TRADER SLOTS
                  </h3>

                  <div className="flex-grow flex flex-col gap-3">
                    {currentGame?.players.map((p: Player) => (
                      <LobbyPlayerRow
                        key={p.id}
                        player={p}
                        isHost={isHost}
                        onUpdateSlot={(playerId, updates) => handleAssignSlot(playerId, updates.email ?? null, undefined, updates.isAi, updates.aiDifficulty, updates.isLocal, updates.name)}
                      />
                    ))}
                  </div>
                </div>

                {/* Join requests for Host */}
                <div className="glass-panel p-6 flex flex-col min-h-[300px]">
                  <h3 className="font-mono text-secondary font-semibold uppercase mb-4 flex items-center gap-2">
                    <Bell className="h-5 w-5" /> JOIN AUTHORIZATION REQUESTS
                  </h3>

                  <div className="flex-grow overflow-y-auto flex flex-col gap-3">
                    {!isHost ? (
                      <div className="text-center py-8 text-secondary font-mono text-xs uppercase">
                        Awaiting Host slot assignment...
                      </div>
                    ) : joinRequests.length === 0 ? (
                      <div className="text-center py-8 text-secondary font-mono text-xs uppercase">
                        No pending join requests.
                      </div>
                    ) : (
                      joinRequests.map((req: any) => {
                        const assignableSlots = currentGame?.players.filter(p => !p.isHost && !p.assignedEmail) || [];
                        const selectedSlotId = joinAssignSlot[req.id] || (assignableSlots[0]?.id || '');

                        return (
                          <div key={req.id} className="border border-white/10 bg-white/5 p-3 rounded flex flex-col gap-2 font-mono text-xs">
                            <div className="font-bold text-neon-cyan">{req.display_name}</div>
                            <div className="text-secondary text-2xs truncate">{req.email}</div>
                            
                            {assignableSlots.length > 0 ? (
                              <div className="flex flex-col gap-2 mt-1">
                                <div className="flex items-center gap-1.5 text-2xs">
                                  <span className="text-secondary font-bold">ASSIGN TO:</span>
                                  <select
                                    value={selectedSlotId}
                                    onChange={e => setJoinAssignSlot(prev => ({ ...prev, [req.id]: e.target.value }))}
                                    className="terminal-input py-0.5 px-1 bg-black text-white text-2xs flex-1"
                                  >
                                    {assignableSlots.map(slot => (
                                      <option key={slot.id} value={slot.id}>{slot.name}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="flex justify-end gap-2 mt-1">
                                  <button 
                                    onClick={() => handleRejectRequest(req.id)}
                                    className="btn-terminal btn-magenta py-0.5 px-2 text-2xs"
                                  >
                                    REJECT
                                  </button>
                                  <button 
                                    onClick={() => selectedSlotId && handleAssignSlot(selectedSlotId, req.email, req.id)}
                                    className="btn-terminal btn-green py-0.5 px-2 text-2xs"
                                    disabled={!selectedSlotId}
                                  >
                                    APPROVE
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex justify-between items-center mt-1">
                                <span className="text-neon-magenta text-3xs font-bold uppercase">NO VACANT SLOTS</span>
                                <button 
                                  onClick={() => handleRejectRequest(req.id)}
                                  className="btn-terminal btn-magenta py-0.5 px-2 text-2xs"
                                >
                                  REJECT
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </main>
          ) : (
            /* Active Simulation Room Dashboard */
            <main className="flex-grow p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 overflow-hidden z-10">
              
              {/* Left Column: Stocks ticker list */}
              <div className="glass-panel p-4 flex flex-col gap-4 overflow-y-auto">
                <h3 className="font-mono text-secondary font-semibold uppercase border-b border-white/5 pb-2">
                  MARKET QUOTES
                </h3>

                <div className="flex flex-col gap-2">
                  {currentGame?.companies.map((c: Company) => {
                    const isSelected = c.id === selectedCompanyId;
                    const change = c.priceHistory.length >= 2 
                      ? c.price - c.priceHistory[c.priceHistory.length - 2]
                      : 0;
                    const pct = c.priceHistory.length >= 2 
                      ? (change / c.priceHistory[c.priceHistory.length - 2]) * 100
                      : 0;
                    const isUp = change >= 0;

                    return (
                      <button
                        key={c.id}
                        onClick={() => setSelectedCompanyId(c.id)}
                        className={`w-full border p-3 rounded flex items-center justify-between text-left font-mono transition-all bg-transparent cursor-pointer ${
                          isSelected 
                            ? 'border-neon-bright bg-[#00f0ff]/5 shadow-[0_0_10px_rgba(0,240,255,0.1)]' 
                            : 'border-white/5 bg-white/2 hover:bg-white/5'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-sm tracking-wider">{c.symbol}</div>
                          <div className="text-secondary text-2xs truncate max-w-[120px]">{c.name}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-sm text-neon-cyan">${c.price.toFixed(2)}</div>
                          <div className={`text-2xs flex items-center gap-0.5 justify-end ${isUp ? 'text-neon-green' : 'text-neon-magenta'}`}>
                            {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {isUp ? '+' : ''}{pct.toFixed(2)}%
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Middle 2 Columns: Detailed Chart, Description, and Order Desk */}
              <div className="lg:col-span-2 flex flex-col gap-6 overflow-y-auto">
                {/* Main Graph Card */}
                {selectedCompany ? (
                  <div className="glass-panel p-5 flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <Building className="h-5 w-5 text-neon-cyan" />
                          <h2 className="text-xl font-bold tracking-wider">{selectedCompany.name} ({selectedCompany.symbol})</h2>
                        </div>
                        <p className="text-xs text-secondary mt-1 max-w-[400px]">{selectedCompany.description}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xs text-secondary uppercase font-mono">Current Quote</div>
                        <div className="text-2xl font-bold telemetry text-neon-cyan">${selectedCompany.price.toFixed(2)}</div>
                      </div>
                    </div>

                    {/* SVG Line Graph */}
                    <div className="border border-white/5 bg-black/40 rounded p-4 h-[180px] flex items-center justify-center relative overflow-hidden">
                      <div className="absolute top-2 left-4 text-3xs font-mono text-secondary uppercase z-10">TICK INDEX PRICE HISTORY</div>
                      <StockChart 
                        history={selectedCompany.priceHistory} 
                        isUp={selectedCompany.price >= (selectedCompany.priceHistory[selectedCompany.priceHistory.length - 2] || selectedCompany.price)} 
                      />
                    </div>
                  </div>
                ) : (
                  <div className="glass-panel p-6 flex-1 flex items-center justify-center text-secondary font-mono text-sm uppercase">
                    Select a quote to display asset charts
                  </div>
                )}

                {/* Order execution form */}
                {selectedCompany && (
                  <div className="glass-panel glass-panel-cyan p-5">
                    <h3 className="font-mono text-neon-cyan font-semibold uppercase border-b border-[#00f0ff]/15 pb-2 mb-4 flex items-center gap-2">
                      <ArrowRightLeft className="h-5 w-5" /> HIGH-FREQUENCY ORDER DESK
                    </h3>

                    {gameActionError && (
                      <div className="mb-4 border border-[#ff007f]/30 bg-[#ff007f]/10 p-3 font-mono text-xs text-neon-magenta">
                        TRANSACTION ABORTED: {gameActionError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Left: Quantity and totals */}
                      <div className="flex flex-col gap-4 font-mono">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-secondary uppercase">Order Quantity</label>
                          <div className="flex gap-1">
                            <input 
                              type="number" 
                              min={1} 
                              className="terminal-input flex-grow text-base"
                              value={tradeQuantity}
                              onChange={e => setTradeQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                            />
                            <div className="flex flex-col gap-0.5">
                              <button onClick={() => setTradeQuantity(1)} className="border border-white/10 px-1 bg-white/2 hover:bg-white/5 rounded text-3xs cursor-pointer">1</button>
                              <button onClick={() => setTradeQuantity(10)} className="border border-white/10 px-1 bg-white/2 hover:bg-white/5 rounded text-3xs cursor-pointer">10</button>
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <button onClick={() => setTradeQuantity(100)} className="border border-white/10 px-1 bg-white/2 hover:bg-white/5 rounded text-3xs cursor-pointer">100</button>
                              <button 
                                onClick={() => {
                                  if (myPlayer) {
                                    setTradeQuantity(Math.floor(myPlayer.cash / selectedCompany.price));
                                  }
                                }} 
                                className="border border-white/10 px-1 bg-white/2 hover:bg-white/5 rounded text-3xs text-neon-green cursor-pointer"
                              >
                                MAX
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-3">
                          <div>
                            <div className="text-3xs text-secondary uppercase">Estimated Value</div>
                            <div className="text-lg font-bold text-neon-cyan">${(tradeQuantity * selectedCompany.price).toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-3xs text-secondary uppercase">Estimated Impact</div>
                            <div className="text-sm font-bold text-neon-yellow">
                              +{( (tradeQuantity / selectedCompany.sharesOutstanding) * 50 ).toFixed(4)}% Price Shift
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right: Buy/Sell Triggers */}
                      <div className="flex flex-col justify-center gap-3">
                        <button 
                          onClick={() => dispatchAction({ type: 'buy', companyId: selectedCompany.id, quantity: tradeQuantity })}
                          className="btn-terminal btn-green py-3 text-base"
                          disabled={isCompleted}
                        >
                          BUY SHARES (LONG)
                        </button>
                        <button 
                          onClick={() => dispatchAction({ type: 'sell', companyId: selectedCompany.id, quantity: tradeQuantity })}
                          className="btn-terminal btn-magenta py-3 text-base"
                          disabled={isCompleted || myStockCount < tradeQuantity}
                        >
                          SELL SHARES (SHORT)
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Leaderboard, Portfolio, and Host Controls */}
              <div className="glass-panel p-4 flex flex-col gap-6 overflow-y-auto">
                {/* Faction Holdings */}
                <div>
                  <h3 className="font-mono text-secondary font-semibold uppercase border-b border-white/5 pb-2 mb-3">
                    FACTION LEDGER
                  </h3>
                  
                  {myPlayer ? (
                    <div className="flex flex-col gap-3 font-mono">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="border border-white/5 bg-white/2 p-2 rounded">
                          <div className="text-3xs text-secondary uppercase">Cash Balance</div>
                          <div className="text-sm font-bold text-neon-cyan">${myPlayer.cash.toLocaleString()}</div>
                        </div>
                        <div className="border border-white/5 bg-white/2 p-2 rounded">
                          <div className="text-3xs text-secondary uppercase">Portfolio Value</div>
                          <div className="text-sm font-bold text-neon-green">
                            ${currentGame ? (calculateNetWorth(myPlayer, currentGame.companies) - myPlayer.cash).toLocaleString() : '0'}
                          </div>
                        </div>
                      </div>
                      
                      <div className="border border-white/5 bg-white/2 p-3 rounded">
                        <div className="text-3xs text-secondary uppercase text-center">TOTAL NET WORTH</div>
                        <div className="text-xl font-bold text-neon-cyan text-center mt-1">
                          ${currentGame ? calculateNetWorth(myPlayer, currentGame.companies).toLocaleString() : '0'}
                        </div>
                      </div>

                      {/* List shares holdings */}
                      <div className="border border-white/5 bg-white/2 rounded p-2 text-xs">
                        <div className="text-3xs text-secondary uppercase pb-1 mb-1 border-b border-white/5 font-bold">HOLDINGS INVENTORY</div>
                        {currentGame?.companies.map(c => {
                          const owned = myPlayer.portfolio[c.id] || 0;
                          if (owned === 0) return null;
                          return (
                            <div key={c.id} className="flex justify-between py-0.5">
                              <span className="text-secondary">{c.symbol}:</span>
                              <span className="font-bold">{owned} ({ (owned * c.price).toLocaleString() }$)</span>
                            </div>
                          );
                        })}
                        {Object.values(myPlayer.portfolio).every(v => v === 0) && (
                          <div className="text-center py-2 text-3xs text-secondary uppercase">Lobby portfolio empty. Execute trades.</div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-secondary font-mono text-xs uppercase border border-white/5 bg-white/2 rounded">
                      Spectating lobby session
                    </div>
                  )}
                </div>

                {/* Leaderboard */}
                <div>
                  <div className="flex justify-between items-center border-b border-white/5 pb-2 mb-3">
                    <h3 className="font-mono text-secondary font-semibold uppercase">
                      NET WORTH LEADERBOARD
                    </h3>
                    <button 
                      onClick={() => {
                        setSelectedDossierPlayerId(myPlayer?.id || currentGame?.players[0]?.id || null);
                        setIsDossierOpen(true);
                      }}
                      className="btn-terminal text-3xs py-0.5 px-1.5 flex items-center gap-1"
                      title="Inspect Factions Dossiers"
                    >
                      <Eye className="h-3.5 w-3.5" /> DOSSIERS
                    </button>
                  </div>

                  <div className="flex flex-col gap-2 font-mono text-xs">
                    {sortedLeaderboard.map((p, idx) => (
                      <div 
                        key={p.id} 
                        onClick={() => {
                          setSelectedDossierPlayerId(p.id);
                          setIsDossierOpen(true);
                        }}
                        className={`flex justify-between items-center border border-white/5 bg-white/2 p-2 rounded cursor-pointer hover:border-neon-bright hover:bg-[#00f0ff]/5 hover:shadow-[0_0_8px_rgba(0,240,255,0.15)] transition-all`}
                        title="Click to inspect profile"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-secondary font-bold">#{idx + 1}</span>
                          <div className={`h-2 w-2 rounded-full ${p.isHost ? 'bg-neon-cyan' : p.assignedEmail ? (p.isAi ? 'bg-neon-yellow' : 'bg-neon-green') : 'bg-secondary'}`} />
                          <span className="font-semibold truncate max-w-[80px]">{p.name}</span>
                          {p.assignedEmail === user?.email && <span className="text-3xs border border-[#39ff14] px-0.5 rounded text-neon-green">YOU</span>}
                          {p.id === activeLocalPlayerId && p.assignedEmail !== user?.email && <span className="text-3xs border border-neon-cyan px-0.5 rounded text-neon-cyan">ACTING AS</span>}
                        </div>
                        <div className="font-bold text-neon-cyan">${p.netWorth.toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Host session ticker control */}
                <div>
                  <h3 className="font-mono text-secondary font-semibold uppercase border-b border-white/5 pb-2 mb-3">
                    SIMULATION CONTROLS
                  </h3>
                  <div className="flex flex-col gap-2 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-secondary">Current Tick:</span>
                      <span className="font-bold">{currentTick} / {currentGame?.maxTicks === 0 ? '∞' : currentGame?.maxTicks}</span>
                    </div>
                    <div className="flex justify-between mb-2">
                      <span className="text-secondary">Room status:</span>
                      <span className={`font-bold uppercase ${
                        isCompleted ? 'text-neon-magenta' : 'text-neon-green'
                      }`}>
                        {currentGame?.status}
                      </span>
                    </div>

                    {myPlayer && !myPlayer.isAi && !myPlayer.endedTurn && !isCompleted && (
                      <button 
                        onClick={() => dispatchAction({ type: 'end_turn' })}
                        className="btn-terminal btn-sci-fi py-2 w-full text-xs pulse-light font-bold mb-1"
                      >
                        END TURN & SUBMIT
                      </button>
                    )}

                    {myPlayer && !myPlayer.isAi && myPlayer.endedTurn && !isCompleted && (
                      <div className="text-center py-2 text-neon-green font-mono text-xs uppercase border border-[#39ff14]/30 bg-[#39ff14]/10 rounded mb-1">
                        ✓ TURN COMPLETED
                      </div>
                    )}

                    {isHost && !isCompleted && (
                      <button 
                        onClick={() => dispatchAction({ type: 'tick' })}
                        className="btn-terminal btn-green py-2 w-full text-xs"
                      >
                        ADVANCE MARKET TICK (+1 DAY)
                      </button>
                    )}
                  </div>
                </div>

              </div>
            </main>
          )}

        </div>
      )}

      {/* Factions Dossier & Portfolio Inspector Modal */}
      {isDossierOpen && (
        <PlayerDossierModal
          onClose={() => setIsDossierOpen(false)}
          players={currentGame?.players || []}
          companies={currentGame?.companies || []}
          selectedPlayerId={selectedDossierPlayerId}
          onSelectPlayer={setSelectedDossierPlayerId}
          currentUserEmail={user?.email || null}
          activeLocalPlayerId={activeLocalPlayerId}
          status={currentGame?.status}
        />
      )}

      {/* Local Pass-and-Play Transition Overlay */}
      {passTurnActive && currentGame && (
        <PassTurnOverlay
          nextPlayer={currentGame.players[currentGame.activePlayerIdx]}
          onStartTurn={() => setPassTurnActive(false)}
          endedPlayerName={lastEndedPlayerName}
          onCancelEndTurn={
            currentGame.players.some(p => p.endedTurn && (p.assignedEmail === user?.email || (p.isLocal && isHost)))
              ? () => dispatchAction({ type: 'cancel_end_turn' })
              : undefined
          }
        />
      )}
    </div>
  );
}

// ----------------------------------------------------
// Factions Dossier & Portfolio Inspector Subcomponents
// ----------------------------------------------------

interface PlayerDossierModalProps {
  onClose: () => void;
  players: Player[];
  companies: Company[];
  selectedPlayerId: string | null;
  onSelectPlayer: (id: string) => void;
  currentUserEmail: string | null;
  activeLocalPlayerId: string | null;
  status?: string;
}

function NetWorthSparkline({ history }: { history: number[] }) {
  if (!history || history.length < 2) {
    return <div className="text-3xs text-secondary uppercase font-mono py-4 text-center">Awaiting financial history...</div>;
  }
  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min === 0 ? 1 : max - min;
  const width = 400;
  const height = 80;
  const padding = 8;
  
  const points = history.map((val, idx) => {
    const x = padding + (idx / (history.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((val - min) / range) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');

  const isUp = history[history.length - 1] >= history[0];
  const strokeColor = isUp ? '#39ff14' : '#ff007f';
  const fillPoints = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`;
  
  return (
    <div className="border border-white/5 bg-black/50 p-3 rounded flex flex-col gap-1.5 w-full">
      <div className="flex justify-between items-center text-3xs font-mono text-secondary uppercase">
        <span>NET WORTH PERFORMANCE ({history.length} ticks)</span>
        <span className={isUp ? 'text-neon-green' : 'text-neon-magenta'}>
          {isUp ? 'SURGE' : 'LOSS'} (Start: ${history[0].toLocaleString()})
        </span>
      </div>
      <div className="h-[80px] relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" style={{ overflow: 'visible' }}>
          <defs>
            <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.2" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>
          {/* Horizontal lines */}
          <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" />
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="rgba(255,255,255,0.03)" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.03)" />
          
          {/* Gradient Area */}
          <polyline fill="url(#nwGrad)" points={fillPoints} />
          {/* Line */}
          <polyline fill="none" stroke={strokeColor} strokeWidth="1.5" points={points} />
          {/* Circles on key points */}
          <circle cx={padding} cy={height - padding - ((history[0] - min) / range) * (height - 2 * padding)} r="2.5" fill={strokeColor} />
          <circle cx={width - padding} cy={height - padding - ((history[history.length - 1] - min) / range) * (height - 2 * padding)} r="3" fill={strokeColor} className="pulse-light" />
        </svg>
      </div>
    </div>
  );
}

function PlayerDossierModal({
  onClose,
  players,
  companies,
  selectedPlayerId,
  onSelectPlayer,
  currentUserEmail,
  activeLocalPlayerId
}: PlayerDossierModalProps) {
  const activePlayers = players.filter(p => !isPlayerVacant(p, status));
  const activePlayer = activePlayers.find(p => p.id === selectedPlayerId) || activePlayers[0] || null;

  if (!activePlayer) return null;

  const netWorth = calculateNetWorth(activePlayer, companies);
  const startingNetWorth = activePlayer.netWorthHistory?.[0] || 100000;
  const roi = ((netWorth - startingNetWorth) / startingNetWorth) * 100;
  const cash = activePlayer.cash;
  const portfolioVal = netWorth - cash;
  const cashPct = netWorth > 0 ? (cash / netWorth) * 100 : 100;
  const portfolioPct = netWorth > 0 ? (portfolioVal / netWorth) * 100 : 0;

  const getPlayerBio = (p: Player) => {
    if (p.isHost) {
      return "Faction Host and Market Controller. Possesses administrative control to advance time ticks and configure simulation nodes.";
    }
    if (p.isAi) {
      if (p.aiDifficulty === 'easy') {
        return "Automated Trading Bot (Novice). Employs conservative and random trading patterns. Low risk profile, minimal market capital impact.";
      }
      if (p.aiDifficulty === 'hard') {
        return "Automated Trading Bot (Brutal). High-frequency algorithmic agent. Constantly scans market headlines and utilizes momentum analytics for high-volume trading.";
      }
      return "Automated Trading Bot (Standard). Employs standard moving average crossovers and mean reversion technical indicators.";
    }
    if (p.assignedEmail) {
      return `Remote commander faction node connected via secure session protocols. Email: ${p.assignedEmail}`;
    }
    return "Local participant node. Shares physical terminal console interface (Local Pass-and-Play).";
  };

  const getPlayerTypeLabel = (p: Player) => {
    if (p.isHost) return "HOST COORDINATOR";
    if (p.isAi) return `AI BOT (${(p.aiDifficulty || 'medium').toUpperCase()})`;
    if (p.assignedEmail) return "REMOTE PLAYER";
    return "LOCAL PLAYER";
  };

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
      <div className="glass-panel glass-panel-cyan w-full max-w-4xl h-[600px] flex flex-col overflow-hidden relative">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-[#00f0ff]/15 bg-black/40">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-neon-cyan" />
            <div>
              <h3 className="font-mono text-neon-cyan text-base uppercase font-bold tracking-wider">
                FACTIONS DOSSIER & ASSET LEDGER
              </h3>
              <p className="text-3xs text-secondary uppercase font-mono">Real-time surveillance of network market participants</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-secondary hover:text-neon-magenta bg-transparent border-0 cursor-pointer p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar: Player List */}
          <div className="w-64 border-r border-white/5 flex flex-col overflow-y-auto p-4 gap-2 bg-black/20">
            <div className="text-3xs font-mono text-secondary uppercase pb-2 border-b border-white/5 mb-1 font-bold">
              ACTIVE TRADERS ({activePlayers.length})
            </div>
            {activePlayers.map((p, idx) => {
              const isActive = p.id === activePlayer.id;
              const pNetWorth = calculateNetWorth(p, companies);
              return (
                <button
                  key={p.id}
                  onClick={() => onSelectPlayer(p.id)}
                  className={`w-full text-left border p-2.5 rounded font-mono flex flex-col gap-1 transition-all bg-transparent cursor-pointer ${
                    isActive 
                      ? 'border-neon-bright bg-[#00f0ff]/5 shadow-[0_0_8px_rgba(0,240,255,0.15)]' 
                      : 'border-white/5 hover:bg-white/2'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <span className="text-3xs text-secondary font-bold">#{idx + 1}</span>
                      <div className={`h-2 w-2 rounded-full ${p.isHost ? 'bg-neon-cyan' : p.assignedEmail ? (p.isAi ? 'bg-neon-yellow' : 'bg-neon-green') : 'bg-secondary'}`} />
                      <span className="font-semibold text-xs truncate max-w-[100px]">{p.name}</span>
                    </div>
                    {p.assignedEmail === currentUserEmail && <span className="text-[8px] border border-[#39ff14] px-0.5 rounded text-neon-green">YOU</span>}
                    {p.id === activeLocalPlayerId && p.assignedEmail !== currentUserEmail && <span className="text-[8px] border border-neon-cyan px-0.5 rounded text-neon-cyan">ACTING</span>}
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="text-[9px] text-secondary font-sans">{getPlayerTypeLabel(p)}</span>
                    <span className="text-xs font-bold text-neon-cyan">${pNetWorth.toLocaleString()}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Section: Detailed Profile */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
            {/* Bio info */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/2 border border-white/10 rounded-lg flex-shrink-0">
                  {activePlayer.isAi ? (
                    <Bot className="h-8 w-8 text-neon-yellow" />
                  ) : activePlayer.isHost ? (
                    <Shield className="h-8 w-8 text-neon-cyan" />
                  ) : (
                    <User className="h-8 w-8 text-neon-green" />
                  )}
                </div>
                <div>
                  <h4 className="text-base font-bold text-white leading-tight flex items-center gap-2">
                    {activePlayer.name}
                    <span className={`text-3xs px-1.5 py-0.5 border rounded ${
                      activePlayer.isHost ? 'border-neon-cyan text-neon-cyan' :
                      activePlayer.isAi ? 'border-neon-yellow text-neon-yellow' :
                      'border-neon-green text-neon-green'
                    }`}>
                      {getPlayerTypeLabel(activePlayer)}
                    </span>
                  </h4>
                  <p className="text-xs text-secondary mt-1 font-sans max-w-[450px]">
                    {getPlayerBio(activePlayer)}
                  </p>
                </div>
              </div>
              
              {/* ROI and status indicators */}
              <div className="flex flex-col font-mono text-right items-end">
                <div className="text-3xs text-secondary uppercase">GROWTH ROI</div>
                <div className={`text-lg font-bold flex items-center gap-0.5 ${roi >= 0 ? 'text-neon-green' : 'text-neon-magenta'}`}>
                  {roi >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {roi >= 0 ? '+' : ''}{roi.toFixed(2)}%
                </div>
              </div>
            </div>

            {/* Financial Telemetry Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
              <div className="border border-white/5 bg-white/2 p-3 rounded flex flex-col">
                <div className="text-3xs text-secondary uppercase flex items-center gap-1">
                  <Coins className="h-3.5 w-3.5 text-neon-cyan" /> NET WORTH VALUE
                </div>
                <div className="text-base font-bold text-neon-cyan mt-1">${netWorth.toLocaleString()}</div>
                <div className="text-[10px] text-secondary mt-0.5">Cash + Stock Assets</div>
              </div>
              <div className="border border-white/5 bg-white/2 p-3 rounded flex flex-col">
                <div className="text-3xs text-secondary uppercase flex items-center gap-1">
                  <Coins className="h-3.5 w-3.5 text-neon-green" /> CASH LIQUIDITY
                </div>
                <div className="text-base font-bold text-neon-green mt-1">${cash.toLocaleString()}</div>
                <div className="text-[10px] text-secondary mt-0.5">{cashPct.toFixed(1)}% of Net Worth</div>
              </div>
              <div className="border border-white/5 bg-white/2 p-3 rounded flex flex-col">
                <div className="text-3xs text-secondary uppercase flex items-center gap-1">
                  <PieChart className="h-3.5 w-3.5 text-neon-magenta" /> STOCK PORTFOLIO
                </div>
                <div className="text-base font-bold text-neon-magenta mt-1">${portfolioVal.toLocaleString()}</div>
                <div className="text-[10px] text-secondary mt-0.5">{portfolioPct.toFixed(1)}% of Net Worth</div>
              </div>
            </div>

            {/* Asset Allocation Percentage Bar */}
            <div className="flex flex-col gap-1.5 font-mono text-xs">
              <div className="flex justify-between items-center text-3xs text-secondary uppercase">
                <span>Asset Allocation Ratio</span>
                <span className="flex gap-3">
                  <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-neon-green" /> Cash ({cashPct.toFixed(0)}%)</span>
                  <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-neon-magenta" /> Stocks ({portfolioPct.toFixed(0)}%)</span>
                </span>
              </div>
              <div className="h-3 w-full bg-black/40 border border-white/5 rounded-full overflow-hidden flex">
                <div 
                  style={{ width: `${cashPct}%` }} 
                  className="h-full bg-neon-green transition-all duration-500" 
                  title={`Cash: ${cashPct.toFixed(1)}%`}
                />
                <div 
                  style={{ width: `${portfolioPct}%` }} 
                  className="h-full bg-neon-magenta transition-all duration-500" 
                  title={`Stocks: ${portfolioPct.toFixed(1)}%`}
                />
              </div>
            </div>

            {/* Net Worth Sparkline Line Graph */}
            <NetWorthSparkline history={activePlayer.netWorthHistory || []} />

            {/* Faction Holdings Table */}
            <div className="border border-white/5 bg-black/30 rounded p-4 flex flex-col gap-3 font-mono">
              <div className="text-3xs text-secondary uppercase font-bold border-b border-white/5 pb-2 flex justify-between items-center">
                <span>HOLDINGS LEDGER & PORTFOLIO WEIGHTS</span>
                <span>Active shares</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr className="text-secondary text-3xs uppercase pb-1 mb-1 border-b border-white/5">
                      <th className="py-2 px-1">SYMBOL</th>
                      <th className="py-2 px-2">COMPANY</th>
                      <th className="py-2 px-2 text-right">SHARES</th>
                      <th className="py-2 px-2 text-right">PRICE</th>
                      <th className="py-2 px-2 text-right">TOTAL VALUE</th>
                      <th className="py-2 px-1 text-right">WEIGHT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map(c => {
                      const owned = activePlayer.portfolio[c.id] || 0;
                      if (owned === 0) return null;

                      const val = owned * c.price;
                      const weight = portfolioVal > 0 ? (val / portfolioVal) * 100 : 0;

                      return (
                        <tr key={c.id} className="border-b border-white/5 hover:bg-white/2">
                          <td className="py-2 px-1 font-bold text-neon-cyan">{c.symbol}</td>
                          <td className="py-2 px-2 text-secondary text-2xs truncate max-w-[120px] font-sans">{c.name}</td>
                          <td className="py-2 px-2 text-right font-semibold">{owned.toLocaleString()}</td>
                          <td className="py-2 px-2 text-right text-secondary">${c.price.toFixed(2)}</td>
                          <td className="py-2 px-2 text-right font-bold text-neon-cyan">${val.toLocaleString()}</td>
                          <td className="py-2 px-1 text-right text-neon-yellow">{weight.toFixed(1)}%</td>
                        </tr>
                      );
                    })}

                    {Object.values(activePlayer.portfolio).every(v => v === 0) && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-secondary uppercase text-3xs">
                          Portfolio is fully liquid. 100% Capital holding in cash reserves.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
