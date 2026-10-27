import dotenv from 'dotenv';
import path from 'path';
import Joi from 'joi';
import { IEnvConfig } from '../types';
import { NodeEnvironment, ServerMode, VectorDbType } from '../enum';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid(...Object.values(NodeEnvironment))
    .default(NodeEnvironment.DEVELOPMENT),
  SERVER_MODE: Joi.string()
    .valid(...Object.values(ServerMode))
    .default(ServerMode.HTTP),
  PORT: Joi.number().default(5000),
  API_PREFIX: Joi.string().default('/api/v1'),
  CORS_ORIGIN: Joi.string().default('*'),
  SITE_URL: Joi.string().allow('').optional(),

  SSL_KEY_PATH: Joi.string().allow('').optional(),
  SSL_CERT_PATH: Joi.string().allow('').optional(),
  SSL_CA_PATH: Joi.string().allow('').optional(),

  MONGODB_URI: Joi.string().required().messages({
    'any.required': 'MONGODB_URI is required and must be defined in your environment (.env)',
    'string.empty': 'MONGODB_URI cannot be empty',
  }),

  REDIS_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
  REDIS_URL: Joi.string().allow('').optional(),

  JWT_SECRET: Joi.string().min(16).required().messages({
    'any.required': 'JWT_SECRET is required and must be defined in your environment (.env)',
    'string.min': 'JWT_SECRET must be at least 16 characters long for security',
    'string.empty': 'JWT_SECRET cannot be empty',
  }),
  JWT_EXPIRES_IN: Joi.string().default('1d'),
  JWT_REFRESH_SECRET: Joi.string().min(16).required().messages({
    'any.required': 'JWT_REFRESH_SECRET is required and must be defined in your environment (.env)',
    'string.min': 'JWT_REFRESH_SECRET must be at least 16 characters long for security',
    'string.empty': 'JWT_REFRESH_SECRET cannot be empty',
  }),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  OPENAI_API_KEY: Joi.string().allow('').optional(),
  GEMINI_API_KEY: Joi.string().allow('').optional(),
  GROQ_API_KEY: Joi.string().allow('').optional(),
  GROQ_MODEL: Joi.string().default('openai/gpt-oss-120b'),
  VECTOR_DB_TYPE: Joi.string()
    .valid(...Object.values(VectorDbType))
    .default(VectorDbType.MEMORY),
  QDRANT_URL: Joi.string().default('http://127.0.0.1:6333'),
  QDRANT_COLLECTION: Joi.string().default('support_copilot_chunks'),
  OLLAMA_BASE_URL: Joi.string().default('http://127.0.0.1:11434'),
  OLLAMA_EMBED_MODEL: Joi.string().default('nomic-embed-text'),

  S3_ENDPOINT: Joi.string().default('http://127.0.0.1:9000'),
  S3_REGION: Joi.string().default('us-east-1'),
  S3_BUCKET: Joi.string().default('support-copilot-documents'),
  S3_ACCESS_KEY: Joi.string().default('minioadmin'),
  S3_SECRET_KEY: Joi.string().default('minioadmin123'),
  S3_FORCE_PATH_STYLE: Joi.boolean().truthy('true').falsy('false').default(true),
  S3_PUBLIC_URL: Joi.string().default('http://127.0.0.1:9000'),
}).unknown(true);

const validateEnv = (): IEnvConfig => {
  const { value, error } = envSchema.validate(process.env, {
    abortEarly: false,
  });

  if (error) {
    console.error('Invalid environment variables detected:');
    error.details.forEach((err) => {
      console.error(`- ${err.message}`);
    });
    throw new Error('Environment variable validation failed');
  }

  return {
    NODE_ENV: value.NODE_ENV,
    SERVER_MODE: value.SERVER_MODE,
    PORT: Number(value.PORT),
    API_PREFIX: value.API_PREFIX,
    CORS_ORIGIN: value.CORS_ORIGIN,
    SITE_URL: value.SITE_URL,
    SSL_KEY_PATH: value.SSL_KEY_PATH,
    SSL_CERT_PATH: value.SSL_CERT_PATH,
    SSL_CA_PATH: value.SSL_CA_PATH,
    MONGODB_URI: value.MONGODB_URI,
    REDIS_ENABLED: Boolean(value.REDIS_ENABLED),
    REDIS_URL: value.REDIS_URL,
    JWT_SECRET: value.JWT_SECRET,
    JWT_EXPIRES_IN: value.JWT_EXPIRES_IN,
    JWT_REFRESH_SECRET: value.JWT_REFRESH_SECRET,
    JWT_REFRESH_EXPIRES_IN: value.JWT_REFRESH_EXPIRES_IN,
    OPENAI_API_KEY: value.OPENAI_API_KEY,
    GEMINI_API_KEY: value.GEMINI_API_KEY,
    GROQ_API_KEY: value.GROQ_API_KEY,
    GROQ_MODEL: value.GROQ_MODEL || 'openai/gpt-oss-120b',
    VECTOR_DB_TYPE: value.VECTOR_DB_TYPE,
    S3_ENDPOINT: value.S3_ENDPOINT,
    S3_REGION: value.S3_REGION,
    S3_BUCKET: value.S3_BUCKET,
    S3_ACCESS_KEY: value.S3_ACCESS_KEY,
    S3_SECRET_KEY: value.S3_SECRET_KEY,
    S3_FORCE_PATH_STYLE: Boolean(value.S3_FORCE_PATH_STYLE),
    S3_PUBLIC_URL: value.S3_PUBLIC_URL,
  };
};

export const env = validateEnv();
export type { IEnvConfig };
