export function getVoteShare(value: number, total: number) {
  return total > 0 ? (value / total) * 100 : 0;
}

export function getOfficeholderSelection(
  election: "President" | "Senate",
  office: string,
  elected: boolean,
) {
  if (elected) return "Elected";
  if (election === "Senate" && office === "Senator") return "Appointed";
  return "Serving";
}

export function formatOrdinal(value: number) {
  const words = [
    "",
    "First",
    "Second",
    "Third",
    "Fourth",
    "Fifth",
    "Sixth",
    "Seventh",
    "Eighth",
    "Ninth",
    "Tenth",
    "Eleventh",
    "Twelfth",
    "Thirteenth",
    "Fourteenth",
    "Fifteenth",
    "Sixteenth",
    "Seventeenth",
    "Eighteenth",
    "Nineteenth",
    "Twentieth",
  ];
  if (words[value]) return words[value];
  const remainder100 = value % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
}

export function formatElectionTitle(election: string, number: number) {
  const office = election === "President" ? "presidential" : "Senate";
  return `${formatOrdinal(number)} ${office} election`;
}

export function formatWikiDate(value: Date | string) {
  const date = new Date(value);
  const day = date.getUTCDate();
  const remainder100 = day % 100;
  const suffix =
    remainder100 >= 11 && remainder100 <= 13
      ? "th"
      : day % 10 === 1
        ? "st"
        : day % 10 === 2
          ? "nd"
          : day % 10 === 3
            ? "rd"
            : "th";
  const month = date.toLocaleDateString("en-GB", {
    month: "long",
    timeZone: "UTC",
  });
  return `${day}${suffix} ${month} ${date.getUTCFullYear()}`;
}

type OfficeSnapshot = {
  historyId: number;
  election: string;
  cycle: number;
  concludedAt: Date | string;
  office: string;
  selection: string;
};

export function getOfficeTerms(
  snapshots: Array<OfficeSnapshot>,
  currentOffice: string | null,
) {
  const ordered = [...snapshots].sort(
    (a, b) =>
      new Date(a.concludedAt).getTime() - new Date(b.concludedAt).getTime(),
  );
  const terms: Array<
    OfficeSnapshot & { startAt: Date | string; endAt: Date | string | null }
  > = [];

  for (const snapshot of ordered) {
    const activeTerm = terms.at(-1);
    if (activeTerm?.office === snapshot.office) continue;
    if (activeTerm) activeTerm.endAt = snapshot.concludedAt;
    terms.push({
      ...snapshot,
      startAt: snapshot.concludedAt,
      endAt: null,
    });
  }

  const latest = terms.at(-1);
  if (latest && latest.office !== currentOffice) {
    latest.endAt = ordered.at(-1)?.concludedAt ?? latest.startAt;
  }
  return terms.reverse();
}

type PartyHistoryPoint = {
  at: Date | string;
  partyId: number | null;
  partyName: string | null;
  partyColor: string | null;
};

export function getPartyTerms(
  points: Array<PartyHistoryPoint>,
  current: Omit<PartyHistoryPoint, "at">,
  createdAt: Date | string | null,
) {
  const ordered = [...points].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
  const terms: Array<
    PartyHistoryPoint & { startAt: Date | string | null; endAt: Date | string | null }
  > = [];

  for (const point of ordered) {
    const active = terms.at(-1);
    if (active?.partyId === point.partyId) continue;
    if (active) active.endAt = point.at;
    terms.push({ ...point, startAt: point.at, endAt: null });
  }

  const active = terms.at(-1);
  if (!active) {
    terms.push({ ...current, at: createdAt ?? new Date(0), startAt: createdAt, endAt: null });
  } else if (active.partyId !== current.partyId) {
    active.endAt = null;
    terms.push({ ...current, at: new Date(0), startAt: null, endAt: null });
  } else {
    active.partyName = current.partyName;
    active.partyColor = current.partyColor;
  }

  return terms.reverse();
}
