export type LocaleDictionary = Record<string, string>;

declare global {
  namespace Express {
    interface Request {
      platform: string;
      appVersion: string;
      language: string;
      __(key: string, ...params: (string | number | boolean)[]): string;
    }
  }
}

export {};
