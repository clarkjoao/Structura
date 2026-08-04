/**
 * Runtime smoke for the IR generation pipeline (Fatia 1).
 *
 * Drives the real chat panel with a stubbed OpenAI-compatible endpoint so the
 * whole path runs for real: prompt -> IR -> validator -> ELK -> React Flow.
 * The only thing faked is the model's answer.
 */
const DIAGRAM_STORE_LOCAL_STORAGE_KEY = "structura_diagram-store";
const LLM_CONNECTIONS_KEY = "structura:llm:connections";
const I18N_KEY = "structura_language";
const STUB_ENDPOINT = "https://stub.invalid/v1/chat/completions";

const DIAGRAM_ID = "diag_ir_smoke";

/** vpc > az > private subnet > {alb, ecs, rds}: three levels of containment. */
const NESTED_IR = {
  type: "aws-deployment",
  nodes: [
    { id: "customer", semanticType: "person", name: "Customer", parentId: null, tier: "external" },
    {
      id: "prod-vpc",
      semanticType: "aws-vpc",
      name: "Production VPC",
      parentId: null,
      tier: "edge",
    },
    {
      id: "az-a",
      semanticType: "aws-az",
      name: "AZ us-east-1a",
      parentId: "prod-vpc",
      tier: "compute",
    },
    {
      id: "private-subnet",
      semanticType: "aws-private-subnet",
      name: "Private Subnet",
      parentId: "az-a",
      tier: "compute",
    },
    {
      id: "app-alb",
      semanticType: "aws-networking",
      name: "Application Load Balancer",
      parentId: "private-subnet",
      tier: "edge",
    },
    {
      id: "orders-service",
      semanticType: "aws-compute",
      name: "Orders Service",
      technology: "ECS Fargate",
      parentId: "private-subnet",
      tier: "compute",
    },
    {
      id: "orders-db",
      semanticType: "aws-database",
      name: "Orders Database",
      technology: "Aurora PostgreSQL",
      parentId: "private-subnet",
      tier: "data",
    },
  ],
  edges: [
    { id: "customer-to-alb", sourceId: "customer", targetId: "app-alb", label: "HTTPS" },
    { id: "alb-to-service", sourceId: "app-alb", targetId: "orders-service", label: "routes" },
    {
      id: "service-to-db",
      sourceId: "orders-service",
      targetId: "orders-db",
      label: "reads/writes",
    },
  ],
};

