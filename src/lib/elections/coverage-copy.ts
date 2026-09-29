// Copy is derived from the published snapshots, not the unrevealed final tally.
// Keeping it independent of the stored headline also improves races already under way.
export type CoverageSnapshot = {
  sequence: number;
  type: string;
  cumulativeTotals: Record<string, number>;
  totalPoints: number;
};

export type CoverageCandidate = { id: number; name: string };

const number = (value: number) => value.toLocaleString("en-GB");

function randomIndex(sequence: number, salt: number, size: number): number {
  let hash = 2166136261;
  for (const character of `${sequence}:${salt}`) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  }
  return (hash >>> 0) % size;
}

function pick<T>(choices: Array<T>, sequence: number, salt: number): T {
  return choices[randomIndex(sequence, salt, choices.length)];
}

// Eighteen subjects seen through ten distinct factual lenses make 180
// editorial angles. Shuffle the whole deck before repeating any combination.
function angleFor(sequence: number, seats: number): number {
  const size = 180;
  const pass = Math.floor((sequence - 1) / size);
  const deck = Array.from({ length: size }, (_, index) => index);
  for (let index = size - 1; index > 0; index--) {
    const other = randomIndex(pass * size + index, seats, index + 1);
    [deck[index], deck[other]] = [deck[other], deck[index]];
  }
  return deck[(sequence - 1) % size];
}

