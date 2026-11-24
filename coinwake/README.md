# Coinwake

Which coin word arrives first? Everyone watches the same stream of independent
tosses. The first contestant whose complete pattern appears wins. Overlaps count:
the end of one partial match can already be the start of another.

Coinwake calculates exact winning probabilities and the expected tosses until
any contestant wins. It can also search every alternative word for the best
counterpick. All arithmetic uses BigInt fractions; the results are not simulations.
Use Node.js 20 or newer, with no dependencies, from the repository root:

```sh
node coinwake/cli.mjs
node coinwake/cli.mjs HHH THH --states
node coinwake/cli.mjs --counter HTH
node coinwake/cli.mjs HH HT TH TT --heads 2/3 --json
node coinwake/cli.mjs HHH HTH --by 12
```

## Read the wake

The default race is `HHH` against `HTH`, with a fair coin:

```text
HHH wins: 2/5
HTH wins: 3/5
Expected tosses until a winner: 34/5
```

An expected time can be fractional even though every actual game takes a whole
number of tosses. It is the average over all possible games, starting before
the first toss. It measures time until **either word wins**, not the waiting
time for a particular contestant on its own.

For `HHH` against `THH`, the probabilities are `1/8` and `7/8`, respectively,
and the expected race lasts seven tosses. The words have equal lengths and use
the same coin; how their prefixes and endings fit together makes the difference.

The contestants must be distinct and have the same length, so two words cannot
win on the same toss. Supply 2–4 words of 2–6 uppercase `H` and `T` letters.
The coin has a fixed, independent probability on every toss. `--heads 2/3`
means heads with probability two thirds and tails with probability one third.
The default is `1/2`.

Heads probabilities must be fractions strictly between zero and one, with a
denominator no greater than 32. Fractions are reduced automatically: `2/4`
becomes `1/2`. Decimal inputs, leading zeroes, deterministic coins, unequal
lengths, and duplicate contestants are rejected.

## Before the bell

Add `--by N` to forecast a race through a fixed deadline, from zero to 256 tosses.
The report keeps the eventual odds and adds each word's probability of winning
by the deadline, the probability that the race is still running, and the
expected number of tosses watched if you stop at that deadline.

```sh
node coinwake/cli.mjs HHH HTH --by 4
node coinwake/cli.mjs HHH THH --heads 2/3 --by 12 --json
node coinwake/cli.mjs HH HT TH TT --by 20 --states
```

For the default fair-coin race, by toss four:

```text
HHH wins by then: 3/16
HTH wins by then: 1/4
Still racing: 9/16
Expected tosses watched (stop at 4): 15/4
```

Winner probabilities and the still-racing probability sum to one. Every game
is counted from its start. Watching stops when a word first wins or the deadline
arrives, whichever happens first. If T is the winning toss, this observed time
is `min(T, N)`. Its expectation can be smaller than the open-ended waiting time.

At deadline zero nobody has won, all games are still racing, and zero tosses
have been watched. Before a word is long enough to finish, every game remains
unresolved. If all four two-letter words compete, every game finishes exactly
on toss two, so longer deadlines keep the same odds and observed time.

Deadline JSON adds a `byToss` field with `tosses`, `outcomes`, `unresolved`, and
`expectedObservedTosses`. All values remain exact fraction strings. The prefix
table from `--states` continues to describe the open-ended race. Use `--by` with
an ordinary race; to forecast a counterpick, supply the first word and its
chosen reply as the two contestants.

## Pick second

```sh
node coinwake/cli.mjs --counter HHH
node coinwake/cli.mjs --counter HT
node coinwake/cli.mjs --counter HTHTHT --heads 2/3 --json
```

For a fair coin, the best reply to `HHH` is `THH`, winning with probability
`7/8`. The best reply to `HTH` is `HHT`, winning with probability `2/3`.
Against `HT`, both `HH` and `TH` tie at `1/2`.

The search evaluates every other word of the same length, up to 63 alternatives.
It maximizes win probability and lists **all** tied best choices in alphabetic
order, with H before T. Expected times are reported for context and do not break
ties. The first pick and the counterpick watch the same stream; these are not
two separately tossed coins. A best counterpick is not a guarantee of winning.

Use `--counter` with one word, optionally adding `--heads` and `--json`.
Do not also supply positional contestants, `--states`, or `--by`.

## Follow the partial matches

`--states` prints the prefix state table. For the default race:

```text
Matched prefix | after H | after T | expected tosses remaining
empty | H | empty | 34/5
H     | HH | HT   | 24/5
HH    | win:HHH | HT | 16/5
HT    | win:HTH | empty | 22/5
```

The state remembers the longest suffix of the tosses so far that is also a
proper prefix of a contestant. After `HH` then tails, it keeps `HT`, which
could finish `HTH` on the next toss. It does not throw the partial match away.
An entire word ends the race immediately. No toss before the start is assumed.

The JSON receipt contains the patterns, reduced heads probability, root
outcomes, expected time, and every prefix state. Each state includes `H` and `T`
destinations, a probability for each contestant in input order, and its remaining
expected tosses. A probability can be zero in a partial state even though every
contestant has a positive chance from the start. The empty prefix is the string
`""`; the text table displays it as `empty`.

All probabilities and expectations are canonical fraction strings, with integers
written without `/1`. Counterpick JSON includes every candidate's pattern,
probability, and expected time, as well as the best choices. `--json` emits a
single complete receipt. Exit status is zero for valid analysis, or one for
invalid input. There are no implicit file writes, random seeds, or network calls.

## The small exact machine

Each proper prefix is a transient state. A toss moves to the longest matching
suffix or absorbs into a winner. With at most four six-letter contestants there
are at most 21 transient states. Every contestant can appear from the start,
and with both toss probabilities positive the race eventually ends with
probability one.

For each winner, solve its probability at every prefix: the value is the
weighted sum of the two next values. Absorbing states contribute one for their
winner and zero for the others. Waiting time satisfies the same equations with
one added for the next toss and zero remaining time at a winner. Exact
Gauss-Jordan elimination solves all of these right-hand columns together.

The source API exports `race(patterns, { heads })`,
`counterpick(first, { heads })`, and `byToss(receipt, deadline)` from `core.mjs`.
Race and counterpick use `1/2` by default. Inputs are copied and receipts,
state rows, and nested arrays are frozen. Pass an engine-created race receipt
to `byToss`; recreate serialized data with `race(patterns, { heads })` first.

Deadline forecasts propagate integer-weighted path counts through the prefix
machine. Absorbed winner counts retain their probability without adding any
further observed tosses. Surviving mass supplies the next watched toss. Counts
share a power of the coin denominator and are reduced only when reported.

## Verify

```sh
node --test coinwake/test/*.test.mjs
npm test
npm run build
```

Eight tests cover all 154 fair-coin pairs through length four. Exact state
certificates check the probability and waiting-time equations. An independent
integer-weighted enumerator tracks all trailing windows through 60 tosses and
bounds every predicted winner probability using the unabsorbed mass. Tests also
check biased and four-way races, six-letter limits, head/tail symmetry, contestant
reordering, counterpick ties, immutable receipts, invalid input, and real CLI
output. Five additional deadline tests compare every fair-coin pair through
length four at all deadlines 0–8 against complete-string enumeration: 1,386
forecasts. They also cover biased multi-way races, 256-toss exact arithmetic,
probability conservation, symmetry, boundary deadlines, immutable receipts,
and real CLI reports. This is a terminal experiment; the browser-only Pages
bundle excludes it.
