const POLICY = {
  MAX_AUTO_PAYMENT: 2000,
  MAX_DAILY_SPENDING: 10000,
  MAX_DISCOUNT_PERCENT: 15,
};

/**
 * Evaluate a transaction using deterministic rules.
 *
 * IMPORTANT:
 * This function does NOT use an LLM.
 * The result is fully deterministic and explainable.
 */
export function evaluateTransaction({
  amount,
  dailySpent,
  discountPercent = 0,
}) {
  const rules = [];

  /*
   * -----------------------------------------------
   * Validate amount
   * -----------------------------------------------
   */
  const validAmount =
    Number.isInteger(amount) &&
    amount > 0;

  rules.push({
    rule: "VALID_TRANSACTION_AMOUNT",
    passed: validAmount,
    value: amount,
    limit: 0,
    message: validAmount
      ? "Transaction amount is valid."
      : "Transaction amount must be a positive integer.",
  });

  if (!validAmount) {
    return {
      status: "BLOCKED",

      decision: "BLOCK",

      rules,

      reason:
        "Transaction was blocked because the amount is invalid.",

      policyVersion: "1.0",
    };
  }

  /*
   * -----------------------------------------------
   * Validate daily spending
   * -----------------------------------------------
   */
  const validDailySpent =
    Number.isInteger(dailySpent) &&
    dailySpent >= 0;

  rules.push({
    rule: "VALID_DAILY_SPENDING",
    passed: validDailySpent,
    value: dailySpent,
    limit:
      POLICY.MAX_DAILY_SPENDING,
    message: validDailySpent
      ? "Daily spending value is valid."
      : "Daily spending must be a non-negative integer.",
  });

  if (!validDailySpent) {
    return {
      status: "BLOCKED",

      decision: "BLOCK",

      rules,

      reason:
        "Transaction was blocked because the customer's spending data is invalid.",

      policyVersion: "1.0",
    };
  }

  /*
   * -----------------------------------------------
   * Validate discount
   * -----------------------------------------------
   */
  const validDiscount =
    Number.isInteger(
      discountPercent
    ) &&
    discountPercent >= 0 &&
    discountPercent <=
      POLICY.MAX_DISCOUNT_PERCENT;

  rules.push({
    rule: "MAX_DISCOUNT_PERCENT",
    passed: validDiscount,
    value: discountPercent,
    limit:
      POLICY.MAX_DISCOUNT_PERCENT,
    message: validDiscount
      ? "Discount is within the permitted policy limit."
      : `Discount exceeds the maximum allowed ${POLICY.MAX_DISCOUNT_PERCENT}%.`,
  });

  if (!validDiscount) {
    return {
      status: "BLOCKED",

      decision: "BLOCK",

      rules,

      reason:
        "Transaction was blocked because the discount exceeds the permitted limit.",

      policyVersion: "1.0",
    };
  }

  /*
   * -----------------------------------------------
   * Calculate projected daily spending
   * -----------------------------------------------
   */
  const projectedDailySpent =
    dailySpent + amount;

  const withinDailyLimit =
    projectedDailySpent <=
    POLICY.MAX_DAILY_SPENDING;

  rules.push({
    rule: "DAILY_SPENDING_LIMIT",
    passed: withinDailyLimit,
    value: projectedDailySpent,
    previousValue: dailySpent,
    transactionAmount: amount,
    limit:
      POLICY.MAX_DAILY_SPENDING,
    message: withinDailyLimit
      ? "Projected daily spending is within the allowed limit."
      : `Projected daily spending exceeds the ${POLICY.MAX_DAILY_SPENDING} INR daily limit.`,
  });

  if (!withinDailyLimit) {
    return {
      status: "BLOCKED",

      decision: "BLOCK",

      rules,

      reason:
        `Transaction would raise daily spending to ₹${projectedDailySpent}, exceeding the ₹${POLICY.MAX_DAILY_SPENDING} limit.`,

      policyVersion: "1.0",
    };
  }

  /*
   * -----------------------------------------------
   * Automatic payment threshold
   * -----------------------------------------------
   */
  const belowAutoPaymentLimit =
    amount <=
    POLICY.MAX_AUTO_PAYMENT;

  rules.push({
    rule: "MAX_AUTO_PAYMENT",
    passed: belowAutoPaymentLimit,
    value: amount,
    limit:
      POLICY.MAX_AUTO_PAYMENT,
    message: belowAutoPaymentLimit
      ? `Transaction is within the automatic payment limit of ₹${POLICY.MAX_AUTO_PAYMENT}.`
      : `Transaction exceeds the automatic payment limit of ₹${POLICY.MAX_AUTO_PAYMENT}.`,
  });

  /*
   * -----------------------------------------------
   * Final decision
   * -----------------------------------------------
   */
  if (!belowAutoPaymentLimit) {
    return {
      status:
        "APPROVAL_REQUIRED",

      decision:
        "REQUIRE_HUMAN_APPROVAL",

      rules,

      reason:
        `Human approval is required because the transaction amount of ₹${amount} exceeds the automatic payment limit of ₹${POLICY.MAX_AUTO_PAYMENT}.`,

      policyVersion: "1.0",
    };
  }

  return {
    status: "APPROVED",

    decision:
      "ALLOW",

    rules,

    reason:
      `Transaction is within all configured policy limits and can proceed without additional approval.`,

    policyVersion: "1.0",
  };
}

export function getPolicyConfig() {
  return {
    ...POLICY,
  };
}