# Structura Roadmap

This document reflects the current direction of Structura. Items are subject to change based on community feedback and maintainer priorities.

> Want to influence the roadmap? Open a [feature request](https://github.com/clarkjoao/Structura/issues/new?template=feature_request.yml) or upvote existing ones.

---

## ✅ Completed

- C4 Model levels (Context, Container, Component) with drill-down navigation
- AWS Services catalog (80+ service types)
- Flow recording, step-by-step playback, and Mermaid sequence diagram export
- Full undo/redo history stack per diagram
- Export: JSON, draw.io XML, Mermaid
- Folder organization for diagram dashboard
- Dark/Light theme
- Pattern library (reusable component panels)
- Grid Tidy Up layout (`computeGridLayout`)
- Auto Layout Left→Right (`computeLayeredLayout`)
- LLM integration (AI-assisted diagramming)
- Atomic filesystem writes via File System Access API
- Fine-grained Zustand selectors for performance with 300+ nodes

---

## 🚧 In Progress

### Performance

- [ ] Complete `useCanvasNodes.ts` fine-grained selector refactor
- [ ] Remove `structuredClone` from the hot undo/redo path in `history.slice.ts`
- [ ] Trailing throttle on resize layout commits

### Persistence Hardening

- [ ] Phase 2: Broken architectural contracts (store bypasses, missing `defaultStorage` calls)
- [ ] Phase 3: Incomplete undo/redo across scenes, flows, services, folders, and edge layouts
- [ ] Phase 4: Sensitive data exposure audit, low-risk edge cases

---

## 📋 Planned

### Workspace & Organization

- [ ] Workspace-level organization for products with many diagrams
- [ ] Diagram search and filtering

### Diagramming

- [ ] Alignment tools (snap to grid, distribute, align edges) — coordinate space fix implemented, pending validation
- [ ] Structurizr DSL import/export
- [ ] Code-level (C4 Level 4) diagram support

### Developer Experience

- [ ] Increase unit test coverage to 80%+
- [ ] E2E test coverage for critical flows (undo/redo, persistence, drag-to-parent)
- [ ] Storybook for component library

### Collaboration _(experimental)_

- [ ] Real-time collaboration via Yjs/WebRTC

---

## Versioning

Structura follows [Semantic Versioning](https://semver.org/). Breaking changes to the diagram JSON format will be documented with a migration guide.

---

_Last updated: May 2026_
