import type { GameState } from '../gameState';
import type { GameMetadata, GameDetails, GameListParams, JoinRequest } from '../gameApi';
import { apiFetch } from './apiFetch';

export class OnlineGameService {
  private getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
  }

  private getHeaders(): Record<string, string> {
    const cookieToken = this.getCookie('csrf_token') || '';
    const csrfToken = cookieToken || localStorage.getItem('stock_ticker_csrf_token') || '';
    const guestName = localStorage.getItem('stock_ticker_guest_name') || '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken
    };
    if (guestName) {
      headers['X-Guest-Name'] = guestName;
      headers['X-Guest-Email'] = guestName;
    }
    return headers;
  }

  public async updateSettings(displayName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await apiFetch('/api/settings', {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ displayName })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        return { success: true };
      }
      return { success: false, error: data.error || 'Failed to update settings.' };
    } catch (e) {
      return { success: false, error: 'Server connection failed.' };
    }
  }

  public async updatePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await apiFetch('/api/settings/password', {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ newPassword })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        return { success: true };
      }
      return { success: false, error: data.error || 'Failed to update password.' };
    } catch (e) {
      return { success: false, error: 'Server connection failed.' };
    }
  }

  public async listGames(params?: GameListParams): Promise<{ success: boolean; games?: GameMetadata[]; totalCount?: number; error?: string }> {
    try {
      let url = '/api/games';
      if (params) {
        const searchParams = new URLSearchParams();
        if (params.search) searchParams.append('search', params.search);
        if (params.status) searchParams.append('status', params.status);
        if (params.startDate) searchParams.append('startDate', params.startDate);
        if (params.endDate) searchParams.append('endDate', params.endDate);
        if (params.turns) searchParams.append('turns', params.turns);
        if (params.ids) searchParams.append('ids', params.ids);
        searchParams.append('limit', String(params.limit));
        searchParams.append('offset', String(params.offset));
        url += `?${searchParams.toString()}`;
      }

      const response = await apiFetch(url, {
        headers: this.getHeaders()
      });
      const data = await response.json();
      if (response.ok && data.success) {
        return { success: true, games: data.games, totalCount: data.totalCount };
      }
      return { success: false, error: data.error || 'Failed to list saved games.' };
    } catch (e) {
      return { success: false, error: 'Server connection failed.' };
    }
  }

  public async createGame(
    name: string,
    gameState?: GameState | null,
    setupOptions?: any
  ): Promise<{ success: boolean; gameId?: string; inviteCode?: string; name?: string; error?: string }> {
    try {
      const body: any = { name };
      if (setupOptions) {
        body.setupOptions = setupOptions;
      } else if (gameState) {
        body.game_state = gameState;
      } else {
        return { success: false, error: 'Missing game state or setup options.' };
      }
      const response = await apiFetch('/api/games', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (response.ok && data.success) {
        return { success: true, gameId: data.gameId, inviteCode: data.inviteCode, name: data.name };
      }
      return { success: false, error: data.error || 'Failed to create game session.' };
    } catch (e) {
      return { success: false, error: 'Server connection failed.' };
    }
  }

  public async getGame(id: string): Promise<{ success: boolean; game?: GameDetails; connectedPlayers?: string[]; error?: string }> {
    try {
      const response = await apiFetch(`/api/games/${id}`, {
        headers: this.getHeaders()
      });
      const data = await response.json();
      if (response.ok && data.success) {
        return { success: true, game: data.game, connectedPlayers: data.connectedPlayers };
      }
      return { success: false, error: data.error || 'Failed to load game session.' };
    } catch (e) {
      return { success: false, error: 'Server connection failed.' };
    }
  }

  public async sendHeartbeat(id: string): Promise<{ success: boolean; connectedPlayers?: string[]; error?: string }> {
    try {
      const response = await apiFetch(`/api/games/${id}/presence`, {
        method: 'POST',
        headers: this.getHeaders()
      });
      const data = await response.json();
      if (response.ok && data.success) {
        return { success: true, connectedPlayers: data.connectedPlayers };
      }
      return { success: false, error: data.error || 'Heartbeat update failed.' };
    } catch (e) {
      return { success: false, error: 'Server connection failed.' };
    }
  }

  public async updateGame(id: string, gameState: GameState): Promise<{ success: boolean; connectedPlayers?: string[]; error?: string }> {
    try {
      const response = await apiFetch(`/api/games/${id}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ game_state: gameState })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        return { success: true, connectedPlayers: data.connectedPlayers };
      }
      return { success: false, error: data.error || 'Failed to save game state.' };
    } catch (e) {
      return { success: false, error: 'Server connection failed.' };
    }
  }

  public async updateGameName(id: string, name: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await apiFetch(`/api/games/${id}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ name })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        return { success: true };
      }
      return { success: false, error: data.error || 'Failed to update game name.' };
    } catch (e) {
      return { success: false, error: 'Server connection failed.' };
    }
  }

  public async deleteGame(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await apiFetch(`/api/games/${id}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });
      const data = await response.json();
      if (response.ok && data.success) {
        return { success: true };
      }
      return { success: false, error: data.error || 'Failed to decommission game.' };
    } catch (e) {
      return { success: false, error: 'Server connection failed.' };
    }
  }

  public async assignPlayerSlot(
    gameId: string,
    playerId: string,
    email: string | null,
    joinRequestId?: number,
    isAi?: boolean,
    aiDifficulty?: 'easy' | 'medium' | 'hard',
    isLocal?: boolean,
    name?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await apiFetch(`/api/games/${gameId}/assign-slot`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ playerId, email, joinRequestId, isAi, aiDifficulty, isLocal, name })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        return { success: true };
      }
      return { success: false, error: data.error || 'Failed to assign player slot.' };
    } catch (e) {
      return { success: false, error: 'Server connection failed.' };
    }
  }

  public async requestToJoin(gameId: string, email?: string): Promise<{ success: boolean; joinId?: number; token?: string; error?: string }> {
    try {
      const response = await apiFetch(`/api/games/${gameId}/join`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: email ? JSON.stringify({ email }) : undefined
      });
      const data = await response.json();
      if (response.ok && data.success) {
        return { success: true, joinId: data.joinId, token: data.token };
      }
      return { success: false, error: data.error || 'Failed to submit join request.' };
    } catch (e) {
      return { success: false, error: 'Server connection failed.' };
    }
  }

  public async fetchPendingJoins(gameId: string): Promise<{ success: boolean; requests?: JoinRequest[]; error?: string }> {
    try {
      const response = await apiFetch(`/api/games/${gameId}/join-requests`, {
        headers: this.getHeaders()
      });
      const data = await response.json();
      if (response.ok && data.success) {
        return { success: true, requests: data.requests };
      }
      return { success: false, error: data.error || 'Failed to fetch join requests.' };
    } catch (e) {
      return { success: false, error: 'Server connection failed.' };
    }
  }

  public async checkMyJoinStatus(gameId: string, email?: string): Promise<{ success: boolean; status?: 'pending' | 'accepted' | 'rejected' | null; joinId?: number; error?: string }> {
    try {
      let url = `/api/games/${gameId}/my-join-status`;
      if (email) {
        url += `?email=${encodeURIComponent(email)}`;
      }
      const response = await apiFetch(url, {
        headers: this.getHeaders()
      });
      const data = await response.json();
      if (response.ok && data.success) {
        return { success: true, status: data.status, joinId: data.joinId };
      }
      return { success: false, error: data.error || 'Failed to check join status.' };
    } catch (e) {
      return { success: false, error: 'Server connection failed.' };
    }
  }

  public async rejectJoinRequest(gameId: string, joinRequestId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await apiFetch(`/api/games/${gameId}/reject-join`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ joinRequestId })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        return { success: true };
      }
      return { success: false, error: data.error || 'Failed to reject join request.' };
    } catch (e) {
      return { success: false, error: 'Server connection failed.' };
    }
  }

  public async performGameAction(
    gameId: string,
    action: { type: 'buy' | 'sell' | 'start' | 'tick' | 'end_turn' | 'cancel_end_turn'; companyId?: string; quantity?: number },
    playerId: string
  ): Promise<{ success: boolean; gameState?: GameState; error?: string }> {
    try {
      const response = await apiFetch(`/api/games/${gameId}/action`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ action, playerId })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        return { success: true, gameState: data.gameState };
      }
      return { success: false, error: data.error || 'Action failed.' };
    } catch (e) {
      return { success: false, error: 'Server connection failed.' };
    }
  }

  public async syncGames(localGames: any[]): Promise<{ success: boolean; localUpdates?: any[]; error?: string }> {
    try {
      const response = await apiFetch('/api/games/sync', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ localGames })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        return { success: true, localUpdates: data.localUpdates };
      }
      return { success: false, error: data.error || 'Sync failed.' };
    } catch (e) {
      return { success: false, error: 'Server connection failed.' };
    }
  }
}
export const gameService = new OnlineGameService();
