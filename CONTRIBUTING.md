# Contributing

Small, dependency-free package on purpose. Ground rules:

- Node.js >= 18 (CI runs 22). No new runtime dependencies without a
  discussed issue first: the proxy is "no dependencies, no telemetry".
- `npm test` (plain `node --test`) must pass before opening a PR.
- One improvement per PR; describe what changed and how you checked it.
- Code is MIT (see LICENSE); by contributing you agree to that licence.

## Pull request rules

- GitHub is English-only: PR titles, descriptions, comments, review threads and commit messages. Product content (UI text, game or site copy) keeps its own language.
- Every PR needs: a clear title, what and why, how it was tested, risk and rollback, links to related issues or PRs, and screenshots when the UI changes.
- Do not mix languages in the same PR.
- One topic per PR: keep the change focused and small enough to review.
- No direct pushes to the default branch for shared work: open a PR and wait for review and green CI before merging.
