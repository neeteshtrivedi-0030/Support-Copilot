# 🛡️ Support Copilot — Backend API Service

Production-grade, enterprise AI Knowledge & Support Copilot backend built with **Node.js**, **Express.js**, **TypeScript**, **LangChain.js**, **MongoDB**, **Redis**, and **Qdrant Vector Database**.

---

## 📋 Table of Contents

1. [Overview & Architecture](#-overview--architecture)
2. [Prerequisites](#-prerequisites)
3. [Infrastructure Setup (Docker Compose)](#-infrastructure-setup-docker-compose)
4. [Environment Configuration (.env)](#-environment-configuration-env)
5. [Installation & Local Startup](#-installation--local-startup)
6. [Interactive API Documentation (Swagger)](#-interactive-api-documentation-swagger)
7. [Core REST API Endpoints](#-core-rest-api-endpoints)
8. [Automated Testing & Code Quality](#-automated-testing--code-quality)
9. [Production Build & Deployment](#-production-build--deployment)
10. [Resilience & Fallback Architecture](#-resilience--fallback-architecture)
11. [Troubleshooting Guide](#-troubleshooting-guide)

---

## 🏛️ Overview & Architecture

The backend provides multi-tenant organizational document retrieval (RAG), conversational AI query answering with source citations, document-level security (RBAC), and analytics.

```
                           ┌────────────────────────┐
                           │   Next.js / Frontend   │
                           └───────────┬────────────┘
                                       │ HTTP / SSE
                                       ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      Node.js + Express.js Backend                      │
 │                                                                        │
 │  ┌────────────────┐   ┌─────────────────┐   ┌───────────────────────┐  │
 │  │ Auth & RBAC    │   │ Document RAG    │   │ Multi-Turn Chat & SSE │  │
 │  │ (JWT + bcrypt) │   │ Ingestion Engine│   │ (LangChain + Groq)    │  │
 │  └────────────────┘   └────────┬────────┘   └──────────┬────────────┘  │
 └────────────────────────────────┼───────────────────────┼───────────────┘
                                  │                       │
         ┌────────────────────────┼───────────────────────┼────────────────────────┐
         ▼                        ▼                       ▼                        ▼
 ┌───────────────┐        ┌───────────────┐       ┌───────────────┐        ┌───────────────┐
 │    MongoDB    │        │ Qdrant Vector │       │     Redis     │        │ MinIO (S3)    │
 │ (Users/Chats/ │        │  Database     │       │ (Query Cache  │        │ (Encrypted    │
 │  Docs/Logs)   │        │ (Embeddings)  │       │ & Rate Limit) │        │  Documents)   │
 └───────────────┘        └───────────────┘       └───────────────┘        └───────────────┘
```

---

## ⚙️ Prerequisites

Before starting the backend, make sure you have the following installed on your machine:

- **Node.js**: `v20.x` or higher (LTS recommended)
- **npm**: `v10.x` or higher
- **Docker Desktop** / **Docker Engine** & **Docker Compose**: For running the required database, vector store, cache, and object storage services.
- **Git**

---

## 🐳 Infrastructure Setup (Docker Compose)

The application depends on containerized infrastructure services configured in the root [`docker-compose.yml`](../docker-compose.yml):

| Service     | Container Name            |    Host Port    | Purpose                                                           |
| :---------- | :------------------------ | :-------------: | :---------------------------------------------------------------- |
| **MongoDB** | `support_copilot_mongodb` |     `27017`     | Primary database (Users, Documents, Chunks, Messages, Logs)       |
| **Redis**   | `support_copilot_redis`   |     `6379`      | Response caching (1-hour TTL) & user rate limiting (30 req/min)   |
| **Qdrant**  | `support_copilot_qdrant`  |     `6333`      | Vector database for semantic chunk retrieval & cosine similarity  |
| **MinIO**   | `support_copilot_minio`   | `9000` / `9001` | S3-compatible object storage (Console at `http://localhost:9001`) |
| **Ollama**  | `support_copilot_ollama`  |     `11434`     | Local embeddings engine (`nomic-embed-text`)                      |

### Step 1: Start All Infrastructure Containers

Open a terminal in the project root directory (where `docker-compose.yml` is located):

```bash
# Navigate to the project root
cd /path/to/support_copilot

# Launch all infrastructure containers in detached mode
docker compose up -d
```

### Step 2: Verify Running Containers

Verify that all 5 services are healthy and running:

```bash
docker compose ps
```

_Expected output:_

```
NAME                         IMAGE                               STATUS
support_copilot_mongodb      mongo:7.0                           Up
support_copilot_redis        redis:7-alpine                      Up
support_copilot_qdrant       qdrant/qdrant:latest                Up
support_copilot_minio        cgr.dev/chainguard/minio:latest     Up
support_copilot_ollama       ollama/ollama:latest                Up
```

> [!NOTE]
> The helper container `support_copilot_ollama_init` will run once at startup, pull the `nomic-embed-text` embedding model into Ollama, and exit with code 0.

---

## 🔐 Environment Configuration (.env)

The backend uses strict schema validation with `Joi` on startup. If any required variable is missing or malformed, the server will display an explicit validation message and halt.

### Step 1: Copy Environment Template

In the `backend/` folder, copy `.env.example` to create your local `.env` file:

```bash
cd backend
cp .env.example .env
```

### Step 2: Configure Environment Variables

Open `backend/.env` in your editor. Below is a complete breakdown of each variable:

```env
# ==============================================================================
# SERVER & APPLICATION CONFIGURATION
# ==============================================================================
NODE_ENV=development
SERVER_MODE=http
PORT=5000
API_PREFIX=/api/v1
CORS_ORIGIN=*
SITE_URL=http://localhost:5000

# ==============================================================================
# DATABASE (MongoDB 7.0 via Docker)
# ==============================================================================
MONGODB_URI=mongodb://localhost:27017/support_copilot

# ==============================================================================
# REDIS CACHING & RATE LIMITING (Docker)
# ==============================================================================
REDIS_ENABLED=true
REDIS_URL=redis://127.0.0.1:6379

# ==============================================================================
# JWT AUTHENTICATION SECRETS (Must be at least 16 characters)
# ==============================================================================
JWT_SECRET=replace_with_a_secure_random_jwt_secret_16_chars_min
JWT_EXPIRES_IN=1d
JWT_REFRESH_SECRET=replace_with_a_secure_random_refresh_secret_16_chars_min
JWT_REFRESH_EXPIRES_IN=7d

# ==============================================================================
# LARGE LANGUAGE MODEL (Groq / OpenAI)
# Get a free key at: https://console.groq.com/keys
# ==============================================================================
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-120b

# Optional fallbacks
OPENAI_API_KEY=
GEMINI_API_KEY=

# ==============================================================================
# VECTOR DATABASE (Qdrant via Docker)
# ==============================================================================
VECTOR_DB_TYPE=qdrant
QDRANT_URL=http://127.0.0.1:6333
QDRANT_COLLECTION=support_copilot_chunks

# ==============================================================================
# OLLAMA LOCAL EMBEDDINGS (Docker)
# ==============================================================================
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_EMBED_MODEL=nomic-embed-text

# ==============================================================================
# S3 / MinIO OBJECT STORAGE (Docker)
# MinIO Web Console: http://127.0.0.1:9001 (Credentials below)
# ==============================================================================
S3_ENDPOINT=http://127.0.0.1:9000
S3_REGION=us-east-1
S3_BUCKET=support-copilot-documents
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123
S3_FORCE_PATH_STYLE=true
S3_PUBLIC_URL=http://127.0.0.1:9000
```

> [!SECURITY TIP]
> Never commit your real `.env` file containing secret keys to Git. The `.gitignore` file is configured to exclude all `.env` files.

---

## 🚀 Installation & Local Startup

### 1. Install Node Dependencies

From the `backend/` directory:

```bash
npm install
```

### 2. Start the Development Server

Launch the server in watch mode with automatic hot reload:

```bash
npm run dev
```

_Expected Terminal Output:_

```
============================================================
Starting Enterprise AI Knowledge & Support Copilot Server...
============================================================
[Database] Connected to MongoDB host: localhost
[Redis] Connected to Redis server successfully.
[Server] Running in HTTP mode.
[Server] Server listening on port: 5000 [HTTP]
[Server] Environment: development
[Server] API Base URL: http://localhost:5000/api/v1
[Server] Health Check: http://localhost:5000/api/v1/health
============================================================
```

### 3. Verify Server Health

You can verify the backend is up and running by visiting the health endpoint in your browser or curl:

```bash
curl http://localhost:5000/api/v1/health
```

_Response:_

```json
{
  "success": true,
  "message": "Health check successful",
  "data": {
    "status": "UP",
    "timestamp": "2026-10-27T13:30:00.000Z",
    "uptime": 12.4,
    "services": {
      "database": "CONNECTED",
      "redis": "CONNECTED"
    }
  }
}
```

---

## 📖 Interactive API Documentation (Swagger)

The backend serves a complete **OpenAPI 3.0 specification** with interactive Swagger UI.

- **Swagger UI URL:** [http://localhost:5000/api/docs](http://localhost:5000/api/docs) (or [http://localhost:5000/docs](http://localhost:5000/docs))
- **Authorizing in Swagger:**
  1. Call `POST /api/v1/auth/login` (or `/api/v1/auth/register`).
  2. Copy the `accessToken` from the response.
  3. Click the green **Authorize 🔓** button at the top right in Swagger UI.
  4. Enter `Bearer <your_token>` and click Authorize.

---

## 📡 Core REST API Endpoints

All application routes are prefixed with `/api/v1`:

### 1. Authentication (`/api/v1/auth`)

- `POST /api/v1/auth/register` — Register a new user (`name`, `email`, `password`, `department`, `role`).
- `POST /api/v1/auth/login` — Login with email/password; returns user profile, JWT access token, and refresh token.
- `POST /api/v1/auth/refresh` — Issue a new access token using a valid `refreshToken`.

### 2. Knowledge Document Management (`/api/v1/documents`)

- `POST /api/v1/documents/upload` — Multipart form upload (`file`, `department`, `name`). Automatically extracts text, generates chunks, and indexes into Qdrant.
- `GET /api/v1/documents` — Paginated document listing filtered by department & role access.
- `GET /api/v1/documents/:id` — Get document metadata and presigned download URL.
- `DELETE /api/v1/documents/:id` — Delete document from MongoDB, S3/MinIO, and Qdrant vector index.
- `POST /api/v1/documents/:id/retry` — Retry ingestion for failed document processing.

### 3. AI Chat & RAG Retrieval (`/api/v1/chat`, `/api/v1/search`)

- `POST /api/v1/chat` — Conversational question answering:
  - Supports standard JSON response (`stream: false`).
  - Supports **real-time token streaming via Server-Sent Events (SSE)** (`stream: true`).
- `POST /api/v1/search` — Semantic vector search across document chunks with similarity scores.
- `POST /api/v1/chat/feedback` — Submit user feedback (`helpful` / `not_helpful`) on AI responses.

### 4. Conversations (`/api/v1/conversations`)

- `GET /api/v1/conversations` — List user's conversation threads with pagination and search.
- `GET /api/v1/conversations/:id` — Fetch conversation thread and full message history.
- `PATCH /api/v1/conversations/:id` — Rename conversation title.
- `DELETE /api/v1/conversations/:id` — Delete conversation thread and associated messages.

### 5. Admin Governance & Analytics (`/api/v1/admin`)

- `GET /api/v1/admin/users` — Administrative user list with role and department filters.
- `GET /api/v1/admin/analytics` — Comprehensive usage statistics, queries today, most asked questions, most used documents, and RAG evaluation metrics (retrieval success rate, positive feedback rate, average similarity score).
- `DELETE /api/v1/admin/documents/:id` — Admin-level deletion across all departments.

---

## 🧪 Automated Testing & Code Quality

The backend has a comprehensive test suite built with **Jest** and **Supertest**, alongside strict **ESLint** and **Prettier** configs.

```bash
# Run unit & integration tests
npm test

# Run TypeScript typecheck without emitting files
npm run typecheck

# Run ESLint (strictly fails on any warning)
npm run lint

# Check code formatting with Prettier
npm run format:check

# Automatically fix linting and formatting issues
npm run lint:fix
npm run format
```

### Git Hooks (Husky)

- **Pre-commit hook (`.husky/pre-commit`):** Runs `npm run typecheck`, `npm run lint`, `npm run build`, and `npx lint-staged`.
- **Pre-push hook (`.husky/pre-push`):** Runs the full test suite (`npm test`). If any test fails, the push is safely blocked.

---

## 📦 Production Build & Deployment

### 1. Compile Bundle

```bash
npm run build
```

This bundles the TypeScript codebase into a standalone, optimized `dist/server.js` file using `tsup`.

### 2. Run Production Server

```bash
npm start
```

---

## 🛡️ Resilience & Fallback Architecture

The backend is engineered to handle production partial outages gracefully without crashing:

| Component                  | Normal Operation                                       | Failure / Offline Behavior                                                                    |
| :------------------------- | :----------------------------------------------------- | :-------------------------------------------------------------------------------------------- |
| **Vector DB (Qdrant)**     | Cosine similarity vector search                        | Automatically falls back to **MongoDB lexical keyword scoring** to return relevant chunks.    |
| **Embeddings (Ollama)**    | `nomic-embed-text` vector generation                   | Falls back to **deterministic mathematical vector generation** for local/offline testing.     |
| **LLM API (Groq)**         | Generates conversational synthesis                     | Falls back to **direct grounded answer extraction** from top retrieved knowledge base chunks. |
| **Cache (Redis)**          | Sub-10ms response caching & token bucket rate limiting | Gracefully bypasses cache and uses **in-memory sliding window** for rate limiting.            |
| **Object Storage (MinIO)** | S3 presigned URLs & object storage                     | Stores and serves files from the local filesystem (`uploads/`) if MinIO is unreachable.       |

---

## 🔧 Troubleshooting Guide

### 1. `[Fatal Error] MongoDB connection failed`

- **Cause:** MongoDB container is not running or port 27017 is blocked.
- **Solution:** Run `docker compose up -d mongodb` in the root folder, then check `docker compose ps`.

### 2. `Invalid environment variables detected`

- **Cause:** Missing required keys in `.env` (such as `JWT_SECRET` having fewer than 16 characters or missing `MONGODB_URI`).
- **Solution:** Review the console output—it will list the exact missing or invalid fields. Ensure `JWT_SECRET` and `JWT_REFRESH_SECRET` are at least 16 characters long.

### 3. `Qdrant chunk indexing warning: connect ECONNREFUSED 127.0.0.1:6333`

- **Cause:** Qdrant container is starting up or stopped.
- **Solution:** Verify Qdrant status with `docker compose ps qdrant`. If stopped, run `docker compose up -d qdrant`. The backend will automatically fall back to lexical retrieval in the meantime.

### 4. `Rate limit exceeded: Maximum 30 AI requests per minute` (HTTP 429)

- **Cause:** You have sent more than 30 AI questions within a 60-second window.
- **Solution:** Wait 60 seconds for your quota to reset. This is a deliberate protection scenario specified in the system requirements.

---

## 👥 Authors & License

- **Author:** Neetesh Trivedi (`neetesh.trivedi@programming.com`)
- **Organization:** Programming.com
- **Repository:** `git@github.com:neeteshtrivedi-0030/Support-Copilot.git`
