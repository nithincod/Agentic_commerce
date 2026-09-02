import {
  StateGraph,
  StateSchema,
  START,
  END,
  interrupt,
  Command,
} from "@langchain/langgraph";

import { MemorySaver } from "@langchain/langgraph";

const CheckoutState = new StateSchema({
  checkoutId: "",
  amount: 0,
  currency: "INR",
  approvalStatus: "PENDING",
  paymentStatus: "NOT_STARTED",
  message: "",
});

async function policyNode(state) {
  const MAX_AUTO_PAYMENT = 2000;

  if (state.amount <= MAX_AUTO_PAYMENT) {
    return {
      approvalStatus: "APPROVED",
      message: "Transaction is within automatic payment policy.",
    };
  }

  return {
    approvalStatus: "REQUIRED",
    message: "Human approval is required for this transaction.",
  };
}

async function approvalNode(state) {
  if (state.approvalStatus !== "REQUIRED") {
    return {
      approvalStatus: "APPROVED",
    };
  }

  const decision = interrupt({
    type: "PAYMENT_APPROVAL",
    checkoutId: state.checkoutId,
    amount: state.amount,
    currency: state.currency,
    message: `Approve payment of ₹${state.amount.toLocaleString(
      "en-IN"
    )}?`,
  });

  if (decision === "approve") {
    return {
      approvalStatus: "APPROVED",
      message: "Payment approved by user.",
    };
  }

  return {
    approvalStatus: "REJECTED",
    message: "Payment rejected by user.",
  };
}

async function paymentPreparationNode(state) {
  if (state.approvalStatus !== "APPROVED") {
    return {
      paymentStatus: "NOT_STARTED",
    };
  }

  return {
    paymentStatus: "READY",
    message: "Transaction is ready for Razorpay.",
  };
}

function routeAfterPolicy(state) {
  if (state.approvalStatus === "REJECTED") {
    return END;
  }

  if (state.approvalStatus === "REQUIRED") {
    return "approval";
  }

  return "payment";
}

function routeAfterApproval(state) {
  if (state.approvalStatus === "APPROVED") {
    return "payment";
  }

  return END;
}

const checkpointer = new MemorySaver();

const graph = new StateGraph(CheckoutState)
  .addNode("policy", policyNode)
  .addNode("approval", approvalNode)
  .addNode("payment", paymentPreparationNode)
  .addEdge(START, "policy")
  .addConditionalEdges(
    "policy",
    routeAfterPolicy,
    ["approval", "payment", END]
  )
  .addConditionalEdges(
    "approval",
    routeAfterApproval,
    ["payment", END]
  )
  .addEdge("payment", END)
  .compile({
    checkpointer,
  });

export default graph;