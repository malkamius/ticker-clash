// Load environment variables from .env file if it exists
try {
  const fs = require('fs');
  const path = require('path');
  const envPath = path.resolve(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }
} catch (e) {
  console.warn('Failed to load local environment file:', e.message);
}

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const { OAuth2Client } = require('google-auth-library');

const { initializeGame, tickMarket, executeAction, endTurn, cancelEndTurn, isPlayerVacant, generateRandomGameName } = require('./src/game/dist/gameState.js');

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// Initialize SQLite database
const dbPath = process.env.DATABASE_PATH || 'ticker_clash.db';
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection failed:', err.message);
  } else {
    console.log(`Connected to ${dbPath} SQLite database.`);
  }
});

// Setup database tables
db.serialize(() => {
  db.run("PRAGMA journal_mode=WAL");
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      display_name TEXT,
      password_hash TEXT,
      is_google_linked INTEGER DEFAULT 0,
      games_played INTEGER DEFAULT 0,
      games_won INTEGER DEFAULT 0,
      created_at TEXT
    )
  `);

  db.run("ALTER TABLE users ADD COLUMN is_google_linked INTEGER DEFAULT 0", (err) => {
    // Ignore error if column already exists
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      email TEXT,
      expires_at TEXT,
      csrf_token TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      invite_code TEXT UNIQUE,
      owner_email TEXT,
      name TEXT,
      game_state TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS join_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT,
      email TEXT,
      display_name TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT
    )
  `);
  console.log('Database tables verified/created successfully.');
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());
app.use(cors({
  origin: true,
  credentials: true
}));

// In-memory presence tracker
const activePresence = new Map(); // gameId -> Map(email -> timestamp)

function updatePresence(gameId, email) {
  if (!activePresence.has(gameId)) {
    activePresence.set(gameId, new Map());
  }
  activePresence.get(gameId).set(email, Date.now());
}

function getPresence(gameId) {
  if (!activePresence.has(gameId)) return [];
  const now = Date.now();
  const list = [];
  for (const [email, ts] of activePresence.get(gameId).entries()) {
    if (now - ts < 10000) { // 10s timeout
      list.push(email);
    }
  }
  return list;
}

// CSRF Initialisation
app.get('/api/csrf-init', (req, res) => {
  const csrfToken = crypto.randomBytes(24).toString('hex');
  res.cookie('csrf_token', csrfToken, {
    httpOnly: false,
    path: '/',
    sameSite: 'lax',
    secure: false
  });
  res.status(200).json({ success: true, csrfToken });
});

// CSRF Validation Middleware
function validateCSRF(req, res, next) {
  // If custom header auth or non-browser client, bypass CSRF
  if (req.headers['x-session-id']) {
    return next();
  }
  const cookieToken = req.cookies['csrf_token'];
  const headerToken = req.headers['x-csrf-token'];
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    console.warn('CSRF validation failed.');
    return res.status(403).json({ error: 'CSRF token validation failed.' });
  }
  next();
}

// Session User Retrieval Helper
function getSessionUser(req, callback) {
  const sessionId = req.headers['x-session-id'] || req.cookies['session_id'];
  if (!sessionId) {
    return callback(null, null);
  }

  const now = new Date().toISOString();
  db.get(
    `SELECT u.email, u.display_name, u.is_google_linked, u.games_played, u.games_won, u.password_hash 
     FROM sessions s 
     JOIN users u ON s.email = u.email 
     WHERE s.id = ? AND s.expires_at > ?`,
    [sessionId, now],
    (err, row) => {
      if (err) return callback(err, null);
      if (!row) return callback(null, null);
      callback(null, {
        email: row.email,
        displayName: row.display_name,
        isGoogleLinked: row.is_google_linked === 1,
        hasPassword: row.password_hash !== null && row.password_hash !== undefined,
        stats: { gamesPlayed: row.games_played, gamesWon: row.games_won }
      });
    }
  );
}

// --- AUTHENTICATION ENDPOINTS ---

