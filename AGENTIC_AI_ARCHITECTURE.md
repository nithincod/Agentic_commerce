# Agentic AI Architecture & Multi-Agent Communication Guide

This document provides a comprehensive technical breakdown of all **Agentic AI** design patterns, state machines, and protocols implemented in **AgentPay**.

---

## 1. What Makes This System "Agentic"?

Traditional AI in e-commerce is typically **passive or generative** (e.g., product recommendation search or chat bots that only return plain text).

**AgentPay** is an **active, autonomous multi-agent system (MAS)**:
- **Autonomy**: Agents take concrete actions in the database (querying catalogs, modifying carts, generating checkout authorizations, creating campaign proposals).
- **Goal-Directed Tool Use**: The models do not just generate text; they formulate plans and call structured backend tools with Zod validation.
- **Agent-to-Agent (A2A) Interaction**: AI agents representing different stakeholders (Buyer vs. Merchant) communicate, negotiate, and share data using structured protocols.
- **Neuro-Symbolic Governance**: The LLM handles unstructured intent and reasoning (neuro), while strict deterministic TypeScript code governs money, spending limits, and payment security (symbolic).
- **Human-In-The-Loop (HITL)**: High-risk or policy-exceeding transactions automatically pause execution threads and require human approval before financial execution.

---

## 2. Multi-Agent Taxonomy

```mermaid
graph TD
    subgraph BuyerDomain ["Buyer Domain"]
        BuyerUser["Authenticated Buyer"] --> BuyerAgent["Buyer Agent (LangGraph)"]
    end

    subgraph MerchantDomain ["Merchant Domain"]
        MerchantUser["Authenticated Merchant"] --> MerchantDashboard["Merchant Dashboard"]
        MerchantDashboard --> RevenueAgent["Merchant Revenue Agent"]
    end

    subgraph GovernanceDomain ["Governance & Settlement"]
        CheckoutGraph["Checkout Governance Graph (HITL)"]
        PolicyEngine["Deterministic Policy Engine"]
        AuditLog[("AgentAction Audit Log")]
        Razorpay["Payment Gateway (Razorpay)"]
    end

    BuyerAgent <-->|"A2A Protocol (OFFER_REQUEST / OFFER_RESPONSE)"| RevenueAgent
    BuyerAgent -->|"create_checkout"| CheckoutGraph
    CheckoutGraph --> PolicyEngine
    CheckoutGraph -->|"interrupt() if limit exceeded"| BuyerUser
    CheckoutGraph -->|"Fulfill Paid Checkout"| Razorpay
    BuyerAgent -.->|"Record Action"| AuditLog
    RevenueAgent -.->|"Record Action"| AuditLog
    CheckoutGraph -.->|"Record Action"| AuditLog
```

### 1. Buyer Agent ([`buyerAgent.js`](file:///Users/sagilinithin/Downloads/agentpay-campaigns/src/lib/agents/buyerAgent.js))
- **Role**: Personal shopping assistant for the authenticated consumer.
- **Bound Scope**: Scoped strictly to `session.user.id`.
- **Tools**:
  - `search_products`: Semantic & filter search across PostgreSQL product catalog.
  - `get_product` / `check_inventory`: Real-time stock verification.
  - `create_cart`: Autonomous cart creation and item addition.
  - `get_available_offers`: Direct query for active discount campaigns.
  - `request_merchant_offer`: Initiates A2A communication with merchant agents.
  - `create_checkout`: Generates authoritative checkout sessions.

### 2. Merchant Revenue Agent ([`revenueAgent.js`](file:///Users/sagilinithin/Downloads/agentpay-campaigns/src/lib/agents/revenueAgent.js))
- **Role**: AI business analyst and campaign strategist for the merchant.
- **Bound Scope**: Scoped strictly to `merchant.id`.
- **Tools**:
  - `find_cross_sell_opportunities`: Analyzes co-purchase baskets and attachment rates.
  - `find_upsell_opportunities`: Identifies higher-tier alternatives in identical categories.
  - `find_abandoned_cart_opportunities`: Calculates recoverable cart revenue.
  - `find_inventory_opportunities`: Detects stagnant capital in overstocked items.
  - `create_campaign_proposal`: Generates draft promotional campaigns with auto-budgeting.

### 3. Payment & Governance Agent ([`checkoutGraph.js`](file:///Users/sagilinithin/Downloads/agentpay-campaigns/src/lib/graphs/checkoutGraph.js))
- **Role**: Financial risk gatekeeper and human-in-the-loop state machine.
- **Bound Scope**: Checkout-level transaction states.
- **Responsibilities**:
  - Re-evaluates authoritative PostgreSQL amounts.
  - Enforces deterministic spending caps.
  - Suspends execution threads (`interrupt`) when approvals are needed.
  - Links payments to orders idempotently.

