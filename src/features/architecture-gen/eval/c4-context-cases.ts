/**
 * C4 Context reference cases — slice 1.
 *
 * These are the diagrams the skill has to produce well. Each is written the way a competent
 * architect would express the request in IR, and the suite asserts the engine turns each one
 * into a diagram with no errors and a bounded number of warnings.
 *
 * They are reference *outputs*, not prompts: they pin what "good" looks like for a context
 * diagram so a later change to the engine or the constants cannot quietly degrade it.
 */

import type { ArchitectureIr } from "../ir";

export interface ContextCase {
  id: string;
  /** What the user would type. */
  request: string;
  /** What makes this case worth having. */
  covers: string;
  ir: ArchitectureIr;
}

export const C4_CONTEXT_CASES: ContextCase[] = [
  {
    id: "minimal",
    request: "Draw a C4 context diagram: a customer using our booking system.",
    covers: "The smallest useful diagram — one actor, one system, one relationship.",
    ir: {
      schema_version: 1,
      diagram_kind: "c4-context",
      meta: {
        title: "Booking — system context",
        primary_path: ["customer", "booking"],
        density_hint: "simple",
      },
      nodes: [
        {
          id: "customer",
          type: "person",
          name: "Customer",
          tier: "external",
          description: "Books and manages reservations",
        },
        {
          id: "booking",
          type: "system",
          name: "Booking System",
          tier: "application",
          description: "Availability, reservations and cancellations",
        },
      ],
      connections: [{ id: "c1", from: "customer", to: "booking", intent: "call", label: "Books" }],
    },
  },

  {
    id: "third-party-integrations",
    request:
      "C4 context for our e-commerce platform. Customers browse and order, we charge via " +
      "Stripe and send receipts through SendGrid.",
    covers: "External systems the team does not own, sharing the external tier with an actor.",
    ir: {
      schema_version: 1,
      diagram_kind: "c4-context",
      meta: {
        title: "E-commerce — system context",
        primary_path: ["customer", "shop"],
        density_hint: "simple",
      },
      nodes: [
        {
          id: "customer",
          type: "person",
          name: "Customer",
          tier: "external",
          description: "Browses the catalogue and places orders",
        },
        {
          id: "shop",
          type: "system",
          name: "E-commerce Platform",
          tier: "application",
          description: "Catalogue, cart and order management",
        },
        {
          id: "stripe",
          type: "system",
          name: "Stripe",
          tier: "external",
          description: "Card payments",
        },
        {
          id: "sendgrid",
          type: "system",
          name: "SendGrid",
          tier: "external",
          description: "Transactional email",
        },
      ],
      connections: [
        { id: "c1", from: "customer", to: "shop", intent: "call", label: "Orders" },
        { id: "c2", from: "shop", to: "stripe", intent: "call", label: "Charges" },
        { id: "c3", from: "shop", to: "sendgrid", intent: "async-message", label: "Emails" },
      ],
    },
  },

  {
    id: "multiple-actors",
    request:
      "Context diagram for our support desk: customers raise tickets, agents answer them, " +
      "and managers read the reports.",
    covers: "Several human roles against one system — the actors must not stack or collide.",
    ir: {
      schema_version: 1,
      diagram_kind: "c4-context",
      meta: {
        title: "Support desk — system context",
        primary_path: ["customer", "desk"],
        density_hint: "simple",
      },
      nodes: [
        {
          id: "customer",
          type: "person",
          name: "Customer",
          tier: "external",
          description: "Raises support tickets",
        },
        {
          id: "agent",
          type: "person",
          name: "Support Agent",
          tier: "external",
          description: "Answers tickets",
        },
        {
          id: "manager",
          type: "person",
          name: "Support Manager",
          tier: "external",
          description: "Reviews queue health",
        },
        {
          id: "desk",
          type: "system",
          name: "Support Desk",
          tier: "application",
          description: "Ticketing, routing and reporting",
        },
      ],
      connections: [
        { id: "c1", from: "customer", to: "desk", intent: "call", label: "Raises" },
        { id: "c2", from: "agent", to: "desk", intent: "call", label: "Answers" },
        { id: "c3", from: "manager", to: "desk", intent: "call", label: "Reports" },
      ],
    },
  },

  {
    id: "with-cross-cutting",
    request:
      "C4 context for the payments platform. It talks to the card network and the ledger, " +
      "and everything is behind our SSO and monitored by Datadog.",
    covers: "The cross-cutting band, kept out of the main flow and given an incoming edge.",
    ir: {
      schema_version: 1,
      diagram_kind: "c4-context",
      meta: {
        title: "Payments — system context",
        primary_path: ["merchant", "payments"],
        density_hint: "medium",
      },
      nodes: [
        {
          id: "merchant",
          type: "person",
          name: "Merchant",
          tier: "external",
          description: "Takes payments from customers",
        },
        {
          id: "payments",
          type: "system",
          name: "Payments Platform",
          tier: "application",
          description: "Authorisation, capture and settlement",
        },
        {
          id: "network",
          type: "system",
          name: "Card Network",
          tier: "external",
          description: "Visa and Mastercard rails",
        },
        {
          id: "ledger",
          type: "system",
          name: "Ledger",
          tier: "external",
          description: "Double-entry accounting system of record",
        },
        {
          id: "sso",
          type: "system",
          name: "SSO",
          tier: "cross-cutting",
          description: "Workforce identity",
        },
        {
          id: "datadog",
          type: "system",
          name: "Datadog",
          tier: "cross-cutting",
          description: "Metrics, traces and alerting",
        },
      ],
      connections: [
        { id: "c1", from: "merchant", to: "payments", intent: "call", label: "Charges" },
        { id: "c2", from: "payments", to: "network", intent: "call", label: "Authorises" },
        { id: "c3", from: "payments", to: "ledger", intent: "async-message", label: "Posts" },
        // Cross-cutting services carry one representative edge each, so a reader can tell
        // what uses them without every service being wired to them.
        { id: "c4", from: "payments", to: "sso", intent: "dependency" },
        { id: "c5", from: "payments", to: "datadog", intent: "dependency" },
      ],
    },
  },

  {
    id: "at-the-composition-limit",
    request:
      "Context diagram for our logistics platform and everything it touches: shippers, " +
      "drivers, dispatchers, the carrier API, customs, the warehouse system, billing and " +
      "the tracking portal.",
    covers:
      "A busy but still legible context — near the twelve-element guidance, with one hub " +
      "system and many peers.",
    ir: {
      schema_version: 1,
      diagram_kind: "c4-context",
      meta: {
        title: "Logistics — system context",
        primary_path: ["shipper", "logistics"],
        density_hint: "complex",
      },
      nodes: [
        { id: "shipper", type: "person", name: "Shipper", tier: "external" },
        { id: "driver", type: "person", name: "Driver", tier: "external" },
        { id: "dispatcher", type: "person", name: "Dispatcher", tier: "external" },
        {
          id: "logistics",
          type: "system",
          name: "Logistics Platform",
          tier: "application",
          description: "Planning, dispatch and tracking",
        },
        { id: "carrier", type: "system", name: "Carrier API", tier: "external" },
        { id: "customs", type: "system", name: "Customs Service", tier: "external" },
        { id: "warehouse", type: "system", name: "Warehouse System", tier: "external" },
        { id: "billing", type: "system", name: "Billing", tier: "external" },
        // A tracking portal is part of the platform, not a peer system, so at context
        // level it is an external consumer of the feed rather than a "client" column.
        { id: "portal", type: "system", name: "Tracking Portal", tier: "external" },
      ],
      connections: [
        { id: "c1", from: "shipper", to: "logistics", intent: "call", label: "Books" },
        { id: "c2", from: "driver", to: "logistics", intent: "call", label: "Updates" },
        { id: "c3", from: "dispatcher", to: "logistics", intent: "call", label: "Plans" },
        { id: "c4", from: "logistics", to: "carrier", intent: "call", label: "Ships" },
        { id: "c5", from: "logistics", to: "customs", intent: "call", label: "Declares" },
        { id: "c6", from: "logistics", to: "warehouse", intent: "call", label: "Picks" },
        { id: "c7", from: "logistics", to: "billing", intent: "async-message", label: "Invoices" },
        { id: "c8", from: "logistics", to: "portal", intent: "data-flow", label: "Feeds" },
      ],
    },
  },
];
