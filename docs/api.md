# Backend API Reference

Base URL (local): `http://localhost:3001`

All responses are JSON. All amounts are serialized as strings to preserve BigInt precision.

---

## Authentication

### Schemes

| Scheme | Header | Used for |
|---|---|---|
| **Admin key** | `X-Admin-Key: <ADMIN_API_KEY>` | `/api/admin/*` routes and `GET /api/oracle/results` |
| **Oracle key** | `X-Oracle-Key: <ORACLE_API_KEY>` | `POST /api/oracle/submit` |
| **Wallet signature** | `x-wallet-address` + `x-wallet-signature` | End-user routes requiring wallet ownership (e.g. `PUT /api/users/:address`, `POST /api/markets`) |

Public endpoints require no authentication.

### Wallet challenge/response flow

Routes protected by wallet auth require the caller to prove they control a Stellar keypair:

1. `GET /api/auth/challenge?address=G...` — obtain a one-time challenge string
2. Sign the challenge with your Stellar secret key (Ed25519)
3. Send the protected request with:
   - `x-wallet-address: G...`
   - `x-wallet-signature: <base64 encoded signature>`

Challenges expire after 5 minutes and are one-time use.

### Header consistency

The environment variable names and header names are consistent across code and configuration:

| Variable | Header | Description |
|---|---|---|
| `ADMIN_API_KEY` | `X-Admin-Key` | Admin routes |
| `ORACLE_API_KEY` | `X-Oracle-Key` | Oracle submit |

---

## Users

### `GET /api/users/:address`

Returns user profile data for the given wallet address.

**Response `200`**
```json
{ "user": { "address": "GABC...", "displayName": "Satoshi", "avatarUrl": null } }
```

**Response `404`** — `{ "error": "User not found", "code": "NOT_FOUND" }`

---

### `PUT /api/users/:address`

Update profile fields. Requires wallet-signature auth matching `:address`.

**Headers required:** `x-wallet-address`, `x-wallet-message`, `x-wallet-signature`

**Body**
```json
{ "displayName": "New Name", "avatarUrl": "https://..." }
```

**Response `200`** — `{ "user": { ... } }`

---

### `GET /api/users/:address/bets`

Paginated bet history for a wallet.

**Query params:** `page`, `limit`

**Response `200`** — array of Bet objects

---

### `GET /api/users/:address/positions`

Paginated open positions for a wallet.

**Query params:** `page`, `limit`

**Response `200`** — array of position objects

---

## Markets

### `GET /api/markets`

Returns a paginated list of boxing markets.

**Query params**
| Param | Type | Description |
|---|---|---|
| `status` | string | Filter by `Open`, `Locked`, `Resolved`, `Cancelled`, `Disputed` |
| `weightClass` | string | Filter by fighter weight class |
| `page` | number | Page number (default 1) |
| `limit` | number | Results per page (default 20, max 100) |

**Response `200`**
```json
[
  {
    "id": "abc123",
    "contractAddress": "CABC...",
    "fighterA": { "name": "Canelo Alvarez", "record": "60-2-2", "nationality": "Mexico", "weightClass": "Super Middleweight" },
    "fighterB": { "name": "David Benavidez", "record": "29-0-0", "nationality": "USA", "weightClass": "Super Middleweight" },
    "scheduledAt": "2026-09-15T22:00:00Z",
    "bettingEndsAt": "2026-09-15T21:00:00Z",
    "status": "Open",
    "outcome": null,
    "poolA": "500000000",
    "poolB": "300000000",
    "totalPool": "800000000",
    "oracleAddress": "GABC...",
    "createdBy": "GABC..."
  }
]
```

---

### `POST /api/markets`

Creates a new market record. Requires wallet-signature auth (creator must prove wallet ownership via the challenge/response flow).

**Headers required:** `x-wallet-address`, `x-wallet-signature` (obtained via `GET /api/auth/challenge`)

**Body**
```json
{
  "id": "abc123",
  "contractAddress": "CABC...",
  "fighterA": { "name": "Canelo Alvarez", "record": "60-2-2" },
  "fighterB": { "name": "David Benavidez", "record": "29-0-0" },
  "scheduledAt": "2027-01-01T20:00:00Z",
  "bettingEndsAt": "2027-01-01T18:00:00Z",
  "createdBy": "GABC...",
  "oracleAddress": "GABC...",
  "txHash": "optional-tx-hash"
}
```

