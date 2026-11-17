# Rendezvous

An unknown machine is waiting in one of several states. You cannot see which
one. Can a sequence of button presses bring it to one known destination?

Rendezvous finds a **shortest reset word**, or proves that none exists. Play in
the browser without dependencies, or use the terminal lab with Node.js 20 or newer.

## Play the machine

Run `npm start` from the repository root and open
**http://localhost:4173/rendezvous/**. The gallery links here too.

Press **a** or **b** to move every possible state at once. Lit circles show which
states remain possible; the diagram follows each original starting path. The
goal is one remaining destination. **Undo** removes one press, and **Start over**
restores every possible beginning.

**Take a shortest hint** presses the first button of a shortest route from your
current set of possibilities. **Finish shortest route** completes that remaining
route. Manual detours are welcome: hints are recalculated after every press.
Once the paths meet, you can keep pressing buttons, undo, or start again.

Choose a three-, four-, or seven-state clock, or explore the carousel that can
never merge its states. **See what each button does** opens the transition table.
**Make your own machine** accepts the JSON format below. Invalid drafts preserve
the loaded machine and its trace. Applying a valid machine starts a fresh trace.

**Save SVG** downloads the current diagram. The diagram scrolls inside its panel;
long traces also wrap after twelve buttons. All controls use native buttons,
forms, and disclosure elements. The trace stops accepting presses at 1023 buttons;
undo or start over to continue. Everything stays in the current page, with no
accounts, storage, or network requests for machine data.

## Terminal lab

```sh
node rendezvous/cli.mjs --trace
node rendezvous/cli.mjs --states 7 --svg trace.svg
node rendezvous/cli.mjs --states 10 --json
node rendezvous/cli.mjs --word baaabaaab --trace
```

The default machine has four states, numbered 0 through 3. Button `a` moves
everyone one place clockwise. Button `b` moves state 3 to state 0 and leaves
the others alone. Pressing `b` repeatedly cannot finish the job: states 1 and 2
remain where they were. Turning the clock between gate presses makes them meet.

The default answer is `baaabaaab`, nine buttons:

```text
start    {0, 1, 2, 3}
b        {0, 1, 2}
a        {1, 2, 3}
a        {0, 2, 3}
a        {0, 1, 3}
b        {0, 1}
a        {1, 2}
a        {2, 3}
a        {0, 3}
b        {0}
```

For this clock-and-gate family, the exact search returns lengths 1, 4, 9, 16,
25, 36, 49, 64, and 81 for sizes 2 through 10. It computes each answer;
there is no stored solution or family-specific solver.

## Bring a machine

Write a JSON object whose keys are button names. Each array maps the state at
that index to its destination. For example, `{"a":[1,2,0],"b":[0,1,0]}` means
`a` cycles three states and `b` sends state 2 to state 0.

```sh
node rendezvous/cli.mjs --machine machine.json --trace
node rendezvous/cli.mjs --machine rendezvous/carousel.json
node rendezvous/cli.mjs --machine rendezvous/carousel.json --word abab --svg carousel.svg
```

The included carousel has only permutations: every button merely rearranges
the states, so no reset exists. A chosen word can still be followed and drawn.

Use 1–10 states and 1–4 buttons, each named with one lowercase letter. All
arrays must have the same length and contain integer destinations in range.
`--machine` and `--states` are alternatives. Words are case sensitive, contain
only known buttons, and have at most 1023 characters. An empty word (`--word ''`)
already resets a one-state machine.

SVG exports show a colored path for every possible starting state. Columns
are button presses, rows are state numbers, and white dots are the remaining
possible states. Paths merge when their destinations agree. Long words wrap
after twelve buttons; the boundary column is repeated. Terminal SVG writes refuse to
overwrite files. No generated image belongs in the source tree.

Exit status is 0 for a reset, 1 for invalid input or a failed file operation,
and 2 when no reset exists or the supplied word leaves multiple destinations.
JSON includes the transition table, word, search status, discovered-subset count,
and frames with both individual paths and deduplicated possible states.
In `--word` mode the status is `followed`, the count is `null`, and
`synchronized` states whether that particular word resets the machine.

## How it knows

The search begins with every state possible. Pressing a button maps that set to
another set. Breadth-first search visits each distinct nonempty set once and
stops at the first singleton. Thus the word is shortest; alphabetic button order
breaks ties. Exhausting the queue proves impossibility. A machine with ten
states has at most 1023 nonempty subsets, so the search is bounded.

`explored` counts discovered subsets, including the initial set and queued
sets not yet expanded when a solution is found. The search never assumes that
having fewer possibilities is always better: different sets can behave very
differently under the next button.

The source API exports `machine`, `clock`, `follow`, `synchronize`, and `toSVG`
from `core.mjs`. `machine` validates and copies a transition table into a frozen
object. Receipts are independent data objects; editing one does not affect
later runs. `synchronize(source, { states: [0, 3] })` searches from a chosen
nonempty subset. Supply distinct, in-range state numbers; its trace begins with
those states in ascending order. Omitting `states` keeps the all-states search.

## Verify

```sh
node --test rendezvous/test/*.test.mjs
npm test
```

Tests exhaust all 729 three-state machines with two buttons, compare exact words
against independent enumeration, and independently decide whether every pair of
states can meet. All 5103 nonempty starting subsets of those machines also match
word enumeration. Tests check all supported clock sizes, lexical tie breaking,
empty words, validation, trace paths, SVG wrapping, real CLI receipts, and
exclusive export writes. The browser and CLI share the same exact engine.
