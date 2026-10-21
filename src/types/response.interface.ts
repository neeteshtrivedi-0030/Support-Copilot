import { HttpResponseCode } from '../enum';

export type HttpResponseCodeKey = keyof typeof HttpResponseCode;

export interface IApiResponsePayload<T = unknown> {
  success: boolean;
  data: T | null;
  message: string;
}

declare global {
  namespace Express {
    interface Response {
      success(data?: unknown, message?: string): this;
      warn(data?: unknown, message?: string): this;
      badRequest(data?: unknown, message?: string): this;
      unauthorized(data?: unknown, message?: string): this;
      forbidden(data?: unknown, message?: string): this;
      notFound(data?: unknown, message?: string): this;
      serverError(data?: unknown, message?: string, err?: unknown): this;
    }
  }
}

export type IApiResponse<T = unknown> = IApiResponsePayload<T>;
