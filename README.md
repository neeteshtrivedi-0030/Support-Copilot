# Support Copilot - Backend API

Enterprise AI Knowledge & Support Copilot backend service powered by Node.js, Express, TypeScript, LangChain.js, MongoDB, and Redis.

## 🚀 Getting Started

### 1. Prerequisites

- Node.js (v20+ recommended)
- MongoDB running locally or via connection URI
- Redis (optional for local standalone mode, enabled in production)

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Variables

Copy `.env.example` to `.env` and set your credentials:

```bash
cp .env.example .env
```

### 4. Running the Project

```bash
# Start development server with live reload
npm run dev

# Run TypeScript type checking
npm run typecheck

# Lint all files and fail on any warning
npm run lint

# Automatically fix linting and formatting issues
npm run lint:fix

# Check formatting across all files
npm run format:check

# Format all files with Prettier
npm run format

# Build production bundle using tsup
npm run build

# Start production server
npm start
```

---

## 🛡️ Code Quality & Git Hooks (Husky)

This project has strict automated checks configured via **Husky** and **lint-staged**:

### Pre-commit Hook (`.husky/pre-commit`)

Triggers automatically whenever you run `git commit`:

1. `npm run typecheck` - Verifies full TypeScript type safety.
2. `npm run lint` - Runs ESLint with `--max-warnings=0`. Any warning or error will halt the commit.
3. `npm run build` - Validates that the project compiles to `dist/server.js` without issues. If the build fails, the commit is aborted.
4. `npx lint-staged` - Runs ESLint auto-fix and Prettier formatting on staged files.

### Pre-push Hook (`.husky/pre-push`)

Triggers automatically whenever you run `git push`:

1. Full validation suite (`check:commit`): Typecheck + zero-warning Lint + Build.
2. `npm test` - Runs unit & integration test suites.
   If any check or test fails, the push is aborted.

---

## 📦 Architecture & Directory Structure

```
backend/
├── .husky/              # Git hooks (pre-commit & pre-push)
├── src/
│   ├── config/          # Environment, MongoDB & Redis configuration
│   ├── controllers/     # Class-based HTTP controllers
│   ├── routes/          # Express API modular routes
│   ├── models/          # Mongoose database models & validations
│   ├── middleware/      # Auth, security, request logger, error handling
│   ├── types/           # Consolidated TypeScript interfaces
│   ├── utils/           # Response & error helpers
│   └── app.ts           # Class-based Express app initialization
├── tests/               # Test suites (Jest & Supertest)
├── server.ts            # Class-based server lifecycle & HTTP/HTTPS startup
├── .eslintrc.json       # ESLint rules & Prettier integration
├── .prettierrc          # Prettier code formatting rules
└── package.json
```

---

## 🔗 Git Remote

- **Repository**: `git@github.com:neeteshtrivedi-0030/Support-Copilot.git`
- **Branch**: `main`
- **Author**: Neetesh Trivedi (`neetesh.trivedi@programming.com`)
