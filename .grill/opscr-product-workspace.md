# Grill: opscr product workspace (AS-IS + initiatives, linked repos, C1/C2/Deployment)
Date: 2026-10-24

Full design brief: `docs/concepts/opscr-product-workspace.md`.

## Intent
An architect owning one product (4 squads, multirepo) needs the YAML to be a trusted AS-IS source
of truth, see planned vs deployed in Structura, link elements to repos/docs, and work through two
equal channels (Structura web, Claude Code/VSCode). The LLM writes the YAML. Far future: YAML as
the recipe for Terraform modules.

## Constraints
- Architect is the only author (via LLM); squads do not write YAML.
- Architecture lives in a documentation git repo, separate from service repos and the Terraform repo.
- Keeping the YAML current is handled by other processes — out of scope.
- Every convention must be checkable by `opscr compile`, so the LLM is told when it errs.
- opscr vocabulary stays OSS-neutral.

## Key decisions
- Decision: one repo = one product; flat root = AS-IS (production only). Reason: map only what the architect owns. Alternative: global AS-IS for all products (rejected: products are isolated, talk via Kafka topics and API gateways).
- Decision: `initiatives/<name>/` is the only folder with meaning; no other folders. Reason: one source of truth (`belongsTo`), safe reorganisation. Alternative: domain folders (rejected).
- Decision: neighbouring products = `ExternalSystem` with what we use as children; external by Kind. Contracts later. Reason: show roles now, Terraform treats them as data sources later.
- Decision: `metadata.links.{repository,docs}` on every Kind, optional. Reason: moonshots have no repo.
- Decision: lifecycle belongs to the `Initiative` (proposed/approved/in-progress/done), not the element. Reason: keeps the root pure AS-IS. Alternative: per-element lifecycle with planned items in the root (rejected).
- Decision: initiative delta = ordinary manifests; element replaces by `Kind/name`, edges add up, removal = retired stub. Reason: no patch syntax for the LLM. Alternative: JSON-patch style (rejected); whole-file replace for Relationships (rejected: stale copies erase root edges).
- Decision: live overlay + `initiative.lock` base hashes; compile warns, promote blocks on conflict. Reason: git merge-base equivalent for copy-on-write.
- Decision: promote whole initiatives only. Reason: simplicity; 1–2 sprints of lag accepted. Alternative: partial promote (deferred).
- Decision: three diagrams per product — C1 SystemContext, C2 Container (logical, no technology), Deployment (physical, production only) — by rule, no include lists; initiatives show in all three. Reason: three audiences (business, area manager, squads/architect).
- Decision: new edge `realizes` for the C2 → Deployment 1:N link. C2 edges are declared; edges lifted from Deployment are a drift check. Reason: moonshots need C2 before infra.
- Decision: Structura Versions (no users today) refactored as logical git branches, generic, with `modified`, status, base hash, merge; plugin owns them for opscr diagrams via a new API; copy-on-write edits from the canvas. Reason: two channels with the same power. Alternative: read-only canvas in initiative mode (rejected by user); opscr-only Versions (rejected: breaks plugin architecture).
- Decision: build order 1 (schemas) + 2 (overlay core/CLI) + 6 (skill) first, then 3 (Views), then 4 + 5 (Versions + pane).

## Surfaced assumptions
- "AS-IS/deployed" hid two states (building, being decommissioned); resolved by putting planned work only in initiatives.
- "Branch" here is a live overlay, not a frozen fork — root changes reach initiatives with no rebase.
- The View schema is already rule-based by level (`scope`, `include`/`exclude`); an earlier claim that it needs explicit include lists was wrong.

## Open questions
- Initiative-vs-initiative conflict handling (warning proposed, not confirmed).
- Exact removal stub field.
- `Product` spec fields and its role as View `scope`.
- Physical-by-nature Kinds vs logical; where `Application.spec.provider` lives.
- Global `Kind/name` collisions with neighbouring products.
- `opscr promote` on a dirty git tree.
- Initiatives in the VSCode preview.
- Terraform field needs (far future).

## Out of scope
- Contracts in external elements; partial promote; whole-company mapping; environment variants;
  keeping YAML current; chat in VSCode; Terraform generation.