app.post('/api/register', validateCSRF, (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || password.length < 6) {
    return res.status(400).json({ error: 'Valid email and password (min 6 characters) required.' });
  }

  const emailLower = email.trim().toLowerCase();
  db.get('SELECT email FROM users WHERE email = ?', [emailLower], (err, row) => {
    if (row) return res.status(400).json({ error: 'User already exists.' });

    const passwordHash = bcrypt.hashSync(password, 10);
    const now = new Date().toISOString();
    const displayName = emailLower.split('@')[0];

    db.run(
      'INSERT INTO users (email, display_name, password_hash, created_at) VALUES (?, ?, ?, ?)',
      [emailLower, displayName, passwordHash, now],
      (insErr) => {
        if (insErr) return res.status(500).json({ error: 'Registration failed.' });
        res.status(200).json({ success: true, message: 'User registered successfully.' });
      }
    );
  });
});

app.post('/api/login', validateCSRF, (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });

  const emailLower = email.trim().toLowerCase();
  db.get('SELECT email, display_name, password_hash, is_google_linked, games_played, games_won FROM users WHERE email = ?', [emailLower], (err, user) => {
    if (err || !user) return res.status(400).json({ error: 'User not found.' });

    if (!user.password_hash) {
      return res.status(400).json({
        error: 'This account was created with Google Sign-in. Please click "Sign in with Google" to access it.'
      });
    }

    const passwordMatch = bcrypt.compareSync(password, user.password_hash);
    if (!passwordMatch) return res.status(401).json({ error: 'Incorrect password.' });

    const sessionId = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hour session
    const csrfToken = crypto.randomBytes(24).toString('hex');

    db.run(
      'INSERT INTO sessions (id, email, expires_at, csrf_token) VALUES (?, ?, ?, ?)',
      [sessionId, emailLower, expiresAt, csrfToken],
      (sessErr) => {
        if (sessErr) return res.status(500).json({ error: 'Session creation failed.' });

        res.cookie('session_id', sessionId, {
          httpOnly: true,
          sameSite: 'lax',
          maxAge: 24 * 60 * 60 * 1000
        });

        res.cookie('csrf_token', csrfToken, {
          httpOnly: false,
          sameSite: 'lax',
          maxAge: 24 * 60 * 60 * 1000
        });

        res.status(200).json({
          success: true,
          sessionId,
          user: {
            email: user.email,
            displayName: user.display_name,
            isGoogleLinked: user.is_google_linked === 1,
            hasPassword: user.password_hash !== null,
            stats: { gamesPlayed: user.games_played, gamesWon: user.games_won }
          }
        });
      }
    );
  });
});

app.get('/api/me', (req, res) => {
  getSessionUser(req, (err, user) => {
    if (err || !user) return res.status(401).json({ error: 'Unauthorized.' });
    res.status(200).json({ success: true, user });
  });
});

app.post('/api/logout', (req, res) => {
  const sessionId = req.cookies['session_id'] || req.headers['x-session-id'];
  if (sessionId) {
    db.run('DELETE FROM sessions WHERE id = ?', [sessionId]);
  }
  res.clearCookie('session_id');
  res.clearCookie('csrf_token');
  res.status(200).json({ success: true, message: 'Logged out successfully.' });
});

// Initialize Google Client
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_CALLBACK_URL
);

// In-memory pending auth requests for Electron browser-based polling
const pendingAuths = new Map();

// Periodic cleanup of expired tokens (> 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of pendingAuths.entries()) {
    if (now - data.createdAt > 5 * 60 * 1000) {
      pendingAuths.delete(token);
    }
  }
}, 60000);

// Endpoint: Check if real Google OAuth is configured on the backend
app.get('/api/auth/google/config', (req, res) => {
  const isConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  res.status(200).json({ enabled: isConfigured });
});

