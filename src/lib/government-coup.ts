export type Office = "Representative" | "Senator" | "President";

type Player = { id: number; username: string; role: string | null };

export function planCoup(
  target: Player,
  role: Office,
  presidents: Array<Player>,
) {
  if (target.role === role) throw new Error("Player already has this role");
  return [
    {
      userId: target.id,
      username: target.username,
      fromOffice: target.role,
      toOffice: role,
    },
    ...(role === "President"
      ? presidents
          .filter((president) => president.id !== target.id)
          .map((president) => ({
            userId: president.id,
            username: president.username,
            fromOffice: president.role,
            toOffice: "Representative" as const,
          }))
      : []),
  ];
}
