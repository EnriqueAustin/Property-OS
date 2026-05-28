# 10 — Tech Stack & Infrastructure

## 10.1 Stack Selection Philosophy

The tech stack is chosen specifically to optimize for:
1. **AI-Assisted Development:** AI tools (Cursor, Copilot) excel at established patterns (Next.js, NestJS, TypeORM).
2. **Speed to Market:** Modular monolith over microservices. Managed infrastructure over raw AWS instances.
3. **South African Realities:** Fast global CDNs, lightweight payloads, offline-capable patterns.
4. **Data Integrity:** Strict PostgreSQL concurrency controls for booking safety.

---

## 10.2 The Core Stack

| Layer | Technology | Justification |
|---|---|---|
| **Frontend (Admin)** | Next.js (App Router) + React | Industry standard, excellent Server Components for fast initial loads. |
| **UI Component Library** | shadcn/ui + Tailwind CSS | Highly customizable, accessible, AI tools understand it perfectly. |
| **Frontend State/Data** | TanStack Query (React Query) | Handles caching, loading states, and background syncing out-of-the-box. |
| **Backend API** | NestJS | Enforces a strict, modular architecture. Excellent dependency injection. |
| **Database ORM** | TypeORM | Integrates seamlessly with NestJS. |
| **Primary Database** | PostgreSQL 16+ | Non-negotiable. Required for GiST exclusion constraints to prevent double bookings. |
| **Caching / Queues** | Redis | Fast availability caching, rate limiting, and background job queues (Phase 2). |
| **Booking Widget** | Lit (Web Components) | Compiles to a tiny, dependency-free JS bundle. Shadow DOM isolates CSS from the host's website. |
| **Monorepo Tooling** | Turborepo | Shares TypeScript interfaces and UI components between the admin app and the widget. |

---

## 10.3 Infrastructure & Hosting (MVP Phase)

We optimize for low DevOps overhead during the MVP phase, utilizing PaaS (Platform as a Service) providers.

### 1. Frontend Hosting: Vercel
* **What:** Hosts the Next.js Admin Dashboard and serves the Booking Widget JS bundle.
* **Why:** Zero-config Next.js deployments, edge caching, built-in CI/CD via GitHub.
* **Cost:** Free tier initially, then $20/mo (Pro).

### 2. Backend API Hosting: Railway or Render
* **What:** Hosts the NestJS Node.js application.
* **Why:** Simpler than raw AWS EC2/ECS. Auto-builds from Dockerfile or directly from GitHub. Easy scaling.
* **Cost:** ~$5 - $20/mo depending on usage.

### 3. Database: Supabase (Managed PostgreSQL)
* **What:** Hosts the PostgreSQL database and provides S3-compatible file storage (for room photos).
* **Why:** Excellent dashboard, automated backups, built-in connection pooling (PgBouncer) which is critical for serverless/edge environments.
* **Cost:** Free tier initially, then $25/mo (Pro).

### 4. Redis: Upstash
* **What:** Serverless Redis.
* **Why:** Pay-per-request pricing means $0 cost while traffic is low, no server to manage.

---

## 10.4 Local Development Architecture (Docker)

While production uses managed services (Supabase/Vercel/Railway), your **local development environment** should be fully containerized using Docker to ensure consistency and easy setup.

### Local `docker-compose.yml` Services:
1. **PostgreSQL 16:** Runs locally on port `5432`. Replicates the Supabase database.
2. **Redis:** Runs locally on port `6379` for caching and rate-limiting tests.
3. **pgAdmin / DBeaver (Optional):** Runs a local web interface on port `5050` to easily inspect your database tables and test queries visually.

**Why Docker locally?**
- AI tools can easily generate a standard `docker-compose.yml`.
- You can destroy and recreate your entire database with one command (`docker compose down -v && docker compose up -d`) when testing migrations.
- No need to pollute your Windows/Mac OS with database installations.

---

## 10.5 Critical Technical Patterns

### 1. The Double-Booking Prevention Pattern
This is the most critical technical requirement of the platform. Application-level checks are insufficient due to race conditions.

**Implementation:**
We use PostgreSQL **GiST (Generalized Search Tree) Exclusion Constraints**.
```sql
-- Prevents any two bookings for the same room from having overlapping dates
ALTER TABLE bookings
ADD CONSTRAINT prevent_double_booking
EXCLUDE USING GIST (
    room_id WITH =,
    daterange(check_in, check_out) WITH &&
) WHERE (status NOT IN ('cancelled', 'no_show'));
```
*Note: Requires the `btree_gist` extension to be enabled in PostgreSQL.*

### 2. Embeddable Widget Pattern
The public booking engine must be embeddable on any hotel's WordPress/Wix site.
* We build it using **Lit** to create a native Web Component (`<propertyos-booking slug="seaside"></propertyos-booking>`).
* We bundle it into a single `widget.js` file using Vite.
* We configure the NestJS API with strict CORS policies, allowing requests from any origin *only* for the public widget endpoints, and utilizing origin validation.

### 3. Timezone Handling
South Africa is UTC+2.
* **Database:** ALL datetimes are stored as `TIMESTAMPTZ` (UTC). Dates (check-in/out) are stored as `DATE`.
* **Backend:** All internal logic runs in UTC.
* **Frontend:** Converts UTC to the property's local timezone (e.g., 'Africa/Johannesburg') for display using libraries like `date-fns-tz`.

---

## 10.5 Security & Compliance (POPIA)

* **Data at Rest:** Supabase encrypts the underlying volumes by default.
* **Data in Transit:** TLS 1.3 enforced on all Vercel/Railway endpoints.
* **PII Minimization:** Collect only necessary guest data (Name, Email, Phone). ID/Passport numbers should only be collected if strictly required by local law and must be encrypted at the application level before database insertion.
* **Authentication:** JWT with short-lived access tokens (15m) and HTTP-only, secure cookies for refresh tokens.
* **Rate Limiting:** Global rate limiting via NestJS `ThrottlerModule` (backed by Redis) to prevent brute-force and DDoS attacks.
