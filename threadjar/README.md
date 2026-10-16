# Threadjar

A pocket scheduler for a tiny concurrent language. Two workers each add a marble
to a shared jar. Depending on whose instruction runs next, the jar ends with one
marble or two. Add a shared key to protect the update, or cross two keys to find a
deadlock. Three editable experiments include an explorer and inspectable traces.

Run `npm start` at the repository root and open **http://localhost:4173/threadjar/**.
There are no dependencies, accounts, or browser-storage writes.

## Take a turn

Press **Step amber** or **Step blue** to run that worker's next instruction.
Its pocket is private; the jar is shared. For the first experiment, let both
workers `load jar` before either `store jar`. Both start from zero, and one update
overwrites the other. Running one worker to completion before the next produces
two marbles instead. **Deal next step** chooses an available worker at random.

**Undo** restores the previous turn, and **Reset run** restarts the applied
program. Finished and blocked workers cannot take a turn. In a deadlock, use Undo
or Reset to explore a different order. Edit the source and press **Apply edits**
to start a new program. Invalid or unapplied edits leave the previous run intact
and clearly labeled. On small screens the playground appears before the editor.

## Explore possible endings

**Explore all schedules** traverses the applied program's reachable states and
merges equivalent ones. Endings are grouped by finished/deadlock/fault, the shared
values, and any fault message. Each has one witness schedule. **Inspect trace**
loads that schedule into the playground; Undo then walks backward through its
individual turns. **Save trace JSON** downloads the applied source, chosen order,
and current outcome, including a partially completed run.

The default search stops at 12,000 states. If any new state cannot be admitted,
the result says it is incomplete; additional endings may exist. A complete search
covers every runnable instruction order under this language's rules. Waiting is
not a turn, and there are no loops, randomness inside instructions, or external
effects. This is a small explicit scheduling model; it does not emulate a CPU or
another programming language's memory model.

## The language

```text
shared jar = 0
mutex brass

thread amber
  lock brass
  load jar
  add 1
  store jar
  unlock brass
end
```

| Form | Meaning |
| --- | --- |
| `shared name = integer` | A shared numeric jar. |
| `mutex name` | A key initially held by nobody. |
| `thread name` … `end` | A worker with a private pocket initially zero. |
| `load name` | Copy a shared jar into the worker's pocket. |
| `add integer` | Add to the private pocket. |
| `store name` | Overwrite a shared jar with the pocket's value. |
| `lock name` | Take a free key; otherwise wait, including if already its owner. |
| `unlock name` | Return a key the worker holds; fault if it does not own it. |
| `# comment` | Ignore the rest of the line. |

Names use 1–16 lowercase letters, digits, or underscores and start with a letter.
There are at most three workers, four jars, four keys, and twelve instructions per
worker. Literal integers lie between -1,000,000 and 1,000,000. Source is limited to
12,000 characters. Empty workers, duplicate declarations, and undeclared names are
errors. Declarations may refer to names declared later in the file. A worker's
keys remain held when it finishes unless it explicitly returns them.

## Command line and verification

```sh
node threadjar/cli.mjs threadjar/examples/marbles.jar
node threadjar/cli.mjs threadjar/examples/marbles.jar --json
node --test threadjar/test/*.test.mjs
```

Exit status is 0 for a complete search, 1 for invalid input or a file error, and
2 if the search budget is reached. Finding a deadlock or a worker fault is a
successful analysis, not a command failure.

Tests replay every shipped outcome, reproduce the lost update, check locking and
faults, and compare state merging with all 1,680 unmerged schedules of a small
three-worker program. The interpreter never evaluates JavaScript from the editor.
