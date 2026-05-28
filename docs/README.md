# Property OS — Documentation Hub

> A South Africa-first hospitality operating system that starts as a booking engine + lightweight PMS and evolves into a full channel manager and platform competitor.

## 📂 Documentation Index

| Document | Purpose | Audience |
|---|---|---|
| [01 — Product Vision & Strategy](./01-product-vision-strategy.md) | Why this exists, positioning, competitive landscape | Product, Business |
| [02 — Product Roadmap](./02-product-roadmap.md) | Phased feature evolution with timelines | Product, Engineering |
| [03 — System Architecture](./03-system-architecture.md) | Technical architecture, modules, data flow | Engineering, AI Dev |
| [04 — Database Schema](./04-database-schema.md) | Complete entity definitions, relationships, indexes | Engineering, AI Dev |
| [05 — API Design](./05-api-design.md) | Full endpoint specifications with request/response | Engineering, AI Dev |
| [06 — UI/UX Specification](./06-ui-ux-specification.md) | Screen-by-screen design spec + component hierarchy | Frontend, Design |
| [07 — AI Development Guide](./07-ai-development-guide.md) | How to use AI tools to build each module | AI Dev |
| [08 — Go-to-Market (South Africa)](./08-go-to-market-sa.md) | Launch strategy, pricing, first customers | Business |
| [09 — Integrations Playbook](./09-integrations-playbook.md) | OTA, payment, messaging integration details | Engineering |
| [10 — Tech Stack & Infrastructure](./10-tech-stack-infrastructure.md) | Stack decisions, deployment, DevOps | Engineering |

## 🏗️ Build Phases

```
Phase 1 (0–3 months)  → Booking Engine + PMS-Lite        → "Get properties live fast"
Phase 2 (3–9 months)  → Channel Manager                  → "NightsBridge competitor"
Phase 3 (9–18 months) → Automation + Payments             → "Full operational layer"
Phase 4 (18–36 months)→ Full Platform                     → "Cloudbeds competitor"
```

## 🧭 How to Use These Docs

### For AI-Assisted Development
1. Start with [07 — AI Development Guide](./07-ai-development-guide.md) for the build methodology
2. Reference [04 — Database Schema](./04-database-schema.md) and [05 — API Design](./05-api-design.md) when generating backend code
3. Reference [06 — UI/UX Specification](./06-ui-ux-specification.md) when generating frontend code
4. Follow the module order in [02 — Product Roadmap](./02-product-roadmap.md)

### For Product Decisions
1. Start with [01 — Product Vision & Strategy](./01-product-vision-strategy.md)
2. Reference [08 — Go-to-Market](./08-go-to-market-sa.md) for positioning
3. Use [02 — Product Roadmap](./02-product-roadmap.md) for prioritization

### For Architecture Decisions
1. Start with [03 — System Architecture](./03-system-architecture.md)
2. Reference [10 — Tech Stack](./10-tech-stack-infrastructure.md) for technology choices
3. Use [09 — Integrations Playbook](./09-integrations-playbook.md) for external systems
