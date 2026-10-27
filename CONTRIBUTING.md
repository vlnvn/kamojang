# Contributing

Use Node 24.11.0 and `npm ci`; run `npm run dev`. Use a feature branch and a focused Conventional Commit (`feat`, `fix`, `test`, `docs`, `ci`, `chore`). Keep TypeScript strict, business logic in `src/domain.ts`, import validation in `src/import.ts` and presentation state separate from measurements. Do not add a second application scorer or hardcode real source outputs into the UI.

Before requesting review, run formatter, lint, typecheck, unit/Python tests, build and Playwright as listed in README. Add behavior tests for changed trust boundaries or user flows. Show actual synthetic screenshots for visual changes, document full Figma comparison separately, and report failures honestly.

Stage explicit paths. Inspect `git diff --cached --stat`, `git diff --cached`, and `npm run scan -- --staged` before committing. Run `npm run scan` and inspect the outgoing history before pushing. The scanner checks known patterns and prohibited paths; it cannot establish complete absence of secrets or determine data rights. Never force-push or attach research inputs, actual measurement exports, private Figma references or credentials. Do not invent coauthors or dates.

Use issues for reproducible problems with independently generated synthetic examples. A useful PR describes the trigger, behavior, validation evidence, visual differences, licenses and remaining gates. Keep PRs in draft while acceptance gates are unresolved. Do not self-invent required reviewers or bypass failing CI.
