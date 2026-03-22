# API Documentation

> Complete REST API reference for InfraCore. All endpoints return JSON. All protected endpoints require either a JWT Bearer token or an API Key in the request headers.

---

## Base URL

```
http://localhost:3000
```

---

## Authentication

InfraCore supports two authentication methods:

### JWT Bearer Token
For human-facing operations (dashboard, admin actions):
```
Authorization: Bearer <access_token>
```

### API Key
For machine-to-machine operations:
```
X-API-Key: ic_live_<key>
```

---

## Standard Response Format

### Success
```json
{
  "data": { ... }
}
```

### Error
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": [
      { "field": "email", "message": "Invalid email" }
    ]
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `UNAUTHORIZED` | 401 | Missing or invalid token/key |
| `FORBIDDEN` | 403 | Authenticated but not authorized |
| `NOT_FOUND` | 404 | Resource does not exist |
| `CONFLICT` | 409 | Resource already exists |
| `TOO_MANY_REQUESTS` | 429 | Rate limit exceeded |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected server error |

---

## 🏥 Health & Metrics

### Health Check

```
GET /health
```

No authentication required.

**Response `200`**
```json
{
  "status": "ok",
  "timestamp": "2026-03-22T10:00:00.000Z"
}
```

---

### Server Metrics

```
GET /metrics
```

No authentication required.

**Response `200`**
```json
{
  "status": "ok",
  "timestamp": "2026-03-22T10:00:00.000Z",
  "uptime": 3600,
  "memory": {
    "used": 87,
    "total": 142,
    "unit": "MB"
  },
  "cpu": "0.42",
  "node": "v24.0.0"
}
```

---

## 🔐 Auth

### Signup

```
POST /auth/signup
```

No authentication required.