export function writeElectionCoverage(
  updates: Array<CoverageSnapshot>,
  candidates: Array<CoverageCandidate>,
  seats: number,
  totalAvailable: number,
) {
  // Candidate IDs change between cycles, allowing different portions of the
  // 180-angle deck to appear across twelve-hour (144-update) election nights.
  const deckSeed = candidates.reduce(
    (seed, candidate) => (Math.imul(seed, 31) + candidate.id) >>> 0,
    seats,
  );
  return updates.map((update, index) => {
    const previous = updates[index - 1];
    const ranked = candidates
      .map((candidate) => ({
        ...candidate,
        points: update.cumulativeTotals[String(candidate.id)] ?? 0,
        gain:
          (update.cumulativeTotals[String(candidate.id)] ?? 0) -
          (previous?.cumulativeTotals[String(candidate.id)] ?? 0),
      }))
      .sort((a, b) => b.points - a.points || a.id - b.id);
    const [first, second] = ranked;
    const cutoff = ranked[Math.min(Math.max(1, seats), ranked.length) - 1];
    const challenger = ranked[Math.min(Math.max(1, seats), ranked.length)];
    const biggestGain = [...ranked].sort(
      (a, b) => b.gain - a.gain || a.id - b.id,
    )[0];
    const batch = update.totalPoints - (previous?.totalPoints ?? 0);
    const percent =
      totalAvailable > 0
        ? Math.round((update.totalPoints / totalAvailable) * 100)
        : 100;
    const previousRanked = candidates
      .map((candidate) => ({
        id: candidate.id,
        points: previous?.cumulativeTotals[String(candidate.id)] ?? 0,
      }))
      .sort((a, b) => b.points - a.points || a.id - b.id);
    const previousLead = previousRanked[0];
    const newlyInSeats =
      seats > 1 && previous
        ? ranked
            .slice(0, seats)
            .find(
              (candidate) =>
                !previousRanked
                  .slice(0, seats)
                  .some((prior) => prior.id === candidate.id),
            )
        : null;
    const displaced = newlyInSeats
      ? previousRanked
          .slice(0, seats)
          .find(
            (prior) =>
              !ranked
                .slice(0, seats)
                .some((candidate) => candidate.id === prior.id),
          )
      : null;
    const isFinal = update.type === "FINAL";
    const isOpening = update.type === "OPENING";
    const multiSeat = seats > 1;
    const gap = first && second ? first.points - second.points : 0;
    const cutoffGap =
      cutoff && challenger ? cutoff.points - challenger.points : 0;
    const remaining = Math.max(0, totalAvailable - update.totalPoints);
    const angle = angleFor(update.sequence, deckSeed);
    const subject = angle % 18;
    const lens = Math.floor(angle / 18);
    const third = ranked[2];
    const last = ranked.at(-1);
    const riser = [...ranked].sort((a, b) => b.gain - a.gain || a.id - b.id)[0];
    const share = update.totalPoints
      ? Math.round(((first?.points ?? 0) / update.totalPoints) * 100)
      : 0;
    const previousGap =
      previousRanked.length > 1
        ? previousRanked[0].points - previousRanked[1].points
        : 0;
    const gapMovement = gap - previousGap;
    const field = ranked.length;

    if (!first) {
      return {
        headline: isFinal
          ? "The count is complete"
          : "The first figures are in",
        paragraphs: ["No candidates are on the published tally for this race."],
      };
    }

    let headline: string;
    if (isFinal) {
      headline = multiSeat
        ? `Senate count complete: ${number(update.totalPoints)} points reported`
        : gap === 0 && second
          ? `${first.name} and ${second.name} finish level in the count`
          : `${first.name} finishes first in the completed count`;
    } else if (isOpening) {
      headline =
        second && gap === 0
          ? `Opening report puts ${first.name} and ${second.name} level`
          : pick(
              [
                `First figures put ${first.name} in front`,
                `Opening report: ${number(update.totalPoints)} points counted`,
                `${first.name} leads as counting begins`,
              ],
              update.sequence,
              seats,
            );
    } else if (
      previousLead &&
      previousLead.id !== first.id &&
      first.points > (second?.points ?? -1)
    ) {
      headline = pick(
        [
          `${first.name} moves into first place`,
          `Lead changes hands as ${first.name} goes ahead`,
          `${first.name} overtakes ${previousRanked[0].id === second?.id ? second.name : "the previous leader"}`,
        ],
        update.sequence,
        seats,
      );
    } else if (newlyInSeats && displaced) {
      const displacedName = candidates.find(
        (candidate) => candidate.id === displaced.id,
      )?.name;
      headline = pick(
        [
          `${newlyInSeats.name} enters the provisional Senate places`,
          `${newlyInSeats.name} moves above ${displacedName} in the Senate count`,
          `The Senate's top ${seats} changes in the latest return`,
        ],
        update.sequence,
        seats,
      );
    } else if (multiSeat && challenger && [3, 9, 15].includes(subject)) {
      headline = pick(
        [
          `${cutoff.name} and ${challenger.name} contest the final Senate place`,
          `${number(cutoffGap)} points separate candidates at the seat cutoff`,
          `${challenger.name} ${cutoffGap ? `sits ${number(cutoffGap)} points behind` : "is level with"} ${cutoff.name} at the cutoff`,
          `The Senate's ${seats}th place comes into focus`,
          `A closer look at the fight for the final Senate place`,
        ],
        update.sequence,
        seats,
      );
    } else {
      const headlines = [
        [
          `${number(batch)} more points added to the count`,
          `A fresh batch of ${number(batch)} points is in`,
          `New returns lift the tally to ${number(update.totalPoints)}`,
        ],
        [
          second
            ? `${second.name} is ${number(gap)} points off the lead`
            : `${first.name} is on the tally`,
          `The runner-up's position after ${percent}% reporting`,
          `How the second-placed candidate is faring`,
        ],
        [
          `${percent}% reported as the count moves on`,
          `The count passes ${percent}% reporting`,
          `${number(update.totalPoints)} points have been reported so far`,
        ],
        [
          `${biggestGain.name} makes the biggest gain in this batch`,
          `${biggestGain.name} picks up ${number(biggestGain.gain)} points`,
          `Who gained most in the latest return?`,
        ],
        [
          `${number(remaining)} points still to be reported`,
          `What remains in the count?`,
          `The unreported points still matter`,
        ],
        [
          `${first.name} has ${number(first.points)} points so far`,
          `Inside ${first.name}'s current tally`,
          `The leader's share of reported points`,
        ],
        [
          `${second?.name ?? first.name} adds ${number(second?.gain ?? first.gain)} points`,
          `A closer look at ${second?.name ?? first.name}'s latest return`,
          `The latest batch for the runner-up`,
        ],
        [
          `The gap at the top stands at ${number(gap)} points`,
          `A ${number(gap)}-point difference at the top`,
          `The distance between first and second place`,
        ],
        [
          third
            ? `${third.name} is third on ${number(third.points)} points`
            : `The latest tally for ${first.name}`,
          `Beyond the leading pair`,
          `How the next contender is doing`,
        ],
        [
          `Latest figures take the reported total to ${number(update.totalPoints)}`,
          `Another update in the count`,
          `Where the count stands now`,
        ],
        [
          `${riser.name} gains ${number(riser.gain)} points in the latest return`,
          `Who had the strongest batch?`,
          `New points for ${riser.name}`,
        ],
        [
          `${field} candidates feature in the count`,
          `A look across the field`,
          `The wider field as returns arrive`,
        ],
        [
          `${first.name} has ${share}% of the points reported`,
          `The leader's share of the current count`,
          `What the reported share tells us`,
        ],
        [
          `${gapMovement > 0 ? "Lead widens" : gapMovement < 0 ? "Lead narrows" : "Gap holds steady"} in the latest report`,
          `How the top-two gap has shifted`,
          `The changing distance between the front-runners`,
        ],
        [
          `${last?.name ?? first.name} on the board with ${number(last?.points ?? first.points)} points`,
          `At the other end of the standings`,
          `The latest from the rest of the field`,
        ],
        [
          `${third?.name ?? first.name} adds ${number(third?.gain ?? first.gain)} in this batch`,
          `The latest return for ${third?.name ?? first.name}`,
          `A closer look beyond second place`,
        ],
        [
          `${number(batch)} points arrive in this tranche`,
          `This report's contribution to the count`,
          `What changed with the new figures?`,
        ],
        [
          `No result yet with ${number(remaining)} points outstanding`,
          `The count's next chapter`,
          `What the latest returns do – and do not – show`,
        ],
      ];
      headline = pick(headlines[subject], update.sequence, seats + subject);
    }

    // Each lens changes both the framing of the headline and the reporting
    // in the article, rather than merely swapping a synonym in a template.
    if (!isOpening && !isFinal) {
      const frames = [
        `New return: ${headline}`,
        `At ${percent}% reporting: ${headline}`,
        `With ${number(remaining)} outstanding: ${headline}`,
        `Across ${field} candidates: ${headline}`,
        `In the latest figures: ${headline}`,
        `Since the previous report: ${headline}`,
        `The top-two picture: ${headline}`,
        `Beyond first place: ${headline}`,
        `From the count: ${headline}`,
        `Looking ahead: ${headline}`,
      ];
      headline = frames[lens];
    }

    const angleLeads = [
      `A batch of ${number(batch)} points has arrived, taking the published tally to ${number(update.totalPoints)}.`,
      second
        ? `${second.name} has ${number(second.points)} points in second place, ${number(gap)} fewer than ${first.name}.`
        : `${first.name} has ${number(first.points)} points so far.`,
      `The count has reached ${percent}% of the expected ${number(totalAvailable)} points.`,
      `${biggestGain.name} collected ${number(biggestGain.gain)} of the ${number(batch)} points in this return, the largest gain in the field.`,
      `${number(remaining)} points have not yet been reported, out of ${number(totalAvailable)} expected in total.`,
      `${first.name} currently holds ${number(first.points)} points, or ${share}% of the points published so far.`,
      `${second?.name ?? first.name} picked up ${number(second?.gain ?? first.gain)} points in the newest return.`,
      second
        ? `There are ${number(gap)} points between ${first.name} and ${second.name} in the current count.`
        : `${first.name} is on ${number(first.points)} points.`,
      third
        ? `${third.name} has ${number(third.points)} points in third place, ${number((second?.points ?? 0) - third.points)} behind second.`
        : `${first.name} has ${number(first.points)} points on the board.`,
      `The published total now stands at ${number(update.totalPoints)} points, following a return of ${number(batch)}.`,
      `${riser.name} gained ${number(riser.gain)} points in this tranche. No other candidate gained more.`,
      `${field} candidates appear in the published standings. The newest return adds ${number(batch)} points across the field.`,
      `${first.name}'s ${number(first.points)} points represent ${share}% of the reported tally, not of the final result.`,
      previous
        ? `The gap between first and second has ${gapMovement > 0 ? `grown by ${number(gapMovement)}` : gapMovement < 0 ? `shrunk by ${number(-gapMovement)}` : "not changed"} points since the previous return.`
        : `The opening margin is ${number(gap)} points.`,
      `${last?.name ?? first.name} is on ${number(last?.points ?? first.points)} points at the other end of the current standings.`,
      `${third?.name ?? first.name} gained ${number(third?.gain ?? first.gain)} points in this batch; the published total is now ${number(third?.points ?? first.points)}.`,
      `This tranche contributes ${number(batch)} points to a count that now stands at ${number(update.totalPoints)}.`,
      `These figures cover ${percent}% of the expected points. ${number(remaining)} remain unreported.`,
    ];
    const alternateLeads = [
      `The latest return takes reporting to ${percent}%, with ${number(update.totalPoints)} points now on the board after a batch of ${number(batch)}.`,
      `Counting has reached ${number(update.totalPoints)} points out of ${number(totalAvailable)}; ${number(batch)} of those arrived with this update.`,
      `At this stage, ${percent}% of the points have been reported. This tranche accounts for ${number(batch)} points.`,
      `A further ${number(batch)} points are in, leaving ${number(remaining)} still to be reported.`,
      `${number(update.totalPoints)} points have now been published, equivalent to ${percent}% of the expected total.`,
    ];
    const opening = pick(
      [angleLeads[subject], angleLeads[subject], ...alternateLeads],
      update.sequence,
      subject,
    );
    const lensDetails = [
      `${number(batch)} points came in with this return; ${riser.name} collected ${number(riser.gain)} of them.`,
      `That is ${number(update.totalPoints)} of ${number(totalAvailable)} expected points, or ${percent}% of the count.`,
      `${number(remaining)} points are still outside the published tally, so this is not a final result.`,
      `${field} candidates are on the board; ${last?.name ?? first.name} has ${number(last?.points ?? first.points)} points at the other end of the standings.`,
      `${first.name} has ${share}% of reported points, while ${second?.name ?? first.name} has ${number(second?.points ?? 0)} points.`,
      previous
        ? `${first.name} gained ${number(first.gain)} points since the last report, while ${second?.name ?? first.name} gained ${number(second?.gain ?? 0)}.`
        : `This is the first published batch of ${number(batch)} points.`,
      second
        ? `${second.name} is ${number(gap)} points behind ${first.name}; ${third?.name ?? second.name} has ${number(third?.points ?? second.points)} points.`
        : `${first.name} has ${number(first.points)} points so far.`,
      multiSeat && cutoff && challenger
        ? `${cutoff.name} is ${cutoffGap === 0 ? "level with" : `${number(cutoffGap)} points ahead of`} ${challenger.name} at the provisional seat boundary.`
        : third
          ? `${third.name} stands ${number((second?.points ?? 0) - third.points)} points behind second place.`
          : `${riser.name} gained ${number(riser.gain)} points.`,
      `The published count grew by ${number(batch)} points to ${number(update.totalPoints)}; ${number(remaining)} remain.`,
      `The remaining ${number(remaining)} points could change the standings; the figures above describe what is known now.`,
    ];

    const standings = second
      ? gap === 0
        ? `${first.name} and ${second.name} are level on ${number(first.points)} points in the published count.`
        : pick(
            [
              `${first.name} is on ${number(first.points)}, while ${second.name} has ${number(second.points)}. The gap between them is ${number(gap)} points.`,
              `${second.name} holds ${number(second.points)} points to ${first.name}'s ${number(first.points)}, a difference of ${number(gap)}.`,
              `The top two remain ${first.name} and ${second.name}, separated by ${number(gap)} points in the published returns.`,
              `On the current tally, ${first.name} is ${number(gap)} points ahead of ${second.name}.`,
            ],
            update.sequence,
            index,
          )
      : `${first.name} has ${number(first.points)} points on the published tally.`;

    const other =
      multiSeat && cutoff && challenger
        ? pick(
            [
              `At the last of ${seats} ${isFinal ? "Senate" : "provisional Senate"} places, ${cutoff.name} has ${number(cutoff.points)} points and ${challenger.name} has ${number(challenger.points)}.`,
              `${challenger.name} is ${cutoffGap === 0 ? "level with" : `${number(cutoffGap)} points behind`} ${cutoff.name} at the ${isFinal ? "final" : "provisional"} seat cutoff.`,
              `At the ${isFinal ? "final" : "provisional"} seat boundary, ${cutoff.name} ${cutoffGap === 0 ? "is level with" : "leads"} ${challenger.name}${cutoffGap === 0 ? "" : ` by ${number(cutoffGap)} points`}.`,
              `${ranked
                .slice(0, seats)
                .map((candidate) => candidate.name)
                .join(
                  ", ",
                )} occupy the ${seats} leading places in this ${isFinal ? "completed" : "provisional"} count.`,
            ],
            update.sequence,
            seats,
          )
        : ranked.length > 2
          ? pick(
              [
                `${ranked[2].name} is third on ${number(ranked[2].points)} points, ${number((second?.points ?? 0) - ranked[2].points)} behind second place.`,
                `Behind the leading pair, ${ranked[2].name} has ${number(ranked[2].points)} points in the published count.`,
                `${biggestGain.name} picked up ${number(biggestGain.gain)} points in this tranche, the largest gain among the candidates.`,
              ],
              update.sequence,
              seats,
            )
          : `${biggestGain.name} gained ${number(biggestGain.gain)} points in this tranche.`;

    const context = isFinal
      ? "All expected points have now been reported. These are the final published figures for this count."
      : pick(
          [
            `There are still ${number(remaining)} points outstanding, so the current positions are not final.`,
            `The figures reflect reported points only; ${number(remaining)} have yet to come in.`,
            `With ${number(remaining)} points unreported, later returns could alter the order.`,
            `These are provisional standings until the remaining ${number(remaining)} points are counted.`,
            `The next returns will show whether the ${number(gap)}-point gap at the top holds.`,
            `The points not yet reported represent ${totalAvailable ? Math.round((remaining / totalAvailable) * 100) : 0}% of the expected tally.`,
            `${percent}% reporting describes the progress of the count, not a final share of the result.`,
            `This is a snapshot of the count rather than a declared result.`,
          ],
          update.sequence,
          subject,
        );

    const detail = pick(
      [
        ...(newlyInSeats && displaced
          ? [
              `${newlyInSeats.name} is now in the top ${seats}; ${candidates.find((candidate) => candidate.id === displaced.id)?.name} was in a provisional place at the previous report.`,
            ]
          : []),
        `In the latest batch, ${first.name} added ${number(first.gain)} points and ${second?.name ?? first.name} added ${number(second?.gain ?? 0)}.`,
        `${number(batch)} points arrived with this report; ${number(remaining)} remain outside the published tally.`,
        third
          ? `${third.name} is on ${number(third.points)} points, after gaining ${number(third.gain)} in this tranche.`
          : `${first.name} gained ${number(first.gain)} points in this tranche.`,
        multiSeat && cutoff && challenger
          ? `At the Senate seat boundary, ${cutoff.name} and ${challenger.name} are ${number(cutoffGap)} points apart.`
          : `${riser.name} gained ${number(riser.gain)} points in the latest report.`,
        `Of the ${number(totalAvailable)} expected points, ${number(update.totalPoints)} are now reflected in the standings.`,
        last
          ? `${last.name} has ${number(last.points)} points in the current standings.`
          : `${first.name} has ${number(first.points)} points.`,
      ],
      update.sequence,
      subject + seats,
    );

    return {
      headline,
      paragraphs: [
        `${opening} ${isFinal ? `The last return brought in ${number(batch)} points and completed the count.` : lensDetails[lens]}`,
        `${subject % 3 === 0 ? other : standings} ${subject % 3 === 0 ? standings : other} ${isFinal || subject % 2 ? context : detail}`,
      ],
    };
  });
}
