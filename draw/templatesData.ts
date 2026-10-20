import {
  DEFAULT_STYLE,
  type CanvasElement,
  type AnchorPosition,
  type TextElement,
  type RectangleElement,
  type DiamondElement,
  type CircleElement,
} from "./types";

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  category: "architecture" | "flowchart" | "system-design" | "agile";
  elements: CanvasElement[];
  markdownNotes: string;
}

/** Shared layout units keep labels, rows and columns aligned across the library. */
class Diagram {
  elements: CanvasElement[] = [];
  constructor(
    private prefix: string,
    title: string,
  ) {
    this.text("title", title, 0, 0, title.length * 16, 29, 24);
  }
  private id(id: string) {
    return `${this.prefix}-${id}`;
  }
  text(
    id: string,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    fontSize = 16,
    containerId?: string,
  ) {
    const el: TextElement = {
      ...DEFAULT_STYLE,
      id: this.id(id),
      type: "text",
      x,
      y,
      width,
      height,
      text,
      fontSize,
      fontFamily: "sans",
      textAlign: containerId ? "center" : "left",
      fill: "transparent",
      fillStyle: "none",
      opacity: 1,
      zIndex: 4,
      ...(containerId
        ? { containerId, containerOffset: { x: 16 / (width + 32), y: 0.3 } }
        : {}),
    };
    this.elements.push(el);
    return el;
  }
  node(
    id: string,
    text: string,
    x: number,
    y: number,
    color = "#3B82F6",
    type: "rectangle" | "diamond" | "circle" = "rectangle",
    width = 220,
    height = 88,
  ) {
    const el: RectangleElement | DiamondElement | CircleElement = {
      ...DEFAULT_STYLE,
      id: this.id(id),
      type,
      x,
      y,
      width,
      height,
      stroke: color,
      fill: "#18181B",
      fillStyle: "solid",
      opacity: 1,
      zIndex: 2,
    };
    this.elements.push(el);
    const lines = text.split("\n").length,
      textHeight = lines * 16 * 1.35;
    const label = this.text(
      `${id}-text`,
      text,
      x + 16,
      y + (height - textHeight) / 2,
      width - 32,
      textHeight,
      16,
      el.id,
    );
    label.containerOffset = { x: 16 / width, y: (label.y - y) / height };
    return el;
  }
  edge(
    id: string,
    from: CanvasElement,
    to: CanvasElement,
    label = "",
    start: AnchorPosition = "right",
    end: AnchorPosition = "left",
  ) {
    const port = (el: CanvasElement, side: AnchorPosition) => ({
      x:
        el.x +
        (side === "left" ? 0 : side === "right" ? el.width : el.width / 2),
      y:
        el.y +
        (side === "top" ? 0 : side === "bottom" ? el.height : el.height / 2),
    });
    this.arrow(id, port(from, start), port(to, end), label, {
      startBinding: { elementId: from.id, anchor: start },
      endBinding: { elementId: to.id, anchor: end },
    });
  }
  arrow(
    id: string,
    from: { x: number; y: number },
    to: { x: number; y: number },
    label = "",
    bindings = {},
  ) {
    this.elements.push({
      ...DEFAULT_STYLE,
      id: this.id(id),
      type: "arrow",
      x: Math.min(from.x, to.x),
      y: Math.min(from.y, to.y),
      width: Math.abs(to.x - from.x),
      height: Math.abs(to.y - from.y),
      startX: from.x,
      startY: from.y,
      endX: to.x,
      endY: to.y,
      routing: "straight",
      arrowHeadEnd: "arrow",
      label,
      stroke: "#94A3B8",
      opacity: 1,
      zIndex: 1,
      ...bindings,
    });
  }
  frame(
    id: string,
    title: string,
    x: number,
    y: number,
    width: number,
    height: number,
    color = "#64748B",
  ) {
    this.elements.push({
      ...DEFAULT_STYLE,
      id: this.id(id),
      type: "frame",
      title,
      x,
      y,
      width,
      height,
      stroke: color,
      fill: "transparent",
      fillStyle: "none",
      opacity: 1,
      zIndex: 0,
    });
  }
  sticky(
    id: string,
    text: string,
    x: number,
    y: number,
    width = 244,
    color = "#FEF08A",
    height = 116,
  ) {
    this.elements.push({
      ...DEFAULT_STYLE,
      id: this.id(id),
      type: "sticky",
      x,
      y,
      width,
      height,
      text,
      fontSize: 16,
      fontFamily: "sans",
      textAlign: "left",
      color,
      fill: color,
      fillStyle: "solid",
      stroke: "#1E293B",
      opacity: 1,
      zIndex: 2,
    });
  }
  finish(
    id: string,
    name: string,
    description: string,
    category: TemplateDefinition["category"],
    notes: string,
  ): TemplateDefinition {
    return {
      id,
      name,
      description,
      category,
      elements: this.elements.sort((a, b) => a.zIndex - b.zIndex),
      markdownNotes: notes.trim(),
    };
  }
}

