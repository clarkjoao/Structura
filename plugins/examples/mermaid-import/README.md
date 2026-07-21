# Mermaid Import Plugin

**Capabilities:** `io:importers`

Imports Mermaid flowchart files into Structura diagrams.

## Supported Syntax

| Shape | Syntax | Rendered As |
|-------|--------|-------------|
| Rectangle | `A[Label]` | Standard node |
| Rounded | `B(Label)` | Rounded rectangle |
| Diamond | `C{Label}` | Decision/condition |
| Circle | `D((Label))` | Circle/node |

## Edges

- `A --> B` — Arrow
- `A --|text|--> B` — Arrow with label

## Features

- Imports `.mmd` and `.mermaid` files
- Reuses existing components by name (case-insensitive)
- Deduplication warnings shown after import

## Installation

1. Open Structura
2. Go to Plugins page
3. Click Install Plugin
4. Select this `plugin.js` file
5. Confirm

## Usage

1. Open a diagram
2. Click **Import** in the model explorer
3. Select "Mermaid (plugin)" from the format dropdown
4. Choose a `.mmd` or `.mermaid` file

## Source

See `examples/plugins/structura-plugin-mermaid-import.js` in the Structura repo for the annotated source.
