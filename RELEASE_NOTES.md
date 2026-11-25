# Slopfest 0.8.0 — Fold, cut, shuffle

Twenty-two browser experiments now live in the cabinet. This checkpoint opens
Turnleaf and Twigfall in the gallery and adds two terminal labs.

- **Turnleaf** folds a numbered paper strip left or right, tracks each panel's
  face and layer, replays fold words, and saves highlighted SVGs. The browser
  table starts flat and supports undo, panel lookup, and 1–64 panels.
- **Twigfall** is a branch-cutting game: cut a branch and everything above it
  falls. Play the deterministic gardener or pass turns with a friend. Custom
  groves, full-turn undo, optional winning hints, and SVG downloads are included.
- **Riffraff**, in the source archive, follows cards through perfect in/out
  shuffles, finds shortest card routes, computes exact cycle periods, and
  draws SVG card paths. Run `node riffraff/cli.mjs --help` with Node.js.
- **Coinwake**, in the source archive, calculates exact coin-pattern race odds,
  waiting times, and best counterpicks. Fixed-deadline forecasts include the
  probability of still racing and the expected tosses watched before stopping.
- **Starling** now compares normal and applicative evaluation orders, each
  with its own limits, traces, and JSON receipt. Lambda compilation works in
  both modes.

Extract `slopfest-site.zip` and serve its contents over HTTP.

```sh
python3 -m http.server --bind 127.0.0.1
```

Open the address printed by the server and choose an experiment from the
gallery. All browser assets use relative URLs and work locally. The ZIP
contains only 107 explicitly approved browser assets. Use the source archive
for project instructions, tests, and terminal tools, which require Node.js
20 or newer. The CUDA experiment lists its separate hardware requirements.

All 339 Node tests pass. Riffraff checks 4,064 shuffle words against physical
interleaving and routes all 45,760 supported card-to-position pairs. Coinwake
checks exact probabilities and 1,386 deadline forecasts against independent
enumeration. Twigfall checks all 2,056 small ordered groves and their reachable
positions against a game-tree oracle. Starling's new order matches an independent
redex selector on 15,764 terms.

DOM checks cover all 247 Turnleaf fold words and Twigfall's presets, both turn
modes, terminal moves, undo, invalid drafts, focus, bounds, and exact SVG
downloads. Exported diagrams were rendered and inspected. A browser surface
remains unavailable, so rendered page layouts for the new browser entries
have not been verified.
