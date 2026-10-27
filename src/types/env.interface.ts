import { NodeEnvironment, ServerMode, VectorDbType } from '../enum';

export interface IEnvConfig {
  NODE_ENV: NodeEnvironment;
  SERVER_MODE: ServerMode;
  PORT: number;
  API_PREFIX: string;
  CORS_ORIGIN: string;
  SITE_URL?: string;

  SSL_KEY_PATH?: string;
  SSL_CERT_PATH?: string;
  SSL_CA_PATH?: string;

  MONGODB_URI: string;

  REDIS_ENABLED: boolean;
  REDIS_URL?: string;

  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_EXPIRES_IN: string;

  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
  VECTOR_DB_TYPE: VectorDbType;

  QDRANT_URL?: string;
  QDRANT_COLLECTION?: string;
  OLLAMA_BASE_URL?: string;
  OLLAMA_EMBED_MODEL?: string;

  S3_ENDPOINT: string;
  S3_REGION: string;
  S3_BUCKET: string;
  S3_ACCESS_KEY: string;
  S3_SECRET_KEY: string;
  S3_FORCE_PATH_STYLE: boolean;
  S3_PUBLIC_URL: string;
}
