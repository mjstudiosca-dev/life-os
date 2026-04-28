# Build Log

Running record of implementation decisions for the Life OS project.

---

## 2026-04-27 — Step 1: Foundation

**Decision: TypeScript**
Chosen for strict type safety on data structures (config schemas, state files) that will be read and written by multiple scripts. Strict mode enforced in tsconfig. Runtime execution via `tsx` to avoid a build step during development.

**Decision: JSON for config files**
Human-editable without tooling. Easy to validate with `node -e "require(...)"`. Machine-writable by future scripts. Comments not supported natively — where comments are needed (flags.json), a `_comment` key is used as a convention.

**Decision: DRY_RUN in both .env and config/flags.json**
`.env` is the runtime source of truth (gitignored, environment-variable-friendly for eventual Cloud Routine background execution). `config/flags.json` holds committed safe defaults and serves as documentation. Scripts will read `.env` first, fall back to `flags.json`. Default is always `true` — no accidental writes.

**Decision: Type-specific schemas in bible-plan.json**
`date_match` and `monthly_full` tracks derive position from the calendar — no stored `current_position`. `sequential` tracks store `current_position` and `end_position` explicitly. Avoids null fields on tracks where position is meaningless.

**Decision: Richer tiers.json schema**
Tiers stored as objects with `id`, `label`, `description`, `movable`, and `system_behavior` fields rather than plain strings. Future scripts can branch on `movable` without parsing description text.

**Open questions for Step 2:**
- Which MCP connector do we wire first — Calendar or Gmail?
- How does the morning brief script receive the composed output? (stdout, Gmail draft, both?)
- How will the idea brain Google Doc be scoped / chunked for reading?
