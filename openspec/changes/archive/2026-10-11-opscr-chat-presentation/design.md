# Design

The registry keeps a version bumped on register, unregister and any context's `subscribe`
notification; `usePluginChatPresentation` reads it through `useSyncExternalStore` and re-asks
`findChatContext` / `presentation`. Suggestions become plain text in the empty state (built-in ones
are translated before they get there). Header: an untitled thread shows the plugin's title with its
subtitle below; a titled thread keeps its title with the plugin's title below.
