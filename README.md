# InfraCore

> The backend skeleton every real SaaS product is built on. A production-grade, multi-tenant backend platform providing authentication, organization management, API key infrastructure, webhook delivery, background job processing, and AI-powered usage insights — engineered with modern Node.js patterns.

[![Node.js](https://img.shields.io/badge/Node.js-v24+-green)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://typescriptlang.org)
[![Fastify](https://img.shields.io/badge/Fastify-5.x-black)](https://fastify.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue)](https://postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-red)](https://redis.io)
[![Prisma](https://img.shields.io/badge/Prisma-7.x-white)](https://prisma.io)

---

## What is InfraCore?

InfraCore is a backend infrastructure platform that solves the problem every SaaS product faces before writing a single line of their actual product — building the plumbing.

Every company building a SaaS product needs the same foundational backend layer: user authentication, multi-tenant organization workspaces, API key management for developer integrations, webhook event delivery for real-time notifications, and background job processing for reliability. Instead of rebuilding this from scratch every time, InfraCore provides it as a ready-to-use platform.

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

## 🏗 High-Level Architecture

InfraCore is designed as a **modular Fastify backend** with strict separation between HTTP layer, business logic, and infrastructure. Every module is self-contained with its own routes, service, and schema — no logic bleeds between modules.

### Core Philosophy

1. **Multi-tenancy first.** Every piece of data is scoped by `org_id`. Organizations are completely isolated — they share the same database and server but cannot access each other's data. Every query is tenant-aware by design.

2. **Decouple operations from side effects.** When a member is added to an org, the API responds instantly. Webhook delivery happens asynchronously in a BullMQ background worker. Slow or failing external systems never affect API response times.

3. **Security at every layer.** Passwords bcrypt-hashed. JWT tokens short-lived with Redis-backed revocation. API keys stored as bcrypt hashes — never retrievable after creation. Webhook payloads HMAC-signed for consumer verification.

```
Client / API Consumer
        │
        ▼
┌─────────────────────────────────────────────────────┐
│                  Fastify API Server                 │
│                                                     │
│   Auth Middleware    Rate Limiter    Request Tracing │
│   (JWT / API Key)    (Redis)         (Pino Logs)    │
│                                                     │
│   /auth    /orgs    /api-keys    /webhooks           │
│   /audit-logs       /insights   /metrics            │
└──────────────┬──────────────────────┬───────────────┘
               │                      │
    ┌──────────▼──────────┐  ┌────────▼──────────────┐
    │     PostgreSQL      │  │        Redis           │
    │                     │  │                        │
    │  users              │  │  rate limit counters   │
    │  organizations      │  │  token blacklist       │
    │  org_members        │  │  BullMQ job queues     │
    │  api_keys           │  └────────┬───────────────┘
    │  webhook_endpoints  │           │
    │  webhook_events     │           ▼
    │  audit_logs         │  ┌─────────────────────────┐
    └─────────────────────┘  │     BullMQ Workers       │
                             │                          │
                             │  webhook delivery        │
                             │  HMAC payload signing    │
                             │  retry + dead-letter     │
                             └─────────────────────────┘
```

> 📐 [https://kaushik-fsd.github.io/InfraCore/](#)

---

## 🚀 Key Technical Deep Dives

### 1. Two-Token JWT Authentication with Redis Blacklist

Most implementations use a single long-lived JWT. InfraCore uses a **two-token rotation system**:

- **Access Token (15 min)** — used for every API request. Short-lived to minimize exposure window.
- **Refresh Token (7 days)** — used only to issue new access tokens. Blacklisted in Redis on logout.

On logout, the refresh token is written to Redis with a matching 7-day TTL. Every refresh attempt checks the blacklist first — even a valid, non-expired token is rejected if present. This solves the core JWT problem: **stateless tokens are now revocable without a database hit on every request**.

### 2. API Key Security — Hash-Only Storage

API keys follow the same security model as passwords. The full key is **never stored**:

1. A cryptographically random key is generated using `crypto.getRandomValues()` — not `Math.random()`
2. The full key `ic_live_xK9mN2...` is shown to the user **exactly once**
3. Only a bcrypt hash is persisted in the database
4. A prefix (`ic_live`) is stored in plain text for efficient lookup

On verification, the prefix narrows the search to a small candidate set, then bcrypt comparison confirms the match. If the database is compromised, attackers get hashes — not usable keys. **Same security model as GitHub Personal Access Tokens.**

### 3. Webhook Delivery — Reliability Engineering

Webhook delivery is intentionally decoupled from the HTTP request lifecycle using BullMQ:

```
API Request
    │
    ├── DB Write (member added)
    ├── WebhookEvent created (status: PENDING)
    ├── Job pushed to BullMQ queue
    └── API Responds instantly ✓

        ↓ (async, background)

    Worker picks up job
        │
        ├── HMAC-sign payload with endpoint secret
        ├── HTTP POST → customer's registered URL
        │
        ├── 200 OK  → status: DELIVERED ✓
        └── Error   → retry x3 (exponential backoff: 10s → 20s → 40s)
                    → exhausted → status: FAILED → dead-letter queue
```

**Why not send inline?** Slow or failing customer servers would block API responses and risk data inconsistency. The queue approach guarantees the core operation always succeeds — delivery is a separate concern.

### 4. BullMQ vs Redis Pub/Sub — A Deliberate Choice

Redis Pub/Sub was evaluated and rejected for webhook delivery:

- **Pub/Sub is fire-and-forget** — if no worker is listening, the message is silently lost
- **BullMQ persists jobs in Redis** — jobs survive server restarts, worker downtime, and crashes
- **BullMQ tracks job state** — pending, active, completed, failed — fully observable
- **BullMQ retries automatically** — exponential backoff built in, no custom retry logic needed

For operations where reliability is non-negotiable, a durable job queue is the only correct choice.

### 5. Rate Limiting with Redis Pipeline

Each API key carries a `rateLimit` field (requests per day). Usage tracked with Redis:

```
Key:   ratelimit:<keyId>:<date>      e.g. ratelimit:key_001:2026-03-22
Value: <request count>               e.g. 847
TTL:   86400 seconds                 auto-resets at midnight
```

A **Redis pipeline** batches the `INCR` and `EXPIRE` commands into a single network round trip — half the latency of sequential commands. Without pipelining, a server crash between the two commands would leave the counter in Redis forever with no expiry. Pipelining minimizes that risk window.

### 6. Multi-Tenancy Data Isolation

Every table that holds tenant data carries an `orgId` foreign key. The `OrgMember` table acts as the authorization bridge — a user can belong to multiple orgs, each with a different role (ADMIN / MEMBER / VIEWER). Before any data operation, membership and role are verified:

```typescript
const membership = await prisma.orgMember.findUnique({
  where: { userId_orgId: { userId, orgId } }
})
if (!membership || membership.role !== Role.ADMIN) {
  throw { statusCode: 403, message: 'Forbidden' }
}
```

There are no cross-tenant queries anywhere in the codebase. Isolation is enforced at the service layer, not just the route layer.

---

## 🛠 Tech Stack

| Technology | Role | Why |
|---|---|---|
| **Fastify** | HTTP Framework | 2x faster than Express, schema-first design, plugin architecture ideal for modular systems |
| **TypeScript** | Language | End-to-end type safety, Prisma-generated types, module augmentation for Fastify decorators |
| **PostgreSQL** | Primary Database | ACID compliance, native array columns for webhook event subscriptions, strong relational model |
| **Prisma 7** | ORM | Type-safe queries, automated migrations, relation traversal with `include` and `select` |
| **Redis** | Cache + Queue Store | O(1) token blacklist lookups, rate limit counters with TTL, BullMQ job persistence |
| **BullMQ** | Job Queue | Durable background processing, built-in retry, exponential backoff, dead-letter queues |
| **Docker** | Containerization | Reproducible local environment, production parity for PostgreSQL and Redis |
| **Pino** | Logging | Structured JSON logs, built into Fastify, near-zero performance overhead |
| **Zod** | Validation | Runtime schema validation on all incoming request bodies, type inference |
| **bcrypt** | Hashing | Password and API key hashing with configurable salt rounds |
| **Gemini API** | AI Layer | Natural language queries over org API usage data and audit logs |

---

## 🏃 Setup & Installation

### Prerequisites

- Node.js v20+
- Docker Desktop
- npm

### 1. Clone the repository

```bash
git clone https://github.com/Kaushik-FSD/InfraCore.git
cd InfraCore
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in your values:

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

### 4. Start infrastructure containers

```bash
docker-compose up -d
```

Verify both containers are running:

```bash
docker ps
# Should show: infracore_postgres (5432) and infracore_redis (6379)
```

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

### 8. (Optional) Inspect the database visually

```bash
npx prisma studio --config prisma/prisma.config.ts
# Opens at http://localhost:5555
```

---

## 🌐 Accessing the Application

> ⚠️ InfraCore is a **backend architecture project**. There is no UI — all interaction is via REST API using Postman or cURL.

| Endpoint | Description |
|---|---|
| `GET /health` | Server health check |
| `GET /metrics` | Live server metrics (memory, CPU, uptime) |
| `POST /auth/signup` | Create a new user account |
| `POST /auth/login` | Authenticate and receive tokens |

See **[API.md](./API.md)** for complete endpoint documentation with request/response examples for all 20+ endpoints.

**Interactive Architecture Diagram:** [View Here](#) ← _deploy link_

---

## 🔒 Security

InfraCore implements defense-in-depth across multiple layers:

**Authentication & Session Management**
- JWT access tokens expire in 15 minutes — stolen tokens have a minimal exposure window
- Refresh tokens blacklisted in Redis on logout — revocation without per-request database overhead
- Passwords hashed with bcrypt (10 salt rounds)

**API Key Infrastructure**
- Generated with `crypto.getRandomValues()` — cryptographically secure, not `Math.random()`
- Stored as bcrypt hashes — raw key never persisted, not recoverable even by admins
- Scoped permissions — each key grants only what it needs (principle of least privilege)
- Per-key rate limiting — abuse prevention at the infrastructure level

**Webhook Security**
- Payloads signed with HMAC-SHA256 using a per-endpoint secret
- Consumers verify signature before processing — prevents forged webhook attacks
- Signing secret shown once at registration — treated same as API keys

**Transport & Input**
- `@fastify/helmet` enforces security headers on all responses
- Zod schema validation on every request body — no raw `request.body` usage anywhere
- CORS configured per environment

---

## 🗺 Production Roadmap

**Infrastructure**
- [ ] CI/CD pipeline with GitHub Actions — lint, type-check, and deploy on push to `main`
- [ ] GCP Cloud Run deployment — containerized, autoscaling, secrets via Secret Manager
- [ ] PgBouncer connection pooling — handle high concurrent database connections efficiently
- [ ] Redis Cluster — high availability cache and queue with automatic failover

**Security**
- [ ] Webhook signing secrets encrypted at rest using AES-256
- [ ] IP allowlisting per API key — restrict keys to known server IPs
- [ ] Two-factor authentication (TOTP) for user accounts
- [ ] Automated key rotation reminders via email and webhook notifications

**Reliability**
- [ ] Distributed tracing with OpenTelemetry — trace requests end-to-end across services
- [ ] Webhook event replay endpoint — manually re-deliver failed events without re-triggering
- [ ] Dead-letter queue dashboard — inspect, debug, and replay failed BullMQ jobs
- [ ] Database read replicas — separate read and write workloads at scale

**Developer Experience**
- [ ] OpenAPI/Swagger spec auto-generation from Zod route schemas
- [ ] Webhook delivery simulator for local development testing
- [ ] SDK generation from OpenAPI spec (TypeScript + Python)
- [ ] Email notifications for key expiry and sustained delivery failures

**AI Insights**
- [ ] Time-series usage analysis — detect API usage trends over weeks and months
- [ ] Anomaly detection — automatically flag unusual usage patterns per org
- [ ] Natural language to SQL — query any org data via plain English

---

## 📁 Project Structure

```
infracore/
├── src/
│   ├── modules/
│   │   ├── auth/           # Signup, login, JWT token lifecycle
│   │   ├── orgs/           # Organizations, members, RBAC roles
│   │   ├── api-keys/       # Key generation, verification, revocation
│   │   ├── webhooks/       # Endpoint registration, event delivery
│   │   ├── audit/          # Immutable action logging
│   │   └── insights/       # AI-powered usage analysis (Gemini)
│   ├── plugins/
│   │   ├── prisma.ts       # Fastify-decorated Prisma client
│   │   ├── redis.ts        # Fastify-decorated Redis client
│   │   ├── authenticate.ts # JWT verification middleware
│   │   ├── apiKeyAuth.ts   # API key verification middleware
│   │   ├── rateLimiter.ts  # Per-key Redis rate limiting
│   │   └── errorHandler.ts # Global structured error responses
│   ├── workers/
│   │   └── webhookWorker.ts # BullMQ worker — delivery, signing, retry
│   ├── config/
│   │   ├── env.ts          # Typed, validated environment variables
│   │   └── queue.ts        # BullMQ connection and queue configuration
│   ├── utils/
│   │   └── prisma.ts       # Singleton Prisma client with PG adapter
│   ├── types/
│   │   └── index.ts        # FastifyInstance + FastifyRequest augmentation
│   ├── app.ts              # App factory — plugin and route registration
│   └── server.ts           # Entry point — starts HTTP server and BullMQ worker
├── prisma/
│   ├── schema.prisma       # 7-table database schema
│   └── prisma.config.ts    # Prisma 7 datasource configuration
├── docker-compose.yml      # PostgreSQL + Redis containers
├── .env.example            # Environment variable template
├── API.md                  # Complete REST API documentation
└── README.md
```

---

## 👤 Author

Built by [Kaushik](https://github.com/Kaushik-FSD) as a portfolio project demonstrating production backend engineering — multi-tenancy, distributed job processing, security patterns, and AI integration.
