# Design

Polling, because the File System Access API has no change events in Chromium today (the
`FileSystemObserver` origin trial is not generally available). `stats()` reads `getFile()` metadata
only; the pane reads the text of files whose time or size moved. The plugin's own saves refresh the
known stats of the files it wrote, and a read whose text equals the buffer's disk text is ignored,
so saves never come back as outside changes.

Merge rules: clean → reload; dirty and equal → settle; dirty and different → conflict (buffer keeps
the user's text, the disk text waits); new → add; removed and clean → drop; removed and dirty → keep
to save again. The sidecar is machine-written: disk wins, then `sidecarMoves` moves bound elements
to its boxes before the sync rewrites it from the canvas.
