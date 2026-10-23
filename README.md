# Slopfest

A cabinet of small, curious programs. Each directory is its own experiment.
Nothing here needs an account, an API key, or a dependency install.

Run `npm start` with Node.js 20 or newer, then open **http://localhost:4173**.
Run `npm test` to check the puzzle engine, the languages, the reversible ink rules,
the scheduler explorer, the rhythm and WAV engine, the light-routing puzzles,
the wave tank, the loop tracer, the reversible byte language, the local server,
and the release builder.
You can also use
`python3 -m http.server 4173 --bind 127.0.0.1`.

| Project | What lives inside |
| --- | --- |
| [Afterimage](afterimage/) | A puzzle game about borrowing help from your past. Five rooms, three ghosts, and a guided first rewind. |
| [Sprig](sprig/) | A tiny rewrite language that grows vector drawings. A live editor, five specimens, and an SVG command line tool. |
| [Unspill](unspill/) | A reversible ink machine. Scatter a picture, paint a new one, then recover every pixel by running time backward. |
| [Threadjar](threadjar/) | A tiny concurrency language and scheduler. Choose a worker's next turn, find missing marbles, and explore every possible ending. |
| [Orbitone](orbitone/) | Three rhythm rings with different lengths. Place pulses by hand, share arrangements as links, and save eight bars as a stereo WAV. |
| [Lumenpost](lumenpost/) | A mirror puzzle about delivering light to postage stamps. Five postcards, two lamps, undo, and hints that find a shortest route. |
| [Ripplefax](ripplefax/) | A wave tank for ripples, barriers, slits, and interference. Three scenes, keyboard painting, opposite sources, and PNG export. |
| [Looploom](looploom/) | A tile loom of closed threads. Turn corners to merge or split loops, walk them stitch by stitch across seams, and save the cloth as SVG. |
| [Counterspell](counterspell/) | A terminal language for reversible byte spells. Trace four registers, generate an inverse program, and recover every starting byte. Node.js required. |

## A living playground

The recurring evening session is configured in the desktop app, outside Git. Its
brief: build or improve one complete experiment, verify it, update this catalog and
the [journal](JOURNAL.md), commit the relevant files, and push verified work. It can
also publish to GitHub Pages and make versioned releases at meaningful milestones.
See [AGENTS.md](AGENTS.md) for the portable creative brief and commit rules.

New experiments get their own top-level folder and README. Machine settings,
credentials, scratch work, generated exports, and dependencies stay out of Git.

## Build, Pages, and releases

`npm run build` copies only the browser assets explicitly listed in
`site.manifest.json` into ignored `dist/`. Add a new project's browser assets to
that list when it joins the gallery. Relative URLs support both root hosting and
GitHub Pages project paths. The builder rejects hidden paths and symlinks.

Every push to `main` and every pull request runs the tests and builds the cabinet.
For Pages, select **GitHub Actions** as the repository's Pages source, then set the
repository Actions variable **PAGES_ENABLED** to `true`. The workflow deploys only
verified `main` builds. Private repositories need a plan that supports Pages; see
[GitHub's Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

For a finished milestone, update the package version, `RELEASE_NOTES.md`, and the
journal. Commit the verified source, then push a matching version tag such as
`v0.1.0`. The release workflow tests and builds again, packages just the browser
assets, and publishes a GitHub release. Release notes and source stay in Git;
generated archives stay in the release, outside the repository.
