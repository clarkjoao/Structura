# Mutation harness

A test that passes without exercising anything is the failure mode this exists
to catch. The harness breaks one named thing in production code, runs the suite,
and records which tests noticed. A test no mutation can kill is decorative,
whatever its coverage number says.

## Running it

```sh
python3 tools/mutation/mutate.py <config.json> <out.json>
```

Nothing is left behind: each file is restored before the next mutation, whether
the run passed, failed, or was killed on the timeout. Put configs and results
outside the repo — they are working notes for one investigation, not artifacts.

Two environment variables:

- `MUT_TIMEOUT` — seconds to wait for one run before killing the process group.
  Default 240. A mutation that makes the code loop forever needs this: Vitest's
  own `testTimeout` does not interrupt a synchronous loop.
- `MUT_ROOT` — the repo to run in. Defaults to this file's repository.

## The config

```json
{
  "specs": ["src/features/diagram/utils/flow-sew.test.ts"],
  "mutations": [
    {
      "id": "S1",
      "file": "src/features/diagram/utils/flow-sew.ts",
      "desc": "the sew is neutralised: a removed step cuts the chain",
      "old": "      cursor = step.next;",
      "new": "      return undefined;"
    }
  ]
}
```

`old` is matched literally and must appear **exactly once** in the file — an
ambiguous pattern is reported rather than guessed at. Name each mutation for the
defect it introduces, not for the edit: the name is what ends up in the report.

Keep `specs` to the files that claim to cover the code being mutated. A mutation
killed only by some other suite tells you the test you were asking about is
redundant, not that it works.

## Reading the output

Every mutation lands in one of three verdicts. Two is the classic mistake, and
it inflates the kill count:

| Verdict    | What happened                                  | Counts as coverage |
| ---------- | ---------------------------------------------- | ------------------ |
| `KILLED`   | the suite ran and at least one test failed     | yes                |
| `SURVIVED` | the suite ran and everything passed            | no — a real gap    |
| `INVALID`  | the suite could not run the tests it ran clean | no — a broken edit |

`INVALID` covers three ways of not running: the mutated file does not compile,
the run produced no parseable report, or it produced a different number of tests
than the baseline. A run that hangs until `MUT_TIMEOUT` is `INVALID` too. None of
them is evidence a test noticed anything — nothing was observed, the suite just
never got there. Rewrite the mutation and try again.

Two more verdicts are bookkeeping: `PATTERN_MISSING` and `PATTERN_AMBIGUOUS` mean
the `old` text did not match exactly once, so nothing was applied.

The run ends with the inverse check — the tests that **no** mutation killed. That
list is the point of the exercise. Before trusting a name on it, ask whether you
wrote a mutation that could have killed it: an assertion of absence
(`expect(x).toEqual([])`) survives any mutation that produces absence, so it
needs a mutation that produces _presence_ to have teeth.

`<out.json>` carries the same thing per mutation, plus the exact list of test
names each one killed, so the inverse check can be recomputed without re-running.