**Request Body**
```json
{
  "email": "alice@acme.com",
  "password": "password123"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `email` | string | Yes | Valid email format |
| `password` | string | Yes | Minimum 8 characters |

**Response `201`**
```json
{
  "message": "Signup successful",
  "user": {
    "id": "cmmqow3ba0000t8l7omjfkktt",
    "email": "alice@acme.com"
  }
}
```

**Errors**
| Status | Code | Reason |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid email or short password |
| 409 | `CONFLICT` | Email already in use |

---

### Login

```
POST /auth/login
```

No authentication required.

**Request Body**
```json
{
  "email": "alice@acme.com",
  "password": "password123"
}
```

**Response `200`**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

> Store both tokens. Use `accessToken` for API requests. Use `refreshToken` to get a new access token when it expires.

**Errors**
| Status | Code | Reason |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Missing fields |
| 401 | `UNAUTHORIZED` | Invalid email or password |

---

### Refresh Token

```
POST /auth/refresh
```

No authentication required.

**Request Body**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response `200`**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors**
| Status | Code | Reason |
|---|---|---|
| 401 | `UNAUTHORIZED` | Invalid, expired, or revoked refresh token |

---

### Logout

```
POST /auth/logout
```

No authentication required.

**Request Body**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response `200`**
```json
{
  "message": "Logged out successfully"
}
```

> After logout, the refresh token is blacklisted in Redis. Any further use of this token will return `401 UNAUTHORIZED`.

---

## 🏢 Organizations

All organization endpoints require `Authorization: Bearer <access_token>`.

---

### Create Organization

```
POST /orgs
```

**Request Body**
```json
{
  "name": "Acme Corp",
  "slug": "acme-corp"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `name` | string | Yes | Minimum 2 characters |
| `slug` | string | Yes | Lowercase letters, numbers, hyphens only |

**Response `201`**
```json
{
  "org": {
    "id": "cmmyu72wg0001nbxouucl44t5",
    "name": "Acme Corp",
    "slug": "acme-corp",
    "createdAt": "2026-03-22T10:00:00.000Z",
    "updatedAt": "2026-03-22T10:00:00.000Z"
  }
}
```

> The authenticated user is automatically added as `ADMIN` of the created organization.

**Errors**
| Status | Code | Reason |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid slug format |
| 409 | `CONFLICT` | Slug already taken |

---

### Get Organization

```
GET /orgs/:orgId
```

**Path Parameters**
| Parameter | Description |
|---|---|
| `orgId` | Organization ID |

**Response `200`**
```json
{
  "org": {
    "id": "cmmyu72wg0001nbxouucl44t5",
    "name": "Acme Corp",
    "slug": "acme-corp",
    "createdAt": "2026-03-22T10:00:00.000Z",
    "updatedAt": "2026-03-22T10:00:00.000Z",
    "members": [
      {
        "id": "mem_001",
        "role": "ADMIN",
        "joinedAt": "2026-03-22T10:00:00.000Z",
        "user": {
          "id": "cmmqow3ba0000t8l7omjfkktt",
          "email": "alice@acme.com"
        }
      }
    ]
  }
}
```

**Errors**
| Status | Code | Reason |
|---|---|---|
| 403 | `FORBIDDEN` | Not a member of this org |
| 404 | `NOT_FOUND` | Organization not found |

---

### Invite Member

```
POST /orgs/:orgId/members
```

> Requires `ADMIN` role in the organization.

**Path Parameters**
| Parameter | Description |
|---|---|
| `orgId` | Organization ID |

**Request Body**
```json
{
  "email": "bob@acme.com",
  "role": "MEMBER"
}
```

| Field | Type | Required | Values |
|---|---|---|---|
| `email` | string | Yes | Valid email of existing user |
| `role` | string | No | `ADMIN`, `MEMBER`, `VIEWER` (default: `MEMBER`) |

**Response `201`**
```json
{
  "member": {
    "id": "mem_002",
    "role": "MEMBER",
    "joinedAt": "2026-03-22T10:05:00.000Z",
    "user": {
      "id": "usr_bob",
      "email": "bob@acme.com"
    }
  }
}
```

**Errors**
| Status | Code | Reason |
|---|---|---|
| 403 | `FORBIDDEN` | Not an admin of this org |
| 404 | `NOT_FOUND` | User with that email not found |
| 409 | `CONFLICT` | User is already a member |

---

### Update Member Role

```
PATCH /orgs/:orgId/members/:memberId
```

> Requires `ADMIN` role in the organization.

**Path Parameters**
| Parameter | Description |
|---|---|
| `orgId` | Organization ID |
| `memberId` | User ID of the member to update |

**Request Body**
```json
{
  "role": "ADMIN"
}
```

| Field | Type | Required | Values |
|---|---|---|---|
| `role` | string | Yes | `ADMIN`, `MEMBER`, `VIEWER` |

**Response `200`**
```json
{
  "member": {
    "id": "mem_002",
    "role": "ADMIN",
    "joinedAt": "2026-03-22T10:05:00.000Z",
    "user": {
      "id": "usr_bob",
      "email": "bob@acme.com"
    }
  }
}
```

**Errors**
| Status | Code | Reason |
|---|---|---|
| 403 | `FORBIDDEN` | Not an admin of this org |
| 404 | `NOT_FOUND` | Member not found in this org |

---

### Remove Member

```
DELETE /orgs/:orgId/members/:memberId
```

> Requires `ADMIN` role. Cannot remove yourself.

**Path Parameters**
| Parameter | Description |
|---|---|
| `orgId` | Organization ID |
| `memberId` | User ID of the member to remove |

**Response `200`**
```json
{
  "message": "Member removed successfully"
}
```

**Errors**
| Status | Code | Reason |
|---|---|---|
| 400 | `BAD_REQUEST` | Cannot remove yourself |
| 403 | `FORBIDDEN` | Not an admin of this org |
| 404 | `NOT_FOUND` | Member not found in this org |

---

## 🔑 API Keys

All API key endpoints require `Authorization: Bearer <access_token>`.

---

### Create API Key

```
POST /orgs/:orgId/api-keys
```

> Requires `ADMIN` role in the organization.

**Path Parameters**
| Parameter | Description |
|---|---|
| `orgId` | Organization ID |

**Request Body**
```json
{
  "name": "Mobile App Key",
  "permissions": ["read", "write"],
  "rateLimit": 1000,
  "expiresAt": "2027-01-01T00:00:00.000Z"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `name` | string | Yes | Minimum 1 character |
| `permissions` | string[] | Yes | `read`, `write`, `delete` — minimum 1 |
| `rateLimit` | number | No | 1–100000 (default: 1000) |
| `expiresAt` | string | No | ISO datetime string |

**Response `201`**
```json
{
  "id": "key_001",
  "name": "Mobile App Key",
  "key": "ic_live_xK9mN2pL4qR7sT3uV8wX1yZ5aB6cD",
  "keyPrefix": "ic_live",
  "permissions": ["read", "write"],
  "rateLimit": 1000,
  "expiresAt": null,
  "createdAt": "2026-03-22T10:00:00.000Z",
  "message": "Store this key safely — it will never be shown again"
}
```

> ⚠️ The `key` field is shown **exactly once**. It is not stored and cannot be retrieved later.

**Errors**
| Status | Code | Reason |
|---|---|---|
| 403 | `FORBIDDEN` | Not an admin of this org |

---

### List API Keys

```
GET /orgs/:orgId/api-keys
```

**Path Parameters**
| Parameter | Description |
|---|---|
| `orgId` | Organization ID |

**Response `200`**
```json
{
  "keys": [
    {
      "id": "key_001",
      "name": "Mobile App Key",
      "keyPrefix": "ic_live",
      "permissions": ["read", "write"],
      "rateLimit": 1000,
      "usageCount": 342,
      "lastUsedAt": "2026-03-22T09:00:00.000Z",
      "expiresAt": null,
      "createdAt": "2026-03-22T10:00:00.000Z",
      "revokedAt": null
    }
  ]
}
```

> The raw key value is never returned. Only metadata is returned.

---

### Revoke API Key

```
DELETE /orgs/:orgId/api-keys/:keyId
```

> Requires `ADMIN` role. Revocation is immediate and permanent.

**Path Parameters**
| Parameter | Description |
|---|---|
| `orgId` | Organization ID |
| `keyId` | API Key ID |

**Response `200`**
```json
{
  "message": "API key revoked successfully"
}
```

**Errors**
| Status | Code | Reason |
|---|---|---|
| 403 | `FORBIDDEN` | Not an admin of this org |
| 404 | `NOT_FOUND` | Key not found in this org |
| 409 | `CONFLICT` | Key is already revoked |

---

## 🪝 Webhooks

All webhook endpoints require `Authorization: Bearer <access_token>`.

---

### Register Webhook Endpoint

```
POST /orgs/:orgId/webhooks/endpoints
```

> Requires `ADMIN` role.

**Path Parameters**
| Parameter | Description |
|---|---|
| `orgId` | Organization ID |

**Request Body**
```json
{
  "url": "https://acme.com/infracore-events",
  "events": ["org.member_added", "api_key.created"]
}
```

| Field | Type | Required | Values |
|---|---|---|---|
| `url` | string | Yes | Valid HTTPS URL |
| `events` | string[] | Yes | See supported events below |

**Supported Events**
| Event | Triggered When |
|---|---|
| `org.member_added` | A new member joins the organization |
| `org.member_removed` | A member is removed from the organization |
| `org.member_role_updated` | A member's role is changed |
| `api_key.created` | A new API key is generated |
| `api_key.revoked` | An API key is revoked |

**Response `201`**
```json
{
  "endpoint": {
    "id": "whe_001",
    "url": "https://acme.com/infracore-events",
    "events": ["org.member_added", "api_key.created"],
    "secret": "whsec_a1b2c3d4e5f6...",
    "isActive": true,
    "createdAt": "2026-03-22T10:00:00.000Z"
  },
  "message": "Store the secret safely — it will not be shown again"
}
```

> ⚠️ The `secret` is shown **exactly once**. Use it to verify webhook signatures on your server.

**Verifying Webhook Signatures**
```typescript
const signature = request.headers['x-webhook-signature']
const expectedSig = `sha256=${crypto
  .createHmac('sha256', webhookSecret)
  .update(requestBody)
  .digest('hex')}`

if (signature !== expectedSig) {
  // Reject — not from InfraCore
}
```

---

### List Webhook Endpoints

```
GET /orgs/:orgId/webhooks/endpoints
```

**Response `200`**
```json
{
  "endpoints": [
    {
      "id": "whe_001",
      "url": "https://acme.com/infracore-events",
      "events": ["org.member_added", "api_key.created"],
      "isActive": true,
      "createdAt": "2026-03-22T10:00:00.000Z"
    }
  ]
}
```

---

### Delete Webhook Endpoint

```
DELETE /orgs/:orgId/webhooks/endpoints/:endpointId
```

> Requires `ADMIN` role.

**Path Parameters**
| Parameter | Description |
|---|---|
| `orgId` | Organization ID |
| `endpointId` | Webhook Endpoint ID |

**Response `200`**
```json
{
  "message": "Webhook endpoint deleted successfully"
}
```

**Errors**
| Status | Code | Reason |
|---|---|---|
| 403 | `FORBIDDEN` | Not an admin of this org |
| 404 | `NOT_FOUND` | Endpoint not found |

---

### List Webhook Events

```
GET /orgs/:orgId/webhooks/events
```

Returns the last 50 webhook events ordered by most recent first.

**Response `200`**
```json
{
  "events": [
    {
      "id": "wve_001",
      "eventType": "org.member_added",
      "payload": {
        "userId": "usr_bob",
        "email": "bob@acme.com",
        "role": "MEMBER"
      },
      "status": "DELIVERED",
      "attempts": 1,
      "deliveredAt": "2026-03-22T10:00:02.000Z",
      "createdAt": "2026-03-22T10:00:00.000Z",
      "endpoint": {
        "url": "https://acme.com/infracore-events"
      }
    }
  ]
}
```

**Event Status Values**
| Status | Description |
|---|---|
| `PENDING` | Job queued, delivery not yet attempted |
| `DELIVERED` | Successfully delivered to endpoint |
| `FAILED` | All retry attempts exhausted |

---

## 📋 Audit Logs

### Get Audit Logs

```
GET /orgs/:orgId/audit-logs
```

Requires `Authorization: Bearer <access_token>`. Returns last 100 actions ordered by most recent first.

**Path Parameters**
| Parameter | Description |
|---|---|
| `orgId` | Organization ID |

**Response `200`**
```json
{
  "logs": [
    {
      "id": "log_001",
      "action": "org.member_added",
      "metadata": {
        "invitedUserId": "usr_bob",
        "role": "MEMBER"
      },
      "ipAddress": "192.168.1.1",
      "createdAt": "2026-03-22T10:06:00.000Z",
      "user": {
        "id": "cmmqow3ba0000t8l7omjfkktt",
        "email": "alice@acme.com"
      }
    }
  ]
}
```

**Logged Actions**
| Action | Triggered By |
|---|---|
| `org.created` | Organization creation |
| `org.member_added` | Member invitation |
| `org.member_removed` | Member removal |
| `org.member_role_updated` | Role change |
| `api_key.created` | API key generation |
| `api_key.revoked` | API key revocation |

**Errors**
| Status | Code | Reason |
|---|---|---|
| 403 | `FORBIDDEN` | Not a member of this org |

---

## 🤖 AI Insights

All insights endpoints require `Authorization: Bearer <access_token>`.

---

### Query Insights

```
POST /orgs/:orgId/insights/query
```

Ask a natural language question about your organization's API usage, audit logs, and webhook delivery stats. Powered by Gemini AI.

**Path Parameters**
| Parameter | Description |
|---|---|
| `orgId` | Organization ID |

**Request Body**
```json
{
  "question": "Which API key is being used the most and when does usage peak?"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `question` | string | Yes | 10–500 characters |

**Response `200`**
```json
{
  "question": "Which API key is being used the most and when does usage peak?",
  "answer": "Your Mobile App Key accounts for 84% of total API usage with 8,432 requests. Based on the audit log timestamps, usage peaks between 9AM–11AM on weekdays, suggesting it correlates with your users' morning activity patterns.",
  "dataSnapshot": {
    "totalApiKeys": 3,
    "activeApiKeys": 2,
    "totalAuditEvents": 47,
    "webhookStats": [
      { "status": "DELIVERED", "_count": { "status": 38 } },
      { "status": "FAILED", "_count": { "status": 2 } }
    ]
  }
}
```

**Errors**
| Status | Code | Reason |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Question too short or too long |
| 403 | `FORBIDDEN` | Not a member of this org |
| 500 | `INTERNAL_SERVER_ERROR` | Gemini API error or quota exceeded |

---

### Get Usage Summary

```
GET /orgs/:orgId/insights/summary
```

Returns an AI-generated summary of the organization's overall API usage, recent activity, and any noteworthy patterns — without needing to ask a specific question.

**Path Parameters**
| Parameter | Description |
|---|---|
| `orgId` | Organization ID |

**Response `200`**
```json
{
  "question": "Give me a brief summary of this organization's API usage, recent activity, and anything noteworthy or unusual.",
  "answer": "Acme Corp has 3 API keys, 2 currently active. Total API usage this month is 9,979 requests, primarily from the Mobile App Key. Recent activity includes 2 new member invitations and 1 key revocation. Webhook delivery rate is 95% — 2 events failed delivery in the past week.",
  "dataSnapshot": {
    "totalApiKeys": 3,
    "activeApiKeys": 2,
    "totalAuditEvents": 47,
    "webhookStats": [
      { "status": "DELIVERED", "_count": { "status": 38 } },
      { "status": "FAILED", "_count": { "status": 2 } }
    ]
  }
}
```

---

## 📦 Webhook Payload Format

When InfraCore delivers a webhook to your registered URL, the HTTP POST body follows this structure:

```json
{
  "id": "wve_001",
  "eventType": "org.member_added",
  "payload": {
    "userId": "usr_bob",
    "email": "bob@acme.com",
    "role": "MEMBER"
  },
  "timestamp": "2026-03-22T10:00:00.000Z"
}
```

**Headers sent with every webhook delivery**
| Header | Value |
|---|---|
| `Content-Type` | `application/json` |
| `X-Webhook-Signature` | `sha256=<hmac_signature>` |
| `X-Webhook-Event` | Event type e.g. `org.member_added` |

---

## 🔁 Rate Limiting

API key requests are rate limited per key per day.

When the limit is exceeded:

**Response `429`**
```json
{
  "success": false,
  "error": {
    "code": "TOO_MANY_REQUESTS",
    "message": "Rate limit exceeded. Limit is 1000 requests per day.",
    "details": {
      "limit": 1000,
      "used": 1000,
      "resetsAt": "2026-03-22T23:59:59Z"
    }
  }
}
```

Rate limits reset at midnight UTC daily.
