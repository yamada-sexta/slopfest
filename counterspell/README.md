# Counterspell

A tiny reversible language: four byte registers, nothing lost. Mix the bytes with
addition, XOR, rotation, swapping, and odd multiplication. Run backward to recover
the exact starting state, or print an executable inverse spell. Repeats expand at
compile time; no instruction evaluates source as JavaScript.

This experiment runs from the terminal, using Node.js 20 or newer. No dependency
installation, accounts, services, or generated files are needed.

## Cast a spell

From the repository root:

```sh
node counterspell/cli.mjs counterspell/examples/mixer.spell --state 12,34,56,78 --trace
```

The 18-operation mixer ends at **155,224,97,192**. Now uncast it:

```sh
node counterspell/cli.mjs counterspell/examples/mixer.spell --state 155,224,97,192 --reverse
```

The result is **12,34,56,78**. Values wrap at 256: adding one to 255 produces zero,
and subtracting one from zero produces 255. All arithmetic is exact on bytes.

`--state` accepts four comma-separated decimal bytes in register order a,b,c,d;
it defaults to `0,0,0,0`. `--trace` prints the initial state and every operation's
result. `--json` emits structured output, including snapshots when tracing.
Errors go to stderr and exit with status 1; successful runs and help exit with 0.
Flags may precede or follow the source file. `--help` shows all options.

Print an inverse as ordinary source, with repeats unrolled:

```sh
node counterspell/cli.mjs counterspell/examples/mixer.spell --inverse
```

`--inverse` cannot be combined with execution options. To keep an inverse locally,
redirect it into an ignored scratch directory:

```sh
mkdir -p .local
node counterspell/cli.mjs counterspell/examples/mixer.spell --inverse > .local/unmix.spell
node counterspell/cli.mjs .local/unmix.spell --state 155,224,97,192
```

The other examples are **carousel.spell**, which moves each byte to the next seat
(four runs restore the seating), and **borrowed-key.spell**, which changes a using b
and returns b exactly as it was.

## The language

```text
# A three-round mixer
repeat 3
  add a b
  rol a 3
  xor c a
  swap b d
  mul d 13
  sub b c
end
```

| Form | Effect | Inverse |
| --- | --- | --- |
| `add a 7` / `add a b` | Add a literal or another register to a. | `sub` with the same operands. |
| `sub a 7` / `sub a b` | Subtract a literal or another register from a. | `add` with the same operands. |
| `xor a 7` / `xor a b` | XOR a literal or another register into a. | The same operation. |
| `mul a 13` | Multiply a by an odd literal, modulo 256. | Multiply by its modular inverse (197 for 13). |
| `rol a 3` / `ror a 3` | Rotate a's eight bits left/right. | Rotate the other way by the same amount. |
| `not a` | Complement a's eight bits. | The same operation. |
| `swap a b` | Exchange two registers. | The same operation. |
| `repeat N` … `end` | Expand the block N times in order. | Reverse the expanded operation order. |
| `# comment` | Ignore the rest of a line. | No operation. |

Targets may be **a, b, c, or d**. A register source must differ from its target.
Multiplication takes an **odd literal** only: 0, 2, 4, … collapse distinct bytes
onto the same result. Rotations accept 0–7 bits. Literals accept canonical decimal
0–255, without signs or leading zeros. Use `sub` for subtraction. Input is
case-sensitive; spaces and tabs separate words. One instruction per line.

Repeat counts are 1–32, with at most four nested repeats. Every block must contain
an instruction. A spell expands to 1–4,096 instructions. The parser accepts at most
16,000 characters; the CLI also checks a 16,000-byte file limit before reading it.
Errors include source line numbers. There are no assignments, copies, branches,
external effects, or hidden stack values: reversing needs only the final four
bytes and the spell. Inverse execution reverses instruction order, so a borrowed
source register has its old value again when needed.

## Use the engine

```js
import { parse, run, invert, format } from './counterspell/core.mjs';
const spell = parse('add a b\nrol a 3\nxor c a');
const mixed = run(spell, [12, 34, 56, 78]);
const restored = run(spell, mixed.values, { reverse: true });
const inverseSource = invert(spell).map(format).join('\n');
```

States and returned trace snapshots are independent arrays; running and inverting
leave their inputs unchanged. `apply(values, instruction)` computes one step.
Malformed compiled instructions are rejected too, including even multipliers.

## Verification

```sh
node --test counterspell/test/*.test.mjs
```

Tests exhaust every literal arithmetic mapping and odd multiplication over all
256 bytes, every source/target byte pair for register arithmetic, all rotations,
and all swapped pairs. They check exact arithmetic, inverse source, nested repeat
order and limits, independent intermediate snapshots, all examples, and the real
CLI's JSON, trace, inverse-file execution, help, error status, and file size bound.
