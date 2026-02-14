import { describe, expect, it } from "vitest";
import { CreateCompanySchema } from "@/lib/schemas/stock-schema";
import {
  calculateHourlyDividend,
  calculateIssuedSharesFromCapital,
  calculateMarketCap,
} from "@/lib/utils/stock-economy";

describe("stock economy helpers", () => {
  it("calculates market cap from issued shares", () => {
    const marketCap = calculateMarketCap({ sharePrice: 250, issuedShares: 40 });

    expect(marketCap).toBe(10_000);
  });

  it("calculates hourly dividend from ownership and market cap", () => {
    const marketCap = calculateMarketCap({ sharePrice: 100, issuedShares: 1_000 });
    const hourlyDividend = calculateHourlyDividend({
      ownershipPct: 0.25,
      marketCap,
    });

    expect(hourlyDividend).toBe(2_500);
  });

  it("uses the same issuance math in schema and runtime", () => {
    const capital = 1_050;
    const issuedShares = calculateIssuedSharesFromCapital(capital);

    expect(issuedShares).toBe(10);

    const validResult = CreateCompanySchema.safeParse({
      name: "Acme Holdings",
      symbol: "ACME",
      description: "Test",
      capital,
      retainedShares: issuedShares,
      logo: null,
      color: "#3b82f6",
    });

    expect(validResult.success).toBe(true);

    const invalidResult = CreateCompanySchema.safeParse({
      name: "Acme Holdings",
      symbol: "ACME",
      description: "Test",
      capital,
      retainedShares: issuedShares + 1,
      logo: null,
      color: "#3b82f6",
    });

    expect(invalidResult.success).toBe(false);
  });
});
