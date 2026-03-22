# InfraCore

> Production-ready multi-tenant SaaS backend platform. The backend skeleton every real product is built on — authentication, organizations, API key management, webhook delivery, background job processing, and AI-powered usage insights.

[![Node.js](https://img.shields.io/badge/Node.js-v24+-green)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://typescriptlang.org)
[![Fastify](https://img.shields.io/badge/Fastify-5.x-black)](https://fastify.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue)](https://postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-red)](https://redis.io)

---

## What is InfraCore?

InfraCore is a backend infrastructure platform that solves the problem every SaaS product faces before writing a single line of their actual product — building the plumbing.

Every company building a SaaS product needs the same foundational backend layer: user authentication, multi-tenant organization workspaces, API key management for developer integrations, webhook event delivery for real-time notifications, and background job processing for reliability. Instead of rebuilding this from scratch every time, InfraCore provides it as a production-grade, ready-to-use platform.

**Think of it as the backend that Stripe, Notion, or Linear would build internally — before they built their actual product.**

---

## What Problem It Solves

When a startup builds a product like a project management tool, they need to solve several infrastructure challenges before writing a single feature:

- **"How do users sign up and stay logged in securely?"** — Auth with JWT tokens, refresh token rotation, and session invalidation
- **"How do teams collaborate under one account?"** — Multi-tenant organization system with role-based access control
- **"How do other tools integrate with us?"** — API key generation with scoped permissions and rate limiting
- **"How do we notify our customers' systems when things happen?"** — Webhook delivery with retry logic and payload signing
- **"How do we process slow tasks without blocking our API?"** — Background job queue with BullMQ

InfraCore solves all of these, so product teams can focus on what makes their product unique.

---

## Architecture

> 📐 [View Interactive Architecture Diagram](#) ← _deploy link goes here_

```
Client / API Consumer
        │
        ▼
┌─────────────────────────────────────────────────────┐
│                  Fastify API Server                 │
│                                                     │
│   Auth Middleware    Rate Limiter    Request Tracing │
│   (JWT / API Key)    (Redis)         (Pino + IDs)   │
│                                                     │
│   /auth    /orgs    /api-keys    /webhooks           │
│   /audit-logs       /insights   /metrics            │
└──────────────┬──────────────────────┬───────────────┘
               │                      │
    ┌──────────▼──────────┐  ┌────────▼────────────────┐
    │     PostgreSQL      │  │         Redis            │
    │                     │  │                          │
    │  users              │  │  rate limit counters     │
    │  organizations      │  │  token blacklist         │
    │  org_members        │  │  BullMQ job queues       │
    │  api_keys           │  └────────┬────────────────-┘
    │  webhook_endpoints  │           │
    │  webhook_events     │           ▼
    │  audit_logs         │  ┌─────────────────────────┐
    └─────────────────────┘  │    BullMQ Workers        │
                             │                          │
                             │  webhook delivery        │
                             │  HMAC signing            │
                             │  retry + dead-letter     │
                             └─────────────────────────┘
```

### Core Philosophy

**Multi-tenancy first.** Every piece of data is scoped by `org_id`. Organizations are completely isolated — they share the same database and server but cannot access each other's data. Every query is tenant-aware by design.

**Decouple operations from side effects.** When a member is added to an org, the API responds instantly. Webhook delivery happens asynchronously in a background worker. Slow or failing external systems never affect API response times.

**Security at every layer.** Passwords are bcrypt hashed. JWT tokens are short-lived with Redis-backed revocation. API keys are stored as bcrypt hashes — never retrievable after creation. Webhook payloads are HMAC-signed so consumers can verify authenticity.

---

## Key Technical Deep Dives

### 1. Two-Token JWT Authentication

Most implementations use a single long-lived JWT. InfraCore uses two tokens:

- **Access Token** (15 min) — used for every API request. Short-lived to minimize exposure.
- **Refresh Token** (7 days) — used only to get a new access token. Stored in Redis blacklist on logout.

If an access token is stolen, it expires in 15 minutes. If a refresh token is stolen, logging out invalidates it immediately via Redis blacklist — even before expiry.

### 2. API Key Security Design

API keys follow the same security model as passwords:

1. A cryptographically random key is generated using `crypto.getRandomValues()`
2. The full key is shown to the user **exactly once**
3. Only a bcrypt hash is stored in the database
4. A prefix (`ic_live_`) is stored in plain text for efficient lookup

On every request, the prefix narrows the search to a small subset of keys, then bcrypt comparison confirms the match — without ever storing the raw key.

### 3. Webhook Delivery — Reliability Engineering

Webhook delivery is intentionally decoupled from the HTTP request lifecycle:

```
API Request → DB Write → BullMQ Job Queued → API Responds (instant)
                                    ↓
                            Worker picks up job
                                    ↓
                         HMAC-sign payload
                                    ↓
                         HTTP POST to customer URL
                                    ↓
                    Success → DELIVERED | Failure → retry x3
                                                  → exponential backoff
                                                  → dead-letter on exhaustion
```

**Why not send inline?** If the customer's server is slow or down, it would block the API response and cause data inconsistency. The queue approach guarantees the core operation always succeeds, and delivery is handled reliably in the background.

### 4. BullMQ vs Pub/Sub — A Deliberate Choice

Redis Pub/Sub was considered and rejected for webhook delivery. Pub/Sub is fire-and-forget — if no worker is listening, the message is lost. BullMQ persists jobs in Redis, supports retry with exponential backoff, tracks job state, and survives server restarts. For critical operations like webhook delivery, reliability is non-negotiable.

### 5. Rate Limiting with Redis

Each API key carries a `rateLimit` value (requests per day). Usage is tracked with Redis:

```
Key:   ratelimit:<keyId>:<date>
Value: <request count>
TTL:   86400 seconds (auto-resets daily)
```

A Redis pipeline batches the `INCR` and `EXPIRE` commands into a single network round trip, minimizing latency on every authenticated request.

### 6. Multi-Tenancy Data Isolation

Every table that holds tenant data has an `orgId` foreign key. There are no cross-tenant queries. The OrgMember table acts as the bridge between users and organizations — a user can belong to multiple orgs, each with a different role. Membership is verified on every request before any data is returned.

---

## Tech Stack

| Technology | Role | Why |
|---|---|---|
| **Fastify** | HTTP Framework | 2x faster than Express, built-in TypeScript support, plugin architecture |
| **TypeScript** | Language | Type safety across the entire codebase, better developer experience |
| **PostgreSQL** | Primary Database | ACID compliance, array column support for webhook event types, robust relations |
| **Prisma 7** | ORM | Type-safe queries, migration management, relation traversal |
| **Redis** | Cache + Queue Store | Token blacklist, rate limit counters, BullMQ job persistence |
| **BullMQ** | Job Queue | Reliable background processing, retry logic, dead-letter queues |
| **Docker** | Containerization | Consistent local development, production parity |
| **Pino** | Logging | Structured JSON logs, extremely fast, built into Fastify |
| **Zod** | Validation | Runtime type checking on all incoming request data |
| **bcrypt** | Hashing | Password and API key hashing |
| **Gemini API** | AI Layer | Natural language queries over org usage data |

---

## Setup & Installation

### Prerequisites

- Node.js v20+
- Docker Desktop
- npm

### 1. Clone the repository

```bash
git clone https://github.com/Kaushik-FSD/InfraCore.git
cd infracore
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in the values:

```env
PORT=3000
NODE_ENV=development

DATABASE_URL=postgresql://postgres:password@localhost:5432/infracore

JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

REDIS_URL=redis://localhost:6379

GEMINI_API_KEY=your_gemini_api_key_here
```

### 4. Start Docker containers (PostgreSQL + Redis)

```bash
docker-compose up -d
```

Verify both containers are running:

```bash
docker ps
```

You should see `infracore_postgres` and `infracore_redis` both with status `Up`.

### 5. Run database migrations

```bash
npx prisma migrate dev --name init
```

### 6. Generate Prisma client

```bash
npx prisma generate
```

### 7. Start the development server

```bash
npm run dev
```

Server starts at `http://localhost:3000`

### 8. (Optional) Inspect the database

```bash
npx prisma studio --config prisma/prisma.config.ts
```

Opens Prisma Studio at `http://localhost:5555` — a visual UI for your database.

---

## Accessing the Application

> ⚠️ InfraCore is a **backend architecture project**. There is no user interface — all interaction is via API endpoints using a tool like Postman or cURL.

### Health Check

```
GET http://localhost:3000/health
```

```json
{ "status": "ok", "timestamp": "2026-03-22T10:00:00.000Z" }
```

### Server Metrics

```
GET http://localhost:3000/metrics
```

### API Documentation

See [API.md](./API.md) for complete endpoint documentation with request/response examples.

### Architecture Diagram

An interactive architecture diagram is available at: **[View Architecture](#)** ← _deploy link_

---

## Security

InfraCore implements security at multiple layers:

**Authentication**
- JWT access tokens expire in 15 minutes
- Refresh tokens are stored in Redis blacklist on logout — cannot be reused after logout even if not expired
- Passwords are bcrypt hashed with salt rounds of 10

**API Keys**
- Generated using `crypto.getRandomValues()` — cryptographically secure randomness
- Stored as bcrypt hashes — raw key is never persisted
- Shown exactly once at creation — not recoverable
- Scoped permissions — each key grants only what it needs
- Rate limited per key — abuse prevention

**Webhooks**
- Payloads signed with HMAC-SHA256
- Consumers verify signature before processing
- Signing secret shown once at endpoint registration

**Transport**
- `@fastify/helmet` sets security headers on all responses
- CORS configured per environment
- Request body validation on all endpoints via Zod

---

## Production Roadmap

These improvements would be made before deploying InfraCore to production:

**Infrastructure**
- [ ] CI/CD pipeline with GitHub Actions — automated testing and deployment on every push
- [ ] GCP or AWS deployment — containerized with proper secrets management
- [ ] Database connection pooling with PgBouncer — handle high concurrent connections
- [ ] Redis cluster — high availability cache and queue

**Security**
- [ ] Webhook signing secrets encrypted at rest in database
- [ ] IP allowlisting per API key
- [ ] 2FA support for user accounts
- [ ] Automated key rotation reminders

**Reliability**
- [ ] Distributed tracing with OpenTelemetry
- [ ] Webhook event replay — manually re-deliver failed events
- [ ] Dead letter queue dashboard — inspect and retry failed jobs
- [ ] Database read replicas for query performance

**Developer Experience**
- [ ] SDK generation from OpenAPI spec
- [ ] Webhook delivery simulator for local testing
- [ ] Usage dashboard UI
- [ ] Email notifications for key expiry and delivery failures

**AI Insights**
- [ ] Time-series analysis — detect usage trends over weeks/months
- [ ] Anomaly detection — flag unusual API usage patterns automatically
- [ ] Natural language to SQL — query any data via plain English

---

## Project Structure

```
infracore/
├── src/
│   ├── modules/
│   │   ├── auth/           # Signup, login, JWT tokens
│   │   ├── orgs/           # Organizations, members, roles
│   │   ├── api-keys/       # Key generation, verification, revocation
│   │   ├── webhooks/       # Endpoint registration, event delivery
│   │   ├── audit/          # Action logging, log retrieval
│   │   └── insights/       # AI-powered usage analysis
│   ├── plugins/
│   │   ├── prisma.ts       # Database plugin
│   │   ├── redis.ts        # Cache plugin
│   │   ├── authenticate.ts # JWT middleware
│   │   ├── apiKeyAuth.ts   # API key middleware
│   │   ├── rateLimiter.ts  # Rate limiting middleware
│   │   └── errorHandler.ts # Global error handling
│   ├── workers/
│   │   └── webhookWorker.ts # BullMQ background worker
│   ├── config/
│   │   ├── env.ts          # Environment variables
│   │   └── queue.ts        # BullMQ configuration
│   ├── utils/
│   │   └── prisma.ts       # Prisma client instance
│   ├── types/
│   │   └── index.ts        # Shared TypeScript types
│   ├── app.ts              # Fastify app setup
│   └── server.ts           # Entry point
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── prisma.config.ts    # Prisma configuration
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Author

Built by [Kaushik](https://github.com/Kaushik-FSD) as a portfolio project demonstrating production backend engineering patterns.
