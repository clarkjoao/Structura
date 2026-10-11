# Design

The binding signature already holds the technology and catalog service each element was drawn with,
and snapshots carry both since API 1.10. `kindFor` maps a service back to (Kind, provider); a guess
for another Kind cannot be applied without changing the element's identity, so it is reverted rather
than silently turning an Application into a Database.
