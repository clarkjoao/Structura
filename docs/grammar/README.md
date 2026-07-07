# Structura — Grammar

The canonical vocabulary of the Structura modeling language.

## Start here

- **[glossary.md](glossary.md)** — every term the codebase uses, with
  definition, status (`current` / `proposed` / `deprecated`), counterpoint
  (terms that look similar but mean something different), and reference
  to the file/type where the concept lives.

## Why this folder exists

A modeling language is a vocabulary. If the same word means two things in
two files, the model rots quietly. The glossary is the place we draw the
line.

When you add a new concept:

1. Search the glossary first. If your concept already has a name, reuse it.
2. If it does not, propose a name in the PR that introduces the concept,
   **and** add the term to `glossary.md` with `Status: proposed`.
3. When the implementation lands, change the status to `current`.

When you rename something:

1. Open an OpenSpec change for the rename (forward-only migration if
   persisted data is affected).
2. In the same change, update `glossary.md`: mark the old term
   `deprecated` with the new term as the canonical name; mark the new
   term `current`.

When code and glossary disagree, the code wins — but the next PR must
either fix the code or fix the glossary. Both drifting apart is never
acceptable.
