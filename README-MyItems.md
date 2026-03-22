# InfraCore
InfraCore is a backend that other apps plug into. 

to run docker desktop:
docker-compose up -d

to run prisma-studio:
npx prisma studio --config prisma/prisma.config.ts

# uses of API KEYS:

So "machine to machine" just means — two servers talking to each other automatically, no human involved, no browser, no typing. The API key is how the calling server proves its identity to your server.
But imagine this scenario:
You have a server running 24/7 that automatically deploys your code every time you push. That server needs to pull code from GitHub every few minutes.
Would you:

Type your password every time the server needs to pull? — impossible, no human there
Store your actual password in the server's config file? — terrible idea

---

## JWT vs API Key — who uses what

**JWT is for humans using InfraCore directly.**

Alice opens a dashboard, logs in, creates an org, invites Bob. Alice is a human, she logs in with email/password, gets a JWT, uses it for every request.

```
Alice → browser/postman → JWT token → InfraCore
```

---

**API Key is for Acme's OWN app talking to InfraCore.**

Remember our earlier story — Acme Corp built TaskFlow (their product) on top of InfraCore. TaskFlow's backend server needs to call InfraCore APIs automatically. No human involved.

```
TaskFlow backend server → API key → InfraCore
```

---

## Where machine-to-machine happens in InfraCore

Let me make it very concrete.

Acme builds TaskFlow. Their backend code looks like this:

```typescript
// TaskFlow's own backend server
// This runs automatically when a new task is created

const response = await fetch('https://infracore.com/orgs/org_acme/webhooks/trigger', {
  method: 'POST',
  headers: {
    'X-API-Key': 'ic_live_xK9mN2...' // ← API key, no human involved
  },
  body: JSON.stringify({
    event: 'task.created',
    data: { taskId: '123', title: 'Fix bug' }
  })
})
```

No human typed that. TaskFlow's server sent it automatically. That's machine to machine.

---

## "Machine only gets org data, not user data — what's the point?"

This is the key insight you're missing.

When a machine calls InfraCore, InfraCore doesn't need to know WHICH human is making the call. It just needs to know WHICH COMPANY (org) is making the call.

Think about it:

```
TaskFlow server calls InfraCore
→ InfraCore sees: this is Acme Corp's API key
→ InfraCore knows: this request belongs to org_acme
→ InfraCore processes it under Acme's account
→ Usage gets tracked against Acme's quota
→ Webhooks fire for Acme's registered endpoints
```

The org IS the identity for machine calls. Which company is calling — that's all that matters.

It's the same in real life. When Stripe's server pings your webhook, Stripe doesn't tell you which Stripe employee triggered it. They tell you which Stripe account (org) sent it.

---

## Side by side comparison

```
Human flow:
Alice logs in → gets JWT → calls GET /orgs/org_acme
InfraCore knows: Alice (userId) is requesting, she's an ADMIN of org_acme
Used for: dashboard, manual operations, admin tasks

Machine flow:
TaskFlow server → sends API key → calls POST /orgs/org_acme/webhooks/trigger
InfraCore knows: org_acme's server is making this call
Used for: automated operations, integrations, background tasks
```

---

## Where exactly in InfraCore will API keys be used

Specifically these endpoints will accept API keys:

```
POST /webhooks/trigger    ← TaskFlow triggers a webhook event
GET  /audit-logs          ← TaskFlow fetches its own audit logs
GET  /api-keys/usage      ← TaskFlow checks its own usage stats
```

These are endpoints that Acme's SERVER calls automatically — not endpoints Alice uses from a dashboard.

---

Does the separation make sense now? JWT = human identity, API key = company/org identity.



API KEY EXAMPLE:
{
    "id": "cmmyubayh0004nbxo7hrqux94",
    "name": "Mobile App Key",
    "key": "ic_live_3803CnAklb45x9CaSauuMTqnTzHkZdoO",
    "keyPrefix": "ic_live",
    "permissions": [
        "read",
        "write"
    ],
    "rateLimit": 1000,
    "expiresAt": null,
    "createdAt": "2026-03-20T11:53:07.385Z",
    "message": "Store this key safely — it will never be shown again"
}

payload:
{
  "name": "Mobile App Key",
  "permissions": ["read", "write"],
  "rateLimit": 1000
}

Full InfraCore:

Project setup — Fastify + TypeScript + folder structure
Docker — PostgreSQL + Redis
Prisma 7 — schema, migrations, 7 tables
Auth module — signup, login, refresh, logout, JWT two-token flow, Redis blacklist
Error handler — clean consistent error responses
Auth middleware — JWT + API Key
Orgs module — create, get, invite, roles, remove
API Keys module — generate, list, revoke, verify
Rate Limiting — per API key, Redis based, 24hr reset
Webhooks module — register endpoints, trigger events, delivery, list
BullMQ worker — background delivery, HMAC signing, retry, dead letter
Audit Logs — automatic action logging, fetch per org
Observability — metrics endpoint
AI Insights — Gemini API, natural language queries over usage data