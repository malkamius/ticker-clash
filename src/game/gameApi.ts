import type { GameState } from './gameState';
import { gameService } from './services';

export interface GameMetadata {
  id: string;
  invite_code?: string;
  name: string;
  game_state?: any;
  created_at: string;
  updated_at: string;
  owner_email?: string;
}

export interface GameDetails {
  id: string;
  inviteCode?: string;
  ownerEmail: string;
  name: string;
  gameState: GameState;
  createdAt: string;
  updatedAt: string;
}

export interface GameListParams {
  search?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  turns?: string;
  limit: number;
  offset: number;
  ids?: string;
}

export interface JoinRequest {
  id: number;
  email: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export async function updateSettings(displayName: string): Promise<{ success: boolean; error?: string }> {
  return gameService.updateSettings(displayName);
}

export async function updatePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
  return gameService.updatePassword(newPassword);
}

export async function listGames(params?: GameListParams): Promise<{ success: boolean; games?: GameMetadata[]; totalCount?: number; error?: string }> {
  return gameService.listGames(params);
}

export async function createGame(
  name: string,
  gameState?: GameState | null,
  setupOptions?: any
): Promise<{ success: boolean; gameId?: string; inviteCode?: string; name?: string; error?: string }> {
  return gameService.createGame(name, gameState, setupOptions);
}

export async function getGame(id: string): Promise<{ success: boolean; game?: GameDetails; connectedPlayers?: string[]; error?: string }> {
  return gameService.getGame(id);
}

export async function sendHeartbeat(id: string): Promise<{ success: boolean; connectedPlayers?: string[]; error?: string }> {
  return gameService.sendHeartbeat(id);
}

export async function updateGame(id: string, gameState: GameState): Promise<{ success: boolean; connectedPlayers?: string[]; error?: string }> {
  return gameService.updateGame(id, gameState);
}

export async function updateGameName(id: string, name: string): Promise<{ success: boolean; error?: string }> {
  return gameService.updateGameName(id, name);
}

export async function deleteGame(id: string): Promise<{ success: boolean; error?: string }> {
  return gameService.deleteGame(id);
}

export async function assignPlayerSlot(
  gameId: string,
  playerId: string,
  email: string | null,
  joinRequestId?: number,
  isAi?: boolean,
  aiDifficulty?: 'easy' | 'medium' | 'hard',
  isLocal?: boolean,
  name?: string
): Promise<{ success: boolean; error?: string }> {
  return gameService.assignPlayerSlot(gameId, playerId, email, joinRequestId, isAi, aiDifficulty, isLocal, name);
}

export async function requestToJoin(gameId: string, email?: string): Promise<{ success: boolean; joinId?: number; token?: string; error?: string }> {
  return gameService.requestToJoin(gameId, email);
}

export async function fetchPendingJoins(gameId: string): Promise<{ success: boolean; requests?: JoinRequest[]; error?: string }> {
  return gameService.fetchPendingJoins(gameId);
}

export async function checkMyJoinStatus(gameId: string, email?: string): Promise<{ success: boolean; status?: 'pending' | 'accepted' | 'rejected' | null; joinId?: number; error?: string }> {
  return gameService.checkMyJoinStatus(gameId, email);
}

export async function acceptJoinRequest(
  gameId: string,
  joinRequestId: number,
  playerId: string,
  email: string
): Promise<{ success: boolean; error?: string }> {
  return gameService.assignPlayerSlot(gameId, playerId, email, joinRequestId, false, undefined, false);
}

export async function rejectJoinRequest(gameId: string, joinRequestId: number): Promise<{ success: boolean; error?: string }> {
  return gameService.rejectJoinRequest(gameId, joinRequestId);
}

export async function performGameAction(
  gameId: string,
  action: { type: 'buy' | 'sell' | 'start' | 'tick' | 'end_turn' | 'cancel_end_turn'; companyId?: string; quantity?: number },
  playerId: string
): Promise<{ success: boolean; gameState?: GameState; error?: string }> {
  return gameService.performGameAction(gameId, action, playerId);
}

export async function syncGames(localGames: any[]): Promise<{ success: boolean; localUpdates?: any[]; error?: string }> {
  return gameService.syncGames(localGames);
}
