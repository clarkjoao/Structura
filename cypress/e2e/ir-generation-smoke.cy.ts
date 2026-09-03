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

/**
 * vpc > az > private subnet > services: three levels of containment, plus the
 * cases slice 2 added — concrete AWS services, a boundary named exactly like its
 * kind, an unknown service, and an empty boundary.
 */
const NESTED_IR = {
  type: "aws-deployment",
  nodes: [
    { id: "customer", semanticType: "person", name: "Customer", parentId: null, tier: "external" },
    {
      id: "prod-vpc",
      semanticType: "aws-vpc",
      name: "Production VPC",
      awsService: "vpc",
      parentId: null,
      isBoundary: true,
      tier: "edge",
    },
    {
      id: "az-a",
      semanticType: "aws-az",
      name: "AZ us-east-1a",
      parentId: "prod-vpc",
      isBoundary: true,
      tier: "compute",
    },
    {
      // Named exactly like its panel kind — the duplicated-label case.
      id: "private-subnet",
      semanticType: "aws-private-subnet",
      name: "Private Subnet",
      awsService: "private-subnet",
      parentId: "az-a",
      isBoundary: true,
      tier: "compute",
    },
    {
      id: "app-elb",
      semanticType: "aws-networking",
      name: "Application Load Balancer",
      awsService: "elb",
      parentId: "private-subnet",
      tier: "edge",
    },
    {
      id: "orders-service",
      semanticType: "aws-compute",
      name: "Orders Service",
      awsService: "lambda",
      technology: "Node.js",
      parentId: "private-subnet",
      tier: "compute",
    },
    {
      id: "orders-db",
      semanticType: "aws-database",
      name: "Orders Database",
      awsService: "rds",
      technology: "Aurora PostgreSQL",
      parentId: "private-subnet",
      tier: "data",
    },
    {
      // Service the catalog does not know — must degrade, not break.
      id: "mystery-box",
      semanticType: "aws-compute",
      name: "Mystery Box",
      awsService: "not-a-real-service",
      parentId: "private-subnet",
      tier: "compute",
    },
    {
      // Boundary with nothing inside it: only renderable via isBoundary.
      id: "empty-vpc",
      semanticType: "aws-vpc",
      name: "Disaster Recovery",
      awsService: "vpc",
      parentId: null,
      isBoundary: true,
      tier: "edge",
    },
  ],
  edges: [
    { id: "customer-to-elb", sourceId: "customer", targetId: "app-elb", label: "HTTPS" },
    { id: "elb-to-service", sourceId: "app-elb", targetId: "orders-service", label: "routes" },
    {
      id: "service-to-db",
      sourceId: "orders-service",
      targetId: "orders-db",
      label: "reads/writes",
    },
  ],
};

/** Keyboard shortcuts in this app use Cmd on macOS and Ctrl elsewhere (see `isModKeyPressed`). */
function modKey(): string {
  return Cypress.platform === "darwin" ? "{meta}" : "{ctrl}";
}

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
    // Deepest chain: Production VPC > AZ > Private Subnet > Orders Database.
    const chain = ["Production VPC", "AZ us-east-1a", "Private Subnet", "Orders Database"];

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

  it("confirms the generation in the chat and offers accept/reject", () => {
    cy.contains("review and accept below", { timeout: 20000 }).should("exist");
    cy.contains("button", "Accept").should("exist");
    cy.contains("button", "Reject").should("exist");
  });

  it("resolves service icons from the AWS catalog", () => {
    // A resolved icon comes from `aws-react-icons`; the fallback is lucide's
    // Network glyph, which always carries a `lucide` class.
    for (const label of ["Orders Service", "Orders Database", "Application Load Balancer"]) {
      cy.contains(".react-flow__node", label)
        .find("svg:not(.lucide)", { timeout: 20000 })
        .should("have.length.gte", 1);
    }
  });

  it("degrades an unknown service to the fallback icon without breaking", () => {
    cy.contains(".react-flow__node", "Mystery Box").should("exist");
    cy.contains(".react-flow__node", "Mystery Box").find("svg.lucide").should("exist");
  });

  it("shows technology on an AWS node, and the category when it has none", () => {
    cy.contains(".react-flow__node", "Orders Service").should("contain.text", "Node.js");
    // No technology set: the category label is the fallback, which is what
    // already-saved diagrams rely on.
    cy.contains(".react-flow__node", "Mystery Box").should("contain.text", "Compute");
  });

  it("gives boundaries the AWS treatment", () => {
    for (const label of ["Production VPC", "Private Subnet", "AZ us-east-1a"]) {
      cy.contains(".react-flow__node", label)
        .find("svg:not(.lucide)", { timeout: 20000 })
        .should("have.length.gte", 1);
    }
  });

  it("does not duplicate the kind in a boundary label", () => {
    cy.contains(".react-flow__node", "Private Subnet")
      .invoke("text")
      .should((text: string) => {
        expect(text).to.not.contain("Private Subnet - Private Subnet");
      });
    cy.contains(".react-flow__node", "Production VPC")
      .invoke("text")
      .should((text: string) => {
        expect(text).to.not.contain("VPC - Production VPC");
      });
  });

  it("renders a boundary that has no children", () => {
    cy.contains(".react-flow__node", "Disaster Recovery")
      .should("exist")
      .then(($el) => {
        const rect = $el[0].getBoundingClientRect();
        // A boundary box, not a collapsed leaf-sized node.
        expect(rect.width).to.be.at.least(200);
        expect(rect.height).to.be.at.least(120);
      });
  });

  it("logged no console errors", () => {
    cy.wrap(null).then(() => {
      expect(errors, `console errors:\n${errors.join("\n")}`).to.have.length(0);
    });
  });
});

