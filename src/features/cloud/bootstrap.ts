/**
 * Cloud provider adapters are no longer curated here.
 *
 * Catalog-shaped families register through `registerCloudFamily` in
 * `features/elements/bootstrap.ts`, which pushes a derived
 * `CloudProviderAdapter` into `cloudRegistry`. This module stays imported so
 * existing boot order / mental model ("cloud bootstraps") remains; it must
 * not hardcode aws/gcp/azure (or any future family).
 *
 * Kept as a side-effect entry so `main.tsx` can keep the import without
 * reintroducing a parallel provider list.
 */
export {};
