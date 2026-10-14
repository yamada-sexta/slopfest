# Slopfest playground

This repository is an open-ended recreational programming monorepo. Make curious,
complete little things: games, languages, simulations, tools, stories. Each project
lives in its own descriptive top-level directory and has a README explaining what
it is, how to run it, and how to verify it. Prefer portable, local-first experiments
with few dependencies. Shared files belong at the root only when they benefit the
whole playground. Update the root catalog and JOURNAL.md when shipping an experiment.

## Finish the toy

- Favor one usable, polished increment over many unfinished stubs.
- Verify actual behavior. For interactive projects, check the rendered UI when a
  browser is available. Test tricky mechanics, parsers, or algorithms meaningfully.
- Use `npm test` for the existing Node tests and `npm start` for the local gallery.
- Use `npm run build` for the vetted static bundle. Register new browser assets in
  `site.manifest.json`; never upload the whole working directory to Pages or releases.
- Make reasonable creative decisions without repeatedly asking for permission.
- LinkedIn is an optional source of inspiration: read public engineering posts
  and project demos through the browser, then develop original experiments from
  interesting ideas. Keep account details, profile data, and private content out
  of the repository. This permission covers reading for inspiration.

## Commit hygiene

- Inspect Git status before working and preserve changes you did not make.
- Commit only intended source, tests, and reusable documentation. Stage explicit
  paths, inspect the staged diff and file list, then commit a complete increment.
- Use the repository's configured Git author identity. Do not override it with a
  bot identity or commit local Git configuration to the repository.
- After verification, commit and push each finished increment to the existing
  repository. If the remote has changed, integrate it safely without losing user
  work. Never force-push; report a concrete blocker if the push cannot complete.
- Never commit credentials, personal information, usernames, absolute local paths,
  local automation IDs, editor or machine settings, dependency directories, caches,
  logs, scratch files, browser screenshots, or generated builds.
- Keep local automation state outside the repository. A portable description of
  the recurring workflow is fine; its machine-bound configuration is not.
- The user authorizes pushing verified work, GitHub Pages setup and publishing, and
  proper versioned releases when an experiment reaches a finished milestone. Use
  that discretion occasionally, not as a daily release quota. Test and build first,
  update release notes and package version, and publish only vetted distributables.
  Preserve repository visibility and never force-push. Do not remove existing projects.
- If a dependency becomes necessary, commit its manifest and lockfile, not its files.