// Endpoint: Poll for Electron/Capacitor browser authentication status
app.get('/api/auth/poll', (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).json({ error: 'Missing token parameter.' });
  }

  const auth = pendingAuths.get(token);
  if (!auth) {
    return res.status(200).json({ status: 'pending' });
  }

  if (auth.error) {
    pendingAuths.delete(token);
    return res.status(200).json({ status: 'error', error: auth.error });
  }

  // Success: return session ID
  pendingAuths.delete(token);
  return res.status(200).json({ status: 'success', sessionId: auth.sessionId });
});

// 1. Redirect User to Google
app.get('/api/auth/google', (req, res) => {
  const state = req.query.state || '';
  const url = googleClient.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/userinfo.email', 'profile'],
    state: state
  });
  res.redirect(url);
});

// Helper to render HTML auth pages for custom browser flows
function renderAuthResponseHtml(res, title, header, message, isSuccess) {
  const primaryColor = isSuccess ? '#39ff14' : '#ff007f';
  const shadowColor = isSuccess ? 'rgba(57, 255, 20, 0.2)' : 'rgba(255, 0, 127, 0.2)';
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap" rel="stylesheet">
        <style>
          body {
            background-color: #05030d;
            color: ${primaryColor};
            font-family: 'Share Tech Mono', monospace;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            text-align: center;
            overflow: hidden;
          }
          .container {
            border: 1px solid ${primaryColor};
            padding: 40px;
            background: rgba(0,0,0,0.85);
            box-shadow: 0 0 30px ${shadowColor};
            border-radius: 4px;
            max-width: 450px;
          }
          h1 {
            color: #00ffff;
            font-size: 24px;
            letter-spacing: 2px;
            margin-bottom: 20px;
            text-shadow: 0 0 10px rgba(0,255,255,0.3);
          }
          p {
            font-size: 15px;
            line-height: 1.6;
            margin: 15px 0;
          }
          .accent-glow {
            text-shadow: 0 0 8px ${primaryColor};
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>${header}</h1>
          <p class="accent-glow">${message}</p>
          <p style="color: #888; font-size: 12px; margin-top: 30px;">
            [COMMAND TERMINAL SECURED]
          </p>
        </div>
      </body>
    </html>
  `);
}

// 2. Handle the Callback from Google
app.get('/api/auth/callback/google', async (req, res) => {
  const { code, state } = req.query;

  const stateParams = new URLSearchParams(state || '');
  const isElectron = stateParams.get('source') === 'electron';
  const token = stateParams.get('token') || '';

  try {
    // Exchange code for tokens
    const { tokens } = await googleClient.getToken(code);
    googleClient.setCredentials(tokens);

    // Get user info (email)
    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload.email.toLowerCase();
    const displayName = payload.name;

    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
      if (user) {
        if (user.is_google_linked === 0) {
          db.run('UPDATE users SET is_google_linked = 1 WHERE email = ?', [email]);
        }
        finalizeOAuthLogin(req, res, user.email, user.games_played, user.games_won, 1, user.display_name || displayName, user.password_hash !== null, state);
      } else {
        const now = new Date().toISOString();
        db.run(
          'INSERT INTO users (email, display_name, password_hash, is_google_linked, created_at) VALUES (?, ?, NULL, 1, ?)',
          [email, displayName, now],
          function (insertErr) {
            if (insertErr) {
              if (isElectron && token) {
                pendingAuths.set(token, { error: 'db_fail', createdAt: Date.now() });
                return renderAuthResponseHtml(res, 'TickerClash Command Error', 'CONNECTION FAILURE', 'Database link operation failed.', false);
              }
              return res.redirect('/?error=db_fail');
            }
            finalizeOAuthLogin(req, res, email, 0, 0, 1, displayName, false, state);
          }
        );
      }
    });
  } catch (error) {
    console.error('Google OAuth Error:', error);
    if (isElectron && token) {
      pendingAuths.set(token, { error: 'oauth_failed', createdAt: Date.now() });
      return renderAuthResponseHtml(res, 'TickerClash OAuth Error', 'AUTHENTICATION FAILURE', 'Google OAuth callback link verification failed.', false);
    }
    res.redirect('/?error=oauth_failed');
  }
});

// Helper to set session cookies
function finalizeOAuthLogin(req, res, userEmail, gamesPlayed, gamesWon, isGoogleLinked, displayName, hasPassword, state) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hour session
  const csrfToken = crypto.randomBytes(24).toString('hex');

  const stateParams = new URLSearchParams(state || '');
  const isElectron = stateParams.get('source') === 'electron';
  const token = stateParams.get('token') || '';

  db.run(
    'INSERT INTO sessions (id, email, expires_at, csrf_token) VALUES (?, ?, ?, ?)',
    [sessionId, userEmail, expiresAt, csrfToken],
    (err) => {
      if (err) {
        if (isElectron && token) {
          pendingAuths.set(token, { error: 'session_fail', createdAt: Date.now() });
          return renderAuthResponseHtml(res, 'TickerClash Session Error', 'SESSION DEPLOYMENT FAILURE', 'Failed to generate user commander session.', false);
        }
        return res.redirect('/?error=session_fail');
      }

      res.cookie('session_id', sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
      });

      res.cookie('csrf_token', csrfToken, {
        httpOnly: false,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
      });

      if (isElectron && token) {
        pendingAuths.set(token, { sessionId, createdAt: Date.now() });
        return renderAuthResponseHtml(res, 'TickerClash Authenticated', 'COMMAND PROTOCOL ESTABLISHED', 'Commander authenticated successfully. You can now close this tab and return to the TickerClash console.', true);
      }

      res.redirect('/' + (state ? state : ''));
    }
  );
}

app.post('/api/stats', validateCSRF, (req, res) => {
  const { won } = req.body;
  getSessionUser(req, (err, user) => {
    if (err || !user) return res.status(401).json({ error: 'Unauthorized.' });

    const wonInc = won ? 1 : 0;
    db.run(
      'UPDATE users SET games_played = games_played + 1, games_won = games_won + ? WHERE email = ?',
      [wonInc, user.email],
      (updErr) => {
        if (updErr) return res.status(500).json({ error: 'Failed to update stats.' });
        
        db.get('SELECT games_played, games_won FROM users WHERE email = ?', [user.email], (selErr, row) => {
          if (selErr || !row) return res.status(200).json({ success: true });
          res.status(200).json({
            success: true,
            stats: { gamesPlayed: row.games_played, gamesWon: row.games_won }
          });
        });
      }
    );
  });
});

// --- GAMES API ENDPOINTS ---

// List all games that user is hosting or playing in
app.get('/api/games', (req, res) => {
  getSessionUser(req, (err, user) => {
    const guestName = req.headers['x-guest-name'] || null;
    const effectiveEmail = user ? user.email : guestName;

    if (!effectiveEmail) return res.status(401).json({ error: 'Authentication required.' });

    db.all(
      'SELECT id, invite_code, owner_email, name, game_state, created_at, updated_at FROM games WHERE owner_email = ? OR game_state LIKE ? ORDER BY updated_at DESC',
      [effectiveEmail, `%"assignedEmail":"${effectiveEmail}"%`],
      (queryErr, rows) => {
        if (queryErr) return res.status(500).json({ error: 'Database query failed.' });

        const gamesList = rows.map(row => {
          let parsedState = {};
          try { parsedState = JSON.parse(row.game_state); } catch (e) {}
          return {
            id: row.id,
            inviteCode: row.invite_code,
            ownerEmail: row.owner_email,
            name: row.name,
            gameState: parsedState,
            createdAt: row.created_at,
            updatedAt: row.updated_at
          };
        });

        res.status(200).json({ success: true, games: gamesList, totalCount: gamesList.length });
      }
    );
  });
});

// Create a new game simulation
app.post('/api/games', validateCSRF, (req, res) => {
  getSessionUser(req, (err, user) => {
    const guestName = req.headers['x-guest-name'] || null;
    const effectiveEmail = user ? user.email : guestName;

    if (!effectiveEmail) return res.status(401).json({ error: 'Authentication required.' });

    const { name, setupOptions } = req.body;
    let gameName = name ? name.trim() : '';
    if (!gameName) {
      gameName = generateRandomGameName();
    }

    const maxPlayers = setupOptions?.maxPlayers || 4;
    const startingCash = setupOptions?.startingCash || 100000;
    const maxTicks = (setupOptions?.maxTicks !== undefined && setupOptions?.maxTicks !== null) ? setupOptions.maxTicks : 40;

    const initialOptions = {
      name: gameName,
      hostName: user ? (user.displayName || effectiveEmail.split('@')[0]) : effectiveEmail,
      hostEmail: effectiveEmail,
      maxPlayers,
      startingCash,
      maxTicks
    };

    let gameState;
    try {
      gameState = initializeGame(initialOptions);
    } catch (initErr) {
      return res.status(500).json({ error: 'Game initialization failed.' });
    }

    const gameId = gameState.gameId;
    const inviteCode = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 char code
    const now = new Date().toISOString();
    const gameStateStr = JSON.stringify(gameState);

    db.run(
      'INSERT INTO games (id, invite_code, owner_email, name, game_state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [gameId, inviteCode, effectiveEmail, name, gameStateStr, now, now],
      (insErr) => {
        if (insErr) {
          console.error(insErr.message);
          return res.status(500).json({ error: 'Failed to create game.' });
        }
        res.status(201).json({ success: true, gameId, inviteCode, name });
      }
    );
  });
});

// Fetch full details of a specific game
app.get('/api/games/:id', (req, res) => {
  getSessionUser(req, (err, user) => {
    const gameId = req.params.id;
    const guestName = req.headers['x-guest-name'] || null;
    const presenceEmail = user ? user.email : guestName;

    db.get('SELECT * FROM games WHERE id = ?', [gameId], (queryErr, row) => {
      if (queryErr || !row) return res.status(404).json({ error: 'Game simulation not found.' });

      let parsedState = {};
      try { parsedState = JSON.parse(row.game_state); } catch (e) {}

      if (presenceEmail) {
        updatePresence(gameId, presenceEmail);
      }

      res.status(200).json({
        success: true,
        connectedPlayers: getPresence(gameId),
        game: {
          id: row.id,
          inviteCode: row.invite_code,
          ownerEmail: row.owner_email,
          name: row.name,
          gameState: parsedState,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }
      });
    });
  });
});

// Update game settings (e.g., change name)
app.put('/api/games/:id', validateCSRF, (req, res) => {
  getSessionUser(req, (err, user) => {
    const gameId = req.params.id;
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Game name required.' });

    db.run(
      'UPDATE games SET name = ?, updated_at = ? WHERE id = ?',
      [name, new Date().toISOString(), gameId],
      (updErr) => {
        if (updErr) return res.status(500).json({ error: 'Update failed.' });
        res.status(200).json({ success: true, message: 'Game name updated.' });
      }
    );
  });
});

// Delete game
app.delete('/api/games/:id', validateCSRF, (req, res) => {
  getSessionUser(req, (err, user) => {
    const gameId = req.params.id;
    db.run('DELETE FROM games WHERE id = ?', [gameId], (delErr) => {
      if (delErr) return res.status(500).json({ error: 'Decommission failed.' });
      res.status(200).json({ success: true, message: 'Game decommissioned.' });
    });
  });
});

// Presence ping
app.post('/api/games/:id/presence', validateCSRF, (req, res) => {
  const gameId = req.params.id;
  getSessionUser(req, (err, user) => {
    const guestName = req.headers['x-guest-name'] || null;
    const presenceEmail = user ? user.email : guestName;

    if (presenceEmail) {
      updatePresence(gameId, presenceEmail);
    }
    res.status(200).json({ success: true, connectedPlayers: getPresence(gameId) });
  });
});

// --- LOBBY JOIN / SLOTS ROUTING ---

// Submit a join request
app.post('/api/games/:gameId/join', validateCSRF, (req, res) => {
  const { gameId } = req.params;
  getSessionUser(req, (err, user) => {
    const guestName = req.headers['x-guest-name'] || null;
    const email = user ? user.email : guestName;

    if (!email) return res.status(401).json({ error: 'Identification required to join.' });

    const displayName = user ? (user.displayName || email.split('@')[0]) : email;
    const now = new Date().toISOString();

    db.get('SELECT id FROM join_requests WHERE game_id = ? AND email = ?', [gameId, email], (findErr, row) => {
      if (row) return res.status(200).json({ success: true, message: 'Join request already submitted.' });

      db.run(
        'INSERT INTO join_requests (game_id, email, display_name, status, created_at) VALUES (?, ?, ?, "pending", ?)',
        [gameId, email, displayName, now],
        function (insErr) {
          if (insErr) return res.status(500).json({ error: 'Failed to request join.' });
          res.status(200).json({ success: true, joinId: this.lastID, message: 'Join request submitted.' });
        }
      );
    });
  });
});

// Fetch pending requests
app.get('/api/games/:gameId/join-requests', (req, res) => {
  const { gameId } = req.params;
  db.all('SELECT id, email, display_name, status, created_at FROM join_requests WHERE game_id = ? AND status = "pending"', [gameId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error.' });
    res.status(200).json({ success: true, requests: rows });
  });
});

// Check join status
app.get('/api/games/:gameId/my-join-status', (req, res) => {
  const { gameId } = req.params;
  getSessionUser(req, (err, user) => {
    const guestName = req.headers['x-guest-name'] || null;
    const email = user ? user.email : guestName;

    if (!email) return res.status(200).json({ success: true, status: null });

    db.get('SELECT id, status FROM join_requests WHERE game_id = ? AND email = ?', [gameId, email], (findErr, row) => {
      if (findErr) return res.status(500).json({ error: 'Database error.' });
      if (!row) return res.status(200).json({ success: true, status: null });
      res.status(200).json({ success: true, status: row.status, joinId: row.id });
    });
  });
});

// Assign player to slot
app.post('/api/games/:gameId/assign-slot', validateCSRF, (req, res) => {
  const { gameId } = req.params;
  const { playerId, email, joinRequestId, isAi, aiDifficulty, isLocal, name } = req.body;

  if (!playerId) return res.status(400).json({ error: 'playerId required.' });

  db.get('SELECT game_state FROM games WHERE id = ?', [gameId], (err, game) => {
    if (err || !game) return res.status(404).json({ error: 'Game not found.' });

    let state;
    try { state = JSON.parse(game.game_state); } catch (e) {
      return res.status(500).json({ error: 'State corrupt.' });
    }

    const player = state.players.find(p => p.id === playerId);
    if (!player) return res.status(404).json({ error: 'Player slot not found.' });

    if (isAi) {
      player.isAi = true;
      player.aiDifficulty = aiDifficulty || 'medium';
      player.assignedEmail = email ? email.trim().toLowerCase() : `ai_${aiDifficulty || 'medium'}_${playerId}@tickerclash.ai`;
      player.name = name || `AI (${(aiDifficulty || 'medium').toUpperCase()})`;
      player.isLocal = false;
    } else {
      player.isAi = false;
      player.aiDifficulty = undefined;
      const useLocal = isLocal !== undefined ? !!isLocal : !email;
      if (useLocal) {
        player.assignedEmail = null;
        player.isLocal = true;
        player.name = name || `Trader ${playerId.split('_')[1] || playerId}`;
      } else {
        player.assignedEmail = email ? email.trim().toLowerCase() : null;
        player.isLocal = false;
        player.name = name || (email ? email.trim().split('@')[0] : `Trader ${playerId.split('_')[1] || playerId}`);
      }
    }

    const stateStr = JSON.stringify(state);
    db.run('UPDATE games SET game_state = ?, updated_at = ? WHERE id = ?', [stateStr, new Date().toISOString(), gameId], (updErr) => {
      if (updErr) return res.status(500).json({ error: 'Update failed.' });

      const targetEmail = player.assignedEmail;
      if (targetEmail && joinRequestId) {
        db.run('UPDATE join_requests SET status = "accepted" WHERE id = ?', [joinRequestId]);
      } else if (targetEmail) {
        db.run('UPDATE join_requests SET status = "accepted" WHERE game_id = ? AND email = ?', [gameId, targetEmail]);
      }
      res.status(200).json({ success: true, message: 'Slot assigned successfully.' });
    });
  });
});

// Reject request
app.post('/api/games/:gameId/reject-join', validateCSRF, (req, res) => {
  const { gameId } = req.params;
  const { joinRequestId } = req.body;
  if (!joinRequestId) return res.status(400).json({ error: 'joinRequestId required.' });

  db.run('UPDATE join_requests SET status = "rejected" WHERE id = ? AND game_id = ?', [joinRequestId, gameId], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to reject.' });
    res.status(200).json({ success: true, message: 'Join request rejected.' });
  });
});

// --- DISPATCH ACTIONS ROUTE ---

app.post('/api/games/:id/action', validateCSRF, (req, res) => {
  const gameId = req.params.id;
  const { action, playerId } = req.body; // action: { type, companyId, quantity }

  if (!action || !playerId) return res.status(400).json({ error: 'Action and playerId required.' });

  getSessionUser(req, (err, user) => {
    const guestName = req.headers['x-guest-name'] || null;
    const email = user ? user.email : guestName;
    const normalizedEmail = email ? email.trim().toLowerCase() : null;

    db.get('SELECT owner_email, game_state FROM games WHERE id = ?', [gameId], (dbErr, game) => {
      if (dbErr || !game) return res.status(404).json({ error: 'Game not found.' });

      let state;
      try { state = JSON.parse(game.game_state); } catch (e) {
        return res.status(500).json({ error: 'Corrupt game state.' });
      }

      const player = state.players.find(p => p.id === playerId);
      if (!player) return res.status(404).json({ error: 'Player slot not found.' });

      const isOwner = !game.owner_email || (normalizedEmail && game.owner_email.trim().toLowerCase() === normalizedEmail);
      const isAssigned = normalizedEmail && player.assignedEmail && player.assignedEmail.trim().toLowerCase() === normalizedEmail;
      const isAuthorized = isAssigned || (player.isLocal && isOwner);

      if (action.type === 'start' || action.type === 'tick') {
        if (!isOwner) {
          return res.status(403).json({ error: 'Only the game host can control the simulation state.' });
        }
      } else {
        if (!isAuthorized) {
          return res.status(403).json({ error: 'Unauthorized command code for this faction.' });
        }
      }

      try {
        let newState;
        if (action.type === 'start') {
          // Host starts the game
          state.status = 'active';
          newState = state;
        } else if (action.type === 'tick') {
          // Host ticks the market
          newState = tickMarket(state);
        } else if (action.type === 'buy' || action.type === 'sell') {
          // Player trades
          newState = executeAction(state, action, playerId);
        } else if (action.type === 'end_turn') {
          // Player ends their turn
          newState = endTurn(state, playerId);
        } else if (action.type === 'cancel_end_turn') {
          // Player cancels turn end
          newState = cancelEndTurn(state, playerId);
        } else {
          return res.status(400).json({ error: 'Invalid action type.' });
        }

        const stateStr = JSON.stringify(newState);
        db.run(
          'UPDATE games SET game_state = ?, updated_at = ? WHERE id = ?',
          [stateStr, new Date().toISOString(), gameId],
          (updErr) => {
            if (updErr) return res.status(500).json({ error: 'Failed to write updated state.' });
            res.status(200).json({ success: true, gameState: newState });
          }
        );
      } catch (actionErr) {
        res.status(400).json({ error: actionErr.message });
      }
    });
  });
});

// Mock sync endpoint matching starswarm
app.post('/api/games/sync', validateCSRF, (req, res) => {
  res.status(200).json({ success: true, localUpdates: [] });
});

// Serve frontend build output in production
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*splat', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'), (err) => {
    if (err) {
      res.status(200).send('TickerClash backend running. Build frontend to serve static content.');
    }
  });
});

// Start listening
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`TickerClash server running on http://${HOST}:${PORT}`);
});
