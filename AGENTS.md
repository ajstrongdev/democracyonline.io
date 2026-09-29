# Repository agent guidance

- Preserve existing local changes, especially `firebase-debug.log`.
- Never run browser mutation tests or schema-changing commands against production
  Firebase or a non-disposable database. E2E mutations belong on the isolated
  `oscana_e2e` database and `demo-oscana` Auth Emulator.
- Check before stopping or reseeding any already-running local stack.
- Do not commit or push review-only artifacts such as `TODO.md`,
  `docs/UI_REVIEW.md`, or `artifacts/ui-review/` unless explicitly requested.
- Use conventional commit messages when commits are requested.