function sseBody(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n` + "data: [DONE]\n\n";
}

function emptyDiagramPayload(): string {
  const diagram = {
    id: DIAGRAM_ID,
    name: "IR Smoke",
    domain: "",
    level: "container",
    description: "",
    snapshot: { components: {}, connections: {}, flows: {}, iconLibrary: {} },
    nodeLayouts: {},
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    scenes: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return JSON.stringify({
    state: {
      diagrams: { [DIAGRAM_ID]: diagram },
      folders: {},
      userTemplates: {},
      serviceRegistry: {},
      activeDiagramId: DIAGRAM_ID,
      past: [],
      future: [],
      _lastUndoRedoAt: 0,
    },
    version: 11,
  });
}

function connectionsPayload(): string {
  return JSON.stringify({
    connections: [
      {
        id: "conn_stub",
        name: "Stub",
        mode: "direct",
        provider: "custom",
        baseUrl: STUB_ENDPOINT,
        apiKey: "stub-key",
        model: "stub-model",
      },
    ],
    activeConnectionId: "conn_stub",
  });
}

function visitWorkspace(errors: string[]): void {
  cy.visit(`/model/${DIAGRAM_ID}`, {
    onBeforeLoad(win) {
      win.localStorage.setItem(DIAGRAM_STORE_LOCAL_STORAGE_KEY, emptyDiagramPayload());
      win.localStorage.setItem(LLM_CONNECTIONS_KEY, connectionsPayload());
      win.localStorage.setItem(I18N_KEY, "en");
      cy.stub(win.console, "error").callsFake((...args: unknown[]) => {
        errors.push(args.map(String).join(" "));
      });
    },
  });
  cy.get(".react-flow__viewport", { timeout: 60000 }).should("exist");
}

function openChat(): void {
  cy.get('button[aria-label="Open chat assistant"]', { timeout: 20000 }).click();
  cy.contains("h3", "Diagram Assistant", { timeout: 20000 }).should("exist");
}

function sendPrompt(text: string): void {
  cy.get('div[contenteditable="true"]').first().click().type(text, { delay: 0 });
  cy.contains("button", "Send").click();
}

/** Bounding box of the node whose rendered text contains `label`. */
function nodeRect(label: string): Cypress.Chainable<DOMRect> {
  return cy
    .contains(".react-flow__node", label, { timeout: 30000 })
    .then(($el) => $el[0].getBoundingClientRect());
}

describe("IR generation — valid IR reaches the canvas", () => {
  const errors: string[] = [];

  before(() => {
    cy.intercept("POST", "**/chat/completions", {
      statusCode: 200,
      headers: { "content-type": "text/event-stream" },
      body: sseBody(JSON.stringify(NESTED_IR)),
    }).as("generate");

    visitWorkspace(errors);
    openChat();
    sendPrompt("/generate AWS deployment for the orders platform");
    cy.wait("@generate");
  });

  it("renders every generated node on the canvas", () => {
    cy.get(".react-flow__node", { timeout: 60000 }).should(
      "have.length.gte",
      NESTED_IR.nodes.length,
    );
  });

  it("renders the generated edges", () => {
    cy.get(".react-flow__edge", { timeout: 30000 }).should(
      "have.length.gte",
      NESTED_IR.edges.length,
    );
  });

  it("nests three levels of containment inside their parents", () => {
    // Deepest chain: Production VPC > AZ > Private Subnet > Orders Service.
    const chain = ["Production VPC", "AZ us-east-1a", "Private Subnet", "Orders Service"];

    for (let index = 0; index < chain.length - 1; index += 1) {
      nodeRect(chain[index]).then((parent) => {
        nodeRect(chain[index + 1]).then((child) => {
          expect(
            child.left,
            `${chain[index + 1]} left edge is inside ${chain[index]}`,
          ).to.be.at.least(parent.left - 1);
          expect(
            child.top,
            `${chain[index + 1]} top edge is inside ${chain[index]}`,
          ).to.be.at.least(parent.top - 1);
          expect(
            child.right,
            `${chain[index + 1]} right edge is inside ${chain[index]}`,
          ).to.be.at.most(parent.right + 1);
          expect(
            child.bottom,
            `${chain[index + 1]} bottom edge is inside ${chain[index]}`,
          ).to.be.at.most(parent.bottom + 1);
        });
      });
    }
  });

  it("confirms the generation in the chat", () => {
    cy.contains("Diagram generated:", { timeout: 20000 }).should("exist");
  });

  it("logged no console errors", () => {
    cy.wrap(null).then(() => {
      expect(errors, `console errors:\n${errors.join("\n")}`).to.have.length(0);
    });
  });
});

describe("IR generation — invalid IR is reported, not crashed on", () => {
  const errors: string[] = [];

  before(() => {
    cy.intercept("POST", "**/chat/completions", {
      statusCode: 200,
      headers: { "content-type": "text/event-stream" },
      body: sseBody(
        JSON.stringify({
          type: "c4-container",
          nodes: [
            { id: "a", semanticType: "microservice", name: "A", parentId: null, tier: "compute" },
            { id: "b", semanticType: "container", name: "B", parentId: "ghost", tier: "compute" },
          ],
          edges: [{ id: "e1", sourceId: "a", targetId: "nowhere" }],
        }),
      ),
    }).as("generateInvalid");

    visitWorkspace(errors);
    openChat();
    sendPrompt("/generate something the model gets wrong");
    cy.wait("@generateInvalid");
  });

  it("explains what is wrong with the returned diagram", () => {
    cy.contains("does not match the IR schema", { timeout: 20000 }).should("exist");
    cy.contains("unknown semanticType").should("exist");
    cy.contains("parent that does not exist").should("exist");
  });

  it("leaves the canvas empty and the app usable", () => {
    cy.get(".react-flow__node").should("have.length", 0);
    cy.get('div[contenteditable="true"]').first().should("not.be.disabled");
  });

  it("logged no console errors", () => {
    cy.wrap(null).then(() => {
      expect(errors, `console errors:\n${errors.join("\n")}`).to.have.length(0);
    });
  });
});
