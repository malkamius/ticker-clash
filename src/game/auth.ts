export interface UserStats {
  gamesPlayed: number;
  gamesWon: number;
}

export interface UserAccount {
  email: string;
  displayName: string | null;
  isGoogleLinked: boolean;
  hasPassword?: boolean;
  stats: UserStats;
}
