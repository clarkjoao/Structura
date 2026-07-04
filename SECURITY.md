# Security Policy

## Supported versions

Structura is pre-1.0. Only the latest release (and `main`) receives security fixes.

## Reporting a vulnerability

Please **do not open a public issue** for security vulnerabilities.

Report privately via [GitHub Security Advisories](https://github.com/clarkjoao/Structura/security/advisories/new).
You should receive a response within 7 days.

## Scope notes

- Structura is a client-side application: all diagram data stays in your browser
  (localStorage or a local folder via the File System Access API). There is no
  hosted backend storing user data.
- LLM API keys entered in the app are stored locally in your browser and sent only
  to the provider you configure (or through the optional self-hosted proxy in `server/`).
- Plugins are **not sandboxed**: a plugin runs with full access to the page. Only
  install plugins you trust. Vulnerabilities that let a diagram file or shared link
  execute code without the user installing a plugin are in scope and high priority.
