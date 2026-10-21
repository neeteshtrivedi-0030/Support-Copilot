export interface IDatabaseConnectionOptions {
  uri?: string;
}

export interface IDatabaseHealthStatus {
  connected: boolean;
  type: string;
  host?: string;
}
