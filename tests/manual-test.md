# Step 1 Manual Test Checklist

Run through these checks to confirm the Step 1 foundation is complete.
Mark each item with [x] when verified.

---

## 1. Config files exist and parse as valid JSON

```bash
node -e "require('./config/routine.json')"
node -e "require('./config/prayer-roster.json')"
node -e "require('./config/bible-plan.json')"
node -e "require('./config/tiers.json')"
node -e "require('./config/flags.json')"
node -e "require('./state/idea-rotation.json')"
node -e "require('./state/reading-progress.json')"
```

- [ ] `config/routine.json` — exists, parses without error
- [ ] `config/prayer-roster.json` — exists, parses without error, contains 9 people
- [ ] `config/bible-plan.json` — exists, parses without error, contains 4 tracks
- [ ] `config/tiers.json` — exists, parses without error, contains 3 tiers
- [ ] `config/flags.json` — exists, parses without error, DRY_RUN is true
- [ ] `state/idea-rotation.json` — exists, parses without error
- [ ] `state/reading-progress.json` — exists, parses without error

## 2. TypeScript compiles without errors

```bash
npm install
npm run typecheck
```

- [ ] `npm install` completes with no errors
- [ ] `npm run typecheck` exits with no errors (note: no .ts files yet — this is expected to pass cleanly)

## 3. .gitignore is correct

- [ ] `node_modules/` is listed
- [ ] `.env` is listed
- [ ] Confirm `.env` does NOT appear in `git status` after running `npm install`

## 4. Repo pushes to origin/main successfully

```bash
git add .
git status   # verify .env is NOT staged
git commit -m "feat: Step 1 scaffolding — config, state, and project setup"
git push origin main
```

- [ ] `.env` is absent from staged files
- [ ] Push succeeds with no errors

## 5. BUILD_LOG.md has at least one entry

- [ ] `BUILD_LOG.md` exists and contains a dated entry

## 6. README.md describes the project

- [ ] `README.md` exists and gives a reader enough context to understand what this repo is

---

All six checks passing = Step 1 complete. Proceed to Step 2.