---

## 3. Core Agentic AI Concepts Implemented

### A. LangGraph ReAct Cycle & Tool Execution
Both the Buyer Agent and Checkout Flow use **LangGraph** (`StateGraph`):

```mermaid
flowchart LR
    Start([START]) --> AgentNode["agent (LLM Reasoning)"]
    AgentNode -->|"Tool Call Required"| ShouldContinue{"shouldContinue?"}
    ShouldContinue -->|"tools"| ToolNode["executeTools (DB / A2A)"]
    ToolNode -->|"Return ToolResult"| AgentNode
    ShouldContinue -->|"No Tools / Final Answer"| EndNode([END])
```

- **Cycles**: If a buyer asks to *"Find a gaming mouse and add it to my cart"*, the agent first runs `search_products`, processes the output, and in the next cycle automatically invokes `create_cart`.
- **Dynamic Tool Injection**: Tools are instantiated dynamically inside user request scope (`createCartTool(userId)`), guaranteeing that the LLM cannot manipulate identity.

---

## B. Agent-to-Agent (A2A) Communication Protocol
Implemented in [`agentToAgent.js`](file:///Users/sagilinithin/Downloads/agentpay-campaigns/src/lib/agents/agentToAgent.js).

```mermaid
sequenceDiagram
    autonumber
    actor Shopper as Buyer
    participant BA as Buyer Agent (LangGraph)
    participant A2A as A2A Mediation Layer
    participant RA as Merchant Revenue Agent
    participant DB as PostgreSQL

    Shopper->>BA: "Find me a gaming mouse"
    BA->>DB: search_products("gaming mouse")
    DB-->>BA: [Gaming Mouse Pro, RGB Gaming Mouse]
    Note over BA,A2A: Buyer Agent proactively checks for deals
    BA->>A2A: request_merchant_offer("gaming mouse")
    A2A->>DB: Query ACTIVE campaigns for catalog
    DB-->>A2A: Active Campaign: "Gaming Mouse Pro Inventory Promotion" (15% off)
    A2A->>RA: Prompt with buyer intent + usable campaigns
    Note over RA: Revenue Agent validates match without exposing private margins
    RA-->>A2A: RELEVANT_OFFERS: Campaign ID, 15% discount, Target Product
    A2A-->>BA: Structured Offer Response
    BA-->>Shopper: Displays Products + "15% OFF" Relevant Offer Card
```

> [!IMPORTANT]
> **Data Privacy in A2A**: The Buyer Agent is never allowed to inspect private merchant analytics (margins, historical order counts, unapproved campaigns). The Revenue Agent filters and exposes only public campaign terms.

---

### C. Neuro-Symbolic Governance & Policy Engine
Implemented in [`policyEngine.js`](file:///Users/sagilinithin/Downloads/agentpay-campaigns/src/lib/policy/policyEngine.js).

```mermaid
flowchart TD
    Req[Checkout Request] --> Recalc["Recalculate Authoritative Amount from DB"]
    Recalc --> DailyCheck["Calculate Real Daily Spend in PostgreSQL"]
    DailyCheck --> RuleEngine{"Deterministic Rules Engine (No LLM)"}

    RuleEngine -->|"Amount > MAX_AUTO_PAYMENT (₹2,000)"| ReqAppr["Status: APPROVAL_REQUIRED"]
    RuleEngine -->|"Daily Spend > ₹10,000"| Block["Status: BLOCKED"]
    RuleEngine -->|"Discount > 15%"| Block
    RuleEngine -->|"Within All Limits"| Appr["Status: APPROVED"]

    ReqAppr --> Snapshot["Persist Policy Snapshot to Checkout.policy"]
    Block --> Snapshot
    Appr --> Snapshot
```

- **Why Neuro-Symbolic?**: LLMs are probabilistic; they cannot be allowed to make unchecked financial decisions. The symbolic policy engine provides 100% predictable, mathematical guarantees.
- **Policy Snapshotting**: The calculated policy decision is stored as an immutable JSON snapshot on the `Checkout` model, ensuring the decision cannot drift.

---

### D. Human-in-the-Loop (HITL) via LangGraph Interrupts
Implemented in [`checkoutGraph.js`](file:///Users/sagilinithin/Downloads/agentpay-campaigns/src/lib/graphs/checkoutGraph.js).

```mermaid
stateDiagram-v2
    [*] --> PolicyEvaluation
    PolicyEvaluation --> AutoApproved: Within ₹2,000 auto limit
    PolicyEvaluation --> InterruptRequired: Exceeds limit or policy flag

    state InterruptRequired {
        [*] --> interrupt_call: interrupt("APPROVAL_REQUIRED")
        interrupt_call --> CheckpointerSaved: Thread state frozen in MemorySaver
        CheckpointerSaved --> AwaitingHuman: Checkout status = AWAITING_APPROVAL
    }

    AwaitingHuman --> MerchantReview: Appears on /approvals dashboard
    MerchantReview --> ResumeCommand: Merchant clicks "Approve" (POST /api/checkout/approve)
    ResumeCommand --> AutoApproved: Command({ resume: "APPROVED" })

    AutoApproved --> ReadyForPayment: Checkout status = READY
    ReadyForPayment --> RazorpayGateway: Initiates Payment
    RazorpayGateway --> Completed: Order Fulfilled & Inventory Decremented
    Completed --> [*]
```

- **State Checkpointing**: LangGraph freezes the thread state using `MemorySaver` when `interrupt()` is called.
- **Resumption**: The thread remains idle until an authenticated merchant posts an explicit approval command, resuming execution at the exact state.

---

### E. Full Auditability (`AgentAction`)
Implemented in [`auditLog.js`](file:///Users/sagilinithin/Downloads/agentpay-campaigns/src/lib/audit/auditLog.js).

Every autonomous step across all agents writes an immutable record:

| Field | Description | Example |
| :--- | :--- | :--- |
| `agentType` | Which agent acted | `BUYER_AGENT`, `MERCHANT_AGENT`, `PAYMENT_AGENT` |
| `action` | Operational verb | `SEARCH_PRODUCTS`, `CHECKOUT_SUPERSEDED`, `ORDER_CREATED` |
| `entityType` | Target model | `Product`, `Cart`, `Checkout`, `Order`, `Campaign` |
| `input` | Exact parameters sent to tool | `{ userId: "...", amount: 4500 }` |
| `output` | Exact result returned | `{ checkoutId: "cm...", status: "READY" }` |
| `status` | Execution status | `SUCCESS`, `BLOCKED`, `FAILED` |
| `reason` | Human-readable audit explanation | *"Transaction approved: within ₹2000 auto-payment limit"* |

---

## 4. End-to-End Buyer Lifecycle

```mermaid
flowchart TD
    subgraph Discovery ["1. Autonomous Discovery"]
        U1["User: 'Find gaming mouse'"] --> BA1["Buyer Agent"]
        BA1 --> SP["search_products()"]
        BA1 --> GA["get_available_offers()"]
        SP & GA --> Resp1["Product Grid + 15% OFF Offer Card"]
    end

    subgraph CartAndCheckout ["2. Autonomous Cart & Checkout"]
        U2["User: 'Proceed to checkout' / 'Buy Now'"] --> CC["create_checkout()"]
        CC --> StaleCheck{"Is existing checkout stale?"}
        StaleCheck -->|"Yes (amount changed)"| Super["Mark SUPERSEDED"] --> Fresh["Create Fresh Checkout"]
        StaleCheck -->|"No"| Reuse["Reuse Checkout"]
        Fresh & Reuse --> Policy["Evaluate Policy (Max ₹2000)"]
    end

    subgraph Settlement ["3. Governance & Settlement"]
        Policy --> HITL{"Approval Needed?"}
        HITL -->|"Yes"| Pause["LangGraph interrupt()"] --> ApprPage["/approvals (Human Decision)"]
        ApprPage --> Resumed["Resume Graph"]
        HITL -->|"No"| Resumed
        Resumed --> Pay["Razorpay Payment Modal"]
        Pay --> Fulfill["Atomic Transaction: Decrement stock, create Order, convert Cart"]
        Fulfill --> Done["Order Completed & Attributed to Campaign"]
    end

    Discovery --> CartAndCheckout
    CartAndCheckout --> Settlement
```

---

## 5. Summary of Technologies

- **LangChain Core (`@langchain/core`)**: Tools, schemas, messages (`AIMessage`, `ToolMessage`).
- **LangGraph (`@langchain/langgraph`)**: Stateful cyclical graphs, state schemas, conditional edges, interrupts, and checkpointers.
- **Google GenAI / Gemini (`@langchain/google-genai`)**: Cognitive reasoning and intent parsing.
- **Prisma & PostgreSQL**: Authoritative state, atomic transactions, row locking, and relational campaign attribution.
- **Zod**: Type-safe input validation on all agent tools.