const cloud = new Diagram("cloud", "Cloud web application");
cloud.frame("vpc", "Private application network", 600, 72, 620, 440);
const client = cloud.node("client", "Web & mobile\nclients", 0, 140);
const cdn = cloud.node("cdn", "CDN & edge cache", 300, 140, "#A855F7");
const gateway = cloud.node("gateway", "Load balancer", 640, 140, "#F59E0B");
const services = cloud.node("services", "Application\nservices", 960, 140);
const cache = cloud.node("cache", "Redis cache", 640, 360, "#EF4444");
const database = cloud.node(
  "database",
  "PostgreSQL\ndatabase",
  960,
  360,
  "#10B981",
);
cloud.edge("client-cdn", client, cdn, "HTTPS");
cloud.edge("cdn-gateway", cdn, gateway);
cloud.edge("gateway-services", gateway, services);
cloud.edge("services-db", services, database, "SQL", "bottom", "top");
cloud.edge("gateway-cache", gateway, cache, "Cache", "bottom", "top");

const events = new Diagram("events", "Event-driven microservices");
const ingress = events.node("gateway", "API gateway", 0, 310, "#EC4899");
const order = events.node("order", "Order service", 320, 110),
  user = events.node("user", "User service", 320, 510);
const broker = events.node("broker", "Event broker", 640, 310, "#F59E0B");
const notify = events.node(
    "notify",
    "Notification worker",
    960,
    110,
    "#10B981",
  ),
  analytics = events.node("analytics", "Analytics worker", 960, 510, "#A855F7");
events.edge("in-order", ingress, order);
events.edge("in-user", ingress, user);
events.edge("order-broker", order, broker);
events.edge("user-broker", user, broker);
events.edge("broker-notify", broker, notify);
events.edge("broker-analytics", broker, analytics);

const flow = new Diagram("flow", "Authentication decision flow");
const start = flow.node(
  "start",
  "Start request",
  300,
  90,
  "#10B981",
  "circle",
  220,
  72,
);
const validate = flow.node("validate", "Validate credentials", 300, 250);
const decision = flow.node(
  "decision",
  "Valid\ncredentials?",
  300,
  430,
  "#F59E0B",
  "diamond",
  220,
  148,
);
const success = flow.node("success", "Create session", 0, 690, "#10B981"),
  failure = flow.node("failure", "Show error & retry", 600, 690, "#EF4444");
flow.edge("start-validate", start, validate, "", "bottom", "top");
flow.edge("validate-decision", validate, decision, "", "bottom", "top");
flow.edge("yes", decision, success, "Yes", "left", "top");
flow.edge("no", decision, failure, "No", "right", "top");

function columns(
  prefix: string,
  title: string,
  headings: string[],
  notes: string[][],
  colors: string[],
) {
  const d = new Diagram(prefix, title);
  headings.forEach((heading, i) => {
    const x = i * 340;
    d.frame(`column-${i}`, heading, x, 90, 300, 430, colors[i]);
    notes[i].forEach((text, j) =>
      d.sticky(`note-${i}-${j}`, text, x + 28, 130 + j * 158, 244, colors[i]),
    );
  });
  return d;
}
const kanban = columns(
  "kanban",
  "Project kanban board",
  ["Backlog", "In progress", "Done"],
  [
    ["Define the next milestone", "Collect user feedback"],
    ["Build the first prototype", "Review the design"],
    ["Agree on the project goal", "Set up the workspace"],
  ],
  ["#93C5FD", "#FEF08A", "#86EFAC"],
);
const retro = columns(
  "retro",
  "Team retrospective",
  ["Start", "Stop", "Continue"],
  [
    ["What should we try next?", "Choose one small experiment"],
    ["What slows us down?", "Remove one recurring blocker"],
    ["What is working well?", "Keep one useful habit"],
  ],
  ["#86EFAC", "#F9A8D4", "#93C5FD"],
);
const roadmap = columns(
  "roadmap",
  "Product roadmap",
  ["Now", "Next", "Later"],
  [
    ["Validate the main user need", "Ship a small useful release"],
    ["Improve the onboarding flow", "Measure the first outcomes"],
    ["Explore the next audience", "Plan longer-term investments"],
  ],
  ["#93C5FD", "#FEF08A", "#C4B5FD"],
);
const journey = columns(
  "journey",
  "Customer journey map",
  ["Discover", "Try", "Return"],
  [
    ["Touchpoint: recommendation", "Need: understand the value"],
    ["Touchpoint: first session", "Need: complete one useful task"],
    ["Touchpoint: saved workspace", "Need: resume work quickly"],
  ],
  ["#93C5FD", "#FEF08A", "#86EFAC"],
);

