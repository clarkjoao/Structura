# Tasks

## 1. Host

- [x] 1.1 `PluginVersionAction` `status`; Versions panel shows the status select for owned Versions and routes it; sync types; verify tests

## 2. Plugin

- [x] 2.1 Status action sets the Initiative's `spec.status`
- [x] 2.2 Promote preview (diff, files, refusal reasons, "Mark as done"); Merge from the Versions panel opens it; Confirm applies, Cancel drops
- [x] 2.3 Pane list trimmed to title, status label, lock issues / Accept root, Promote…; i18n

## 3. Verify

- [x] 3.1 e2e: status from the Versions panel reaches the file; Merge opens the preview, Cancel writes nothing, Confirm promotes; typecheck, lint, tests
