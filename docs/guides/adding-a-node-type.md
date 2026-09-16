# Guide: Adding a Node Type

Built-in types go through the **element registry**
([architecture/element-registry.md](../architecture/element-registry.md),
[ADR-0010](../adr/0010-element-registry.md)). Plugins still use
`NodeTypeDescriptor` + `registerDescriptor` on the canvas registry.

## Built-in / family (preferred)

1. **Descriptor:** implement `ElementDescriptor` under
   `src/features/elements/` (structural module or
   `families/<name>/`).
2. **Family packs:** prefer `CloudFamilyDefinition` + `registerCloudFamily`
   so categories, icons, cloud adapters, and LLM catalog stay one registration.
3. **Bootstrap:** import/register from `features/elements/bootstrap.ts`
   (idempotent).
4. **Do not** push built-ins onto `NODE_TYPE_REGISTRY`.
5. **i18n:** keys in both `en.json` and `pt-BR.json`.
6. **Icons:** vendor with an explicit license note beside the assets when
   bringing a third-party pack.
7. **Cloud service field:** persist `cloudServiceId`; read via
   `resolveCloudServiceId`. Do not overload business-catalog `serviceId`.
8. **Tests:** single-owner invariant covers registered ids; add family/export
   fixtures as needed.

## Plugin types

1. Implement `NodeTypeDescriptor` (see
   [node-types README](../../src/features/canvas/nodes/node-types/README.md)).
2. Call `registerDescriptor` from the plugin — that is what
   `NODE_TYPE_REGISTRY` is for now.
3. Use `NodeProps<Node<MyNodeData>>` with a **`type` alias** for node data.

## Surfaces checklist

- Palette / quick insert (usually derived from the registry)
- Inspector section if the type has editable fields
- Export mapping on the descriptor (`export.drawio`)
- LLM catalog (families / `search_elements` for cloud)

Unknown host types sanitize to `"unknown"` — see
[unknown-element-types.md](unknown-element-types.md).