const swot = new Diagram("swot", "SWOT analysis");
[
  ["Strengths", "What do we do well?", "Which assets set us apart?", "#86EFAC"],
  [
    "Weaknesses",
    "Where do we struggle?",
    "Which skills are missing?",
    "#F9A8D4",
  ],
  [
    "Opportunities",
    "Which needs are underserved?",
    "What could we try next?",
    "#93C5FD",
  ],
  [
    "Threats",
    "What external risks matter?",
    "How can we reduce exposure?",
    "#FDBA74",
  ],
].forEach(([heading, a, b, color], i) => {
  const x = (i % 2) * 400,
    y = 90 + Math.floor(i / 2) * 320;
  swot.frame(`section-${i}`, heading, x, y, 360, 280, color);
  swot.sticky(`a-${i}`, a, x + 24, y + 40, 312, color, 96);
  swot.sticky(`b-${i}`, b, x + 24, y + 160, 312, color, 96);
});

const mind = new Diagram("mind", "Mind map");
const root = mind.node("root", "Project idea", 360, 290, "#A855F7");
[
  [0, 100, "User needs"],
  [720, 100, "Possible solutions"],
  [0, 480, "Constraints"],
  [720, 480, "Next actions"],
].forEach(([x, y, label], i) => {
  const node = mind.node(`branch-${i}`, String(label), Number(x), Number(y));
  mind.edge(
    `link-${i}`,
    root,
    node,
    "",
    Number(x) < 360 ? "left" : "right",
    Number(x) < 360 ? "right" : "left",
  );
});

const sequence = new Diagram("sequence", "Request / response sequence");
["Client", "API service", "Database"].forEach((label, i) => {
  sequence.node(
    `actor-${i}`,
    label,
    i * 320,
    90,
    "#3B82F6",
    "rectangle",
    220,
    72,
  );
  sequence.elements.push({
    ...DEFAULT_STYLE,
    id: `sequence-lifeline-${i}`,
    type: "line",
    x: i * 320 + 110,
    y: 190,
    width: 0,
    height: 480,
    startX: i * 320 + 110,
    startY: 190,
    endX: i * 320 + 110,
    endY: 670,
    stroke: "#64748B",
    strokeStyle: "dashed",
    zIndex: 0,
  });
});
sequence.arrow("request", { x: 110, y: 250 }, { x: 430, y: 250 }, "Request");
sequence.arrow("query", { x: 430, y: 360 }, { x: 750, y: 360 }, "Read data");
sequence.arrow("data", { x: 750, y: 470 }, { x: 430, y: 470 }, "Result");
sequence.arrow("response", { x: 430, y: 580 }, { x: 110, y: 580 }, "Response");

const erd = new Diagram("erd", "Customer / order data model");
const customer = erd.node(
  "customer",
  "Customer\n\nid (PK)\nname\nemail",
  0,
  120,
  "#3B82F6",
  "rectangle",
  260,
  240,
);
const purchase = erd.node(
  "order",
  "Order\n\nid (PK)\ncustomer_id (FK)\ncreated_at",
  380,
  120,
  "#A855F7",
  "rectangle",
  260,
  240,
);
const item = erd.node(
  "item",
  "Order item\n\nid (PK)\norder_id (FK)\nquantity",
  760,
  120,
  "#10B981",
  "rectangle",
  260,
  240,
);
erd.edge("customer-order", customer, purchase, "1 : N");
erd.edge("order-item", purchase, item, "1 : N");

const pipeline = new Diagram("pipeline", "Delivery pipeline");
const stages = [
  ["Code & review", 0, 110],
  ["Build & test", 320, 110],
  ["Security checks", 640, 110],
  ["Deploy staging", 640, 350],
  ["Deploy production", 320, 350],
  ["Observe & improve", 0, 350],
] as const;
const stageNodes = stages.map(([label, x, y], i) =>
  pipeline.node(`stage-${i}`, label, x, y, i < 3 ? "#3B82F6" : "#10B981"),
);
for (let i = 0; i < stageNodes.length - 1; i++)
  pipeline.edge(
    `step-${i}`,
    stageNodes[i],
    stageNodes[i + 1],
    "",
    i === 2 ? "bottom" : i < 2 ? "right" : "left",
    i === 2 ? "top" : i < 2 ? "left" : "right",
  );

