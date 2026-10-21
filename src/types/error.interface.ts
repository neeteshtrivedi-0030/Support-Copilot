export interface IValidationErrorDetail {
  field: string;
  message: string;
}

export interface ICustomError {
  statusCode: number;
  message: string;
  isOperational: boolean;
  details?: unknown;
}
