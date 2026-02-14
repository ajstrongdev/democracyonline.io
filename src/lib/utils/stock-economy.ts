export const SHARE_ISSUANCE_CAPITAL_UNIT = 100;

export function calculateIssuedSharesFromCapital(capital: number): number {
  if (!Number.isFinite(capital) || capital <= 0) {
    return 0;
  }

  return Math.floor(capital / SHARE_ISSUANCE_CAPITAL_UNIT);
}

export function calculateMarketCap(params: {
  sharePrice?: number | null;
  issuedShares?: number | null;
}): number {
  const sharePrice = Math.max(0, Number(params.sharePrice ?? 0));
  const issuedShares = Math.max(0, Number(params.issuedShares ?? 0));

  return sharePrice * issuedShares;
}

export function calculateHourlyDividend(params: {
  ownershipPct: number;
  marketCap: number;
}): number {
  const ownershipPct = Math.max(0, Number(params.ownershipPct || 0));
  const marketCap = Math.max(0, Number(params.marketCap || 0));

  return Math.floor(ownershipPct * 0.01 * marketCap);
}