export const TEMPLATES: TemplateDefinition[] = [
  cloud.finish(
    "cloud-web-app",
    "Cloud web application",
    "A clearly spaced client, CDN, application and data-layer diagram.",
    "architecture",
    "# Cloud web application\n\n## Layers\n- Clients reach the CDN over HTTPS.\n- The load balancer routes requests to application services.\n- Redis handles caching; PostgreSQL stores durable data.\n\n## Decisions\n- [ ] Define availability and scaling requirements.\n- [ ] Document authentication and backup policies.",
  ),
  events.finish(
    "microservices-event-bus",
    "Event-driven microservices",
    "Publish and consume events across services and background workers.",
    "architecture",
    "# Event-driven microservices\n\n## Event contracts\n- Orders and users publish events through a broker.\n- Notification and analytics workers consume independently.\n\n## Follow-up\n- [ ] Define event schemas and ownership.\n- [ ] Plan retries, idempotency and failed-message handling.",
  ),
  flow.finish(
    "flowchart-decision",
    "Authentication flowchart",
    "A vertical decision tree with separate success and failure branches.",
    "flowchart",
    "# Authentication flow\n\n1. Receive a request.\n2. Validate credentials.\n3. Create a session on success.\n4. Show a useful error on failure.\n\n- [ ] Document validation rules and retry behavior.",
  ),
  kanban.finish(
    "kanban-ideation",
    "Project kanban",
    "Aligned Backlog, In progress and Done columns with editable cards.",
    "agile",
    "# Project kanban\n\n## Working agreements\n- Keep work items small and actionable.\n- Limit work in progress.\n- Agree on what done means.",
  ),
  retro.finish(
    "team-retrospective",
    "Team retrospective",
    "Organize Start, Stop and Continue feedback into equal columns.",
    "agile",
    "# Team retrospective\n\n## Actions\n- [ ] Pick one change to try.\n- [ ] Assign an owner.\n- [ ] Review the outcome at the next retrospective.",
  ),
  roadmap.finish(
    "product-roadmap",
    "Product roadmap",
    "Plan work across Now, Next and Later without committing to dates.",
    "agile",
    "# Product roadmap\n\n## Planning\n- State the desired outcome for each item.\n- Validate Now work before expanding Next.\n- Review Later ideas as evidence changes.",
  ),
  journey.finish(
    "customer-journey",
    "Customer journey",
    "Map touchpoints and user needs across Discover, Try and Return.",
    "agile",
    "# Customer journey\n\n## Research prompts\n- What does the user want at each stage?\n- What causes friction?\n- Which outcome would show an improvement?",
  ),
  swot.finish(
    "swot-analysis",
    "SWOT analysis",
    "A balanced four-quadrant board for strengths, weaknesses, opportunities and threats.",
    "agile",
    "# SWOT analysis\n\n## Synthesis\n- Separate internal capabilities from external conditions.\n- Ground each observation in evidence.\n- [ ] Choose the most useful next action.",
  ),
  mind.finish(
    "mind-map",
    "Mind map",
    "A central idea with four evenly spaced branches to develop.",
    "system-design",
    "# Mind map\n\n## Explore\n- Capture ideas before judging them.\n- Group related branches.\n- Turn promising ideas into next actions.",
  ),
  sequence.finish(
    "request-sequence",
    "Request / response sequence",
    "Three aligned lifelines with ordered request and response messages.",
    "system-design",
    "# Request / response sequence\n\n1. The client sends a request.\n2. The API reads data.\n3. The database returns the result.\n4. The API responds to the client.\n\n- [ ] Add timeout and failure paths.",
  ),
  erd.finish(
    "customer-order-model",
    "Customer / order data model",
    "Three consistently sized entities with primary keys and one-to-many relationships.",
    "system-design",
    "# Customer / order data model\n\n## Relationships\n- One customer has many orders.\n- One order contains many order items.\n\n## Review\n- [ ] Confirm keys, constraints and deletion behavior.",
  ),
  pipeline.finish(
    "delivery-pipeline",
    "Delivery pipeline",
    "A six-step release process with consistent stages and spacing.",
    "flowchart",
    "# Delivery pipeline\n\n## Gates\n- Review changes and run automated tests.\n- Complete security checks before staging.\n- Verify staging before production.\n- Observe outcomes and iterate.\n\n- [ ] Define approval, rollback and monitoring responsibilities.",
  ),
];
