# structura-plugin-observability

Test plugin for **Plugin API 1.17 + 1.18**: a new element pack and a panel drawn with
Structura's own components.

| Uses                                            | What it does                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `registerElementPack` (1.17, `canvas:elements`) | An **Observability** family — Metrics, Logs, Tracing — with Prometheus, Grafana, Loki, Jaeger and the OpenTelemetry Collector, offered in the element catalog, search and the assistant like the built-in AWS services. Original line icons (not vendor logos), accents for light and dark.                          |
| `registerShape` (1.17)                          | An **Alert rule** shape.                                                                                                                                                                                                                                                                                             |
| `@structura/ui` (1.18)                          | An inspector panel built only from host components (`Card`, `Tabs`, `Field`, `Select`, `Switch`, `Input`, `Badge`, `Button`, `Tooltip`, `Stack`, `Separator`): retention, alerting and on-call team for the selected element, stored as tags (`retention:90d`, `alerting`, `oncall:payments`) — one Apply, one undo. |

## Build and install

```bash
cd plugins/structura-plugin-observability
npm run build        # syncs the API types, then writes dist/plugin.js
```

Upload `dist/plugin.js` from the **Plugins** page. Like `structura-plugin-example-ui`, it builds
with the repository's root dependencies; React and the UI kit are host externals
(`vite.config.js`), so the bundle is ~7 KB.

The pack and the tag logic are covered by the host's
`src/features/plugins/observability-plugin.test.ts`.
