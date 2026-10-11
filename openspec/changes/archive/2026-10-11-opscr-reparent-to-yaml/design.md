# Design

The binding's identity signature already records each element's parent key. Reconcile compares it
with the key bound to the canvas parent; a difference is a move. Only the first `belongsTo` of the
element is touched: it is the one the technical view follows. An ApplicationService that belonged to
a Subdomain and is moved to another Domain therefore belongs to that Domain directly afterwards —
the DDD pack reports it if a Subdomain is expected, and the user picks one in the text.