**Response `201`** — `{ "data": { ...market } }`
**Response `400`** — `{ "error": "Validation failed", "code": "VALIDATION_ERROR", "details": {...} }`
**Response `401`** — `{ "error": "Wallet signature required", "code": "WALLET_AUTH_REQUIRED" }`

---

### `GET /api/markets/:id`

Returns full detail for a single market.

**Response `200`** — same shape as one item above.
**Response `404`** — `{ "error": "Market not found" }`

---

### `GET /api/markets/:id/stats`

Returns aggregate stats for a market.

**Response `200`**
```json
{
  "totalBets": 142,
  "uniqueBettors": 89,
  "poolA": "500000000",
  "poolB": "300000000",
  "totalVolume": "800000000",
  "impliedOddsA": 62.5,
  "impliedOddsB": 37.5
}
```

---

### `GET /api/markets/:id/bets`

Returns all bets placed on a market.

**Query params:** `page`, `limit`

**Response `200`**
```json
[
  {
    "id": "bet_xyz",
    "marketId": "abc123",
    "bettor": "GABC...",
    "side": "FighterA",
    "amount": "10000000",
    "placedAt": "2026-09-10T14:00:00Z",
    "claimed": false,
    "payout": null
  }
]
```

---

### `GET /api/markets/:id/odds-history`

Returns historical odds snapshots for the market chart.

**Response `200`**
```json
[
  {
    "timestamp": "2026-09-10T14:00:00Z",
    "poolA": "100000000",
    "poolB": "50000000",
    "oddsA": 66.7,
    "oddsB": 33.3
  }
]
```

---

## Bets

### `GET /api/bets/:address`

Returns all bets for a Stellar wallet address.

**Query params**
| Param | Type | Description |
|---|---|---|
| `status` | string | `pending`, `won`, `lost`, `claimed` |
| `marketId` | string | Filter to a specific market |
| `page`, `limit` | number | Pagination |

**Response `200`** — array of Bet objects (same shape as above).

---

### `GET /api/bets/:address/portfolio`

Returns portfolio summary for a wallet.

**Response `200`**
```json
{
  "totalStaked": "1500000000",
  "totalWinnings": "2100000000",
  "pendingClaims": "350000000",
  "activeBets": 3,
  "completedBets": 12,
  "roi": 40.0
}
```

---

### `GET /api/bets/payout-estimate`

Returns estimated payout for a hypothetical bet. Does not place a real bet.

**Query params**
| Param | Type | Required | Description |
|---|---|---|---|
| `market_id` | string | yes | Target market |
| `side` | `FighterA` \| `FighterB` | yes | Side to bet on |
| `amount` | string (stroops) | yes | Stake amount |

**Response `200`**
```json
{ "estimate": "18600000" }
```

**Response `400`** — `{ "error": "amount below minimum bet" }`

---

## Oracle (authorized)

### `POST /api/oracle/submit`

Submit a fight result. Requires `Authorization: Bearer <ORACLE_API_KEY>`.

**Body**
```json
{
  "market_id": "abc123",
  "outcome": "FighterA",
  "source": "BoxRec"
}
```

**Response `201`**
```json
{
  "id": "uuid",
  "marketId": "abc123",
  "outcome": "FighterA",
  "source": "BoxRec",
  "reportedBy": "GABC...",
  "reportedAt": "2026-09-16T01:00:00Z",
  "confirmed": false
}
```

---

### `GET /api/oracle/results` (admin)

Lists all oracle submissions.

**Response `200`** — array of OracleResult objects.

---

## Admin (protected)

### `POST /api/admin/markets/resolve`

Confirms an oracle result and triggers on-chain resolution.

**Body**
```json
{
  "oracle_result_id": "uuid"
}
```

**Response `200`** — `{ "status": "ok" }`

---

### `POST /api/admin/markets/dispute/resolve`

Resolves a disputed market with an admin override outcome.

**Body**
```json
{
  "dispute_id": "uuid",
  "override_outcome": "FighterB"
}
```

**Response `200`** — `{ "status": "ok" }`

---

### `GET /api/admin/markets/pending`

Returns all markets in `Locked` status without a confirmed oracle result.

**Response `200`** — array of Market objects.

---

## Health

### `GET /health`

**Response `200`**
```json
{ "status": "ok", "db": "connected" }
```

---

## Error Format

All errors follow this shape:

```json
{
  "error": "Human-readable message",
  "code": "MACHINE_READABLE_CODE"
}
```

Common codes: `NOT_FOUND`, `UNAUTHORIZED`, `VALIDATION_ERROR`, `RATE_LIMITED`, `INTERNAL_ERROR`
