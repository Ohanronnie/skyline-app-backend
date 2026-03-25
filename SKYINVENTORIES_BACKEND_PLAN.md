# Skyinventories backend — plan & client contract

This **NestJS** repo is the API for the Skyinventories mobile app (`skyline-app`, Expo — separate workspace). Use this file for parity with the app’s expectations and internal backlog.

**Backend repo (this workspace):** _fill in org/repo URL if published_

---

## What the mobile app talks to

| Item | Value |
|------|--------|
| Production API base (typical) | `https://api.skyinventories.com/api` |
| Auth | Bearer access token; refresh must match `lib/api.ts` (path may be `/partners/auth/refresh` under this API — verify in the app) |
| iOS URL scheme | `skyinventories://` (`app.json` → `scheme`) — general deep links only |

The app **does not** implement payment return URLs or in-app checkout. **Entitlements** (plan, limits) are still **server-owned**; the client must not infer paid tier without the API.

---

## Billing & product choice (aligned with the app)

- **Mobile:** No partner billing UI, no checkout calls — payment helpers were removed from `lib/api.ts`. Do not assume the app will hit `POST /payments/checkout`.
- **Backend:** Plan and payment state stay **authoritative** in the DB (admin, web portal, invoicing, optional gateway webhooks). **GET** routes below support portals and future clients; **POST** checkout/webhook are **off by default** (see `ENABLE_PAYMENTS_GATEWAY`).

### Suggested API surface

| Method | Path | Role |
|--------|------|------|
| GET | `/payments/status` | `{ isActive, plan, lastPayment }`, `plan`: `none` \| `basic` \| `professional` |
| GET | `/payments/history` | Partner payment list (web / admin tooling) |
| POST | `/payments/checkout` | Monthly subscription → hosted checkout (**404 unless gateway enabled**) |
| POST | `/payments/checkout/professional` | Professional upgrade (**404 unless gateway enabled**) |
| POST | `/payments/webhook` | Provider callback (**404 unless gateway enabled**) |

Document request/response bodies in this repo or OpenAPI; they are no longer duplicated in the app’s TypeScript.

---

## Account deletion (App Store / self-service)

- **`DELETE /users/:id`** — admin/staff deleting another user (see app `deleteUser`); not end-user self-delete.
- **Self-delete:** add a dedicated authenticated route when needed, e.g. `DELETE /users/me` or `POST /auth/account` with `{ "action": "delete" }`, with documented behavior (delete vs anonymize, data retention, token invalidation). The app does **not** call this yet (`APP_STORE_TODO.md`). Implement when in-app signup warrants it.

---

## Environment & secrets

Copy `env.template` → `.env`.

- **Core:** `MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `PORT`, `NODE_ENV`, `ALLOWED_ORIGINS` (for web admin; native apps often send no `Origin`).
- **Payments gateway:** `ENABLE_PAYMENTS_GATEWAY` — must be `true` to expose Hubtel checkout + webhook; otherwise those routes respond with **404**. Hubtel vars are required only when enabled.
- **Payment provider keys:** optional if partners pay only offline and you only maintain plan flags in the DB.

Never commit production secrets.

---

## Partner billing — server vs mobile

**Mobile:** Bills & payment / upgrade flows and `payments/return` handling are **removed** from the client.

**Backend:** Keep plan state in the database. Turning on **`ENABLE_PAYMENTS_GATEWAY`** is for **web** or internal automation only. Re-introducing in-app purchases later triggers **Apple Guideline 3.1.x** review.

### Why not “auto credit” in the app only?

Client-only tier flags are unsafe; grant `plan` / `billingWaivedUntil` (or similar) in the API when comping or invoicing offline.

---

## Latest mechanical audit

> Regenerate: `npm run plan:audit`  
> This block is **overwritten by the script** — edit sections above/below it, not here.

<!-- AUTO:PLAN_AUDIT -->
**Generated:** 2026-03-25T11:55:59.285Z (`npm run plan:audit`)

| Check | Status |
|-------|--------|
| Global prefix `/api` | **OK** |
| GET /api/health (AppController @Get health) | **OK** |
| POST /api/partners/auth/refresh | **OK** |
| Payments: GET history (entitlements / portal) | **OK** |
| Payments: GET status (entitlements) | **OK** |
| Gateway gated: ENABLE_PAYMENTS_GATEWAY in payments.module factory | **OK** |
| Gateway gated: optional HUBTEL_HTTP_CLIENT in PaymentsService | **OK** |
| env.template documents ENABLE_PAYMENTS_GATEWAY | **OK** |

**Summary:** Core + payments gateway gating checks passed (verify DTOs and mobile `lib/api.ts` separately).
<!-- /AUTO:PLAN_AUDIT -->

---

## Manual checklist (todos)

### Onboarding & docs

- [ ] Set **Backend repo** link at the top.
- [ ] Replace boilerplate `README.md` with install, `npm run start:dev`, env summary, link to this plan.

### Client parity

- [ ] Confirm mobile `API_BASE_URL` and **refresh** path vs **`POST /api/partners/auth/refresh`** (add **`POST /api/auth/refresh`** alias only if the app still expects `/auth/refresh`).
- [ ] Keep **`GET /api/payments/status`** aligned with how the app (or future builds) enforces limits — `plan` is the source of truth.
- [ ] If you enable **`ENABLE_PAYMENTS_GATEWAY`**, configure Hubtel return/cancel URLs for **web**, verify webhooks (signatures, idempotency).

### Account lifecycle

- [ ] Implement and document **self-service account deletion** when in-app account creation ships; wire the app and update cross-links.

### Ops

- [ ] Production: HTTPS, valid certs; secrets via host or CI.
- [ ] Smoke-test **`GET /api/health`**, auth, refresh, and entitlement reads.

---

## Related paths in this repo

| Concern | Location |
|--------|----------|
| Global `/api` prefix | `src/main.ts` |
| Health | `src/app.controller.ts` — `GET health` |
| Partner auth & refresh | `src/partners/partners.controller.ts` |
| Payments (read + optional gateway) | `src/payments/payments.controller.ts`, `payments.service.ts`, `payments.module.ts` |
| Env template | `env.template` |

---

## Checklist when opening this repo

1. Clone; read `README` / Node version.
2. Copy `env.template` → `.env`; set DB + JWT (+ gateway only if needed).
3. Run seeds/migrations if documented.
4. `npm run start:dev`; verify `GET /api/health` and login from Postman before debugging the app.
