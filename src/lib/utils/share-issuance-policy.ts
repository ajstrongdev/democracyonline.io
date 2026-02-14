export const shouldTriggerBuyPressureMint = ({
  policy,
  buyPressureTriggerEnabled,
  netDemand,
  buyPressureThreshold,
}: {
  policy: "legacy-hourly" | "event-conditional";
  buyPressureTriggerEnabled: boolean;
  netDemand: number;
  buyPressureThreshold: number;
}) => {
  return (
    policy === "event-conditional" &&
    buyPressureTriggerEnabled &&
    netDemand >= buyPressureThreshold
  );
};

export const calculateOneShareOwnershipDriftBps = ({
  issuedSharesBefore,
  mintedShares,
}: {
  issuedSharesBefore: number;
  mintedShares: number;
}) => {
  if (issuedSharesBefore <= 0 || mintedShares <= 0) {
    return 0;
  }

  const beforeOwnership = 1 / issuedSharesBefore;
  const afterOwnership = 1 / (issuedSharesBefore + mintedShares);
  const driftBps = (beforeOwnership - afterOwnership) * 10_000;

  return Math.max(0, Math.round(driftBps));
};

export const calculateHourlyDividendPool = (marketCap: number) => {
  return Math.floor(marketCap * 0.1);
};

export const calculateDividendPerShareMilli = ({
  hourlyDividendPool,
  issuedShares,
}: {
  hourlyDividendPool: number;
  issuedShares: number;
}) => {
  if (issuedShares <= 0) {
    return 0;
  }

  return Math.floor((hourlyDividendPool * 1000) / issuedShares);
};