describe("IR generation — reject discards the whole generated graph", () => {
  const errors: string[] = [];

  before(() => {
    cy.intercept("POST", "**/chat/completions", {
      statusCode: 200,
      headers: { "content-type": "text/event-stream" },
      body: sseBody(JSON.stringify(NESTED_IR)),
    }).as("generateForReject");

    visitWorkspace(errors);
    openChat();
    sendPrompt("/generate AWS deployment for the orders platform");
    cy.wait("@generateForReject");
  });

  it("removes every generated node when rejected", () => {
    cy.get(".react-flow__node", { timeout: 60000 }).should(
      "have.length.gte",
      NESTED_IR.nodes.length,
    );
    cy.contains("button", "Reject").click();
    cy.get(".react-flow__node").should("have.length", 0);
  });
});

describe("IR generation — accepted elements survive a batched delete + single undo", () => {
  const errors: string[] = [];

  before(() => {
    cy.intercept("POST", "**/chat/completions", {
      statusCode: 200,
      headers: { "content-type": "text/event-stream" },
      body: sseBody(JSON.stringify(NESTED_IR)),
    }).as("generateForAccept");

    visitWorkspace(errors);
    openChat();
    sendPrompt("/generate AWS deployment for the orders platform");
    cy.wait("@generateForAccept");
    cy.get(".react-flow__node", { timeout: 60000 }).should(
      "have.length.gte",
      NESTED_IR.nodes.length,
    );
    cy.contains("button", "Accept").click();
    cy.contains("button", "Accept").should("be.disabled");
  });

  it("restores every deleted node with a single undo after a multi-select delete", () => {
    // Ctrl/Cmd-click three nodes into a multi-selection, delete them
    // together, then undo once — the whole batch must come back from a
    // single history checkpoint, not just the last node removed.
    const labels = ["Customer", "Application Load Balancer", "Orders Service"];
    cy.contains(".react-flow__node", labels[0]).click({ force: true });
    for (const label of labels.slice(1)) {
      cy.get("body").type("{ctrl}", { release: false });
      cy.contains(".react-flow__node", label).click({ force: true });
      cy.get("body").type("{ctrl}");
    }
    cy.get("body").type("{del}");
    cy.get(".react-flow__node").should("have.length", NESTED_IR.nodes.length - labels.length);

    cy.get("body").type(`${modKey()}z`);
    cy.get(".react-flow__node").should("have.length", NESTED_IR.nodes.length);
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

describe("IR export", () => {
  const errors: string[] = [];

  before(() => {
    cy.intercept("POST", "**/chat/completions", {
      statusCode: 200,
      headers: { "content-type": "text/event-stream" },
      body: sseBody(JSON.stringify(NESTED_IR)),
    }).as("generateForExport");

    visitWorkspace(errors);
    openChat();
    sendPrompt("/generate AWS deployment");
    cy.wait("@generateForExport");
  });

  it("offers a download of the generated IR and writes valid JSON", () => {
    cy.window().then((win) => {
      // Capture what the anchor would download instead of hitting the disk.
      cy.stub(win.URL, "createObjectURL").callsFake((blob: Blob) => {
        return blob.text().then((text: string) => {
          const parsed = JSON.parse(text) as { type: string; nodes: unknown[] };
          expect(parsed.type).to.equal(NESTED_IR.type);
          expect(parsed.nodes).to.have.length(NESTED_IR.nodes.length);
          return "blob:stubbed";
        }) as unknown as string;
      });
    });

    cy.get('button[aria-label="Download the generated IR as JSON"]').should("exist").click();
  });
});
