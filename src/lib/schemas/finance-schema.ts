import { z } from "zod";

export const MONEY_INPUT_CAP = 1_000_000;
export const MEMBERSHIP_FEE_CAP = 100_000;
export const QUANTITY_INPUT_CAP = 100_000;

export const positiveMoneyAmountSchema = z
  .number()
  .int("Amount must be a whole number")
  .min(1, "Amount must be positive")
  .max(MONEY_INPUT_CAP, `Amount cannot exceed $${MONEY_INPUT_CAP.toLocaleString()}`);

export const nonNegativeMembershipFeeSchema = z
  .number()
  .int("Membership fee must be a whole number")
  .min(0, "Membership fee cannot be negative")
  .max(
    MEMBERSHIP_FEE_CAP,
    `Membership fee cannot exceed $${MEMBERSHIP_FEE_CAP.toLocaleString()}`,
  );

export const positiveQuantitySchema = z
  .number()
  .int("Quantity must be a whole number")
  .min(1, "Quantity must be greater than zero")
  .max(
    QUANTITY_INPUT_CAP,
    `Quantity cannot exceed ${QUANTITY_INPUT_CAP.toLocaleString()}`,
  );

export const nonNegativeQuantitySchema = z
  .number()
  .int("Quantity must be a whole number")
  .min(0, "Quantity cannot be negative")
  .max(
    QUANTITY_INPUT_CAP,
    `Quantity cannot exceed ${QUANTITY_INPUT_CAP.toLocaleString()}`,
  );
