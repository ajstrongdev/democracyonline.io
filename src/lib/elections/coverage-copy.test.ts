import { describe, expect, it } from "vitest";
import { writeElectionCoverage } from "./coverage-copy";
import { generateElectionNightPlan } from "./reveal";

const candidates = [
  { id: 1, name: "Ada", total: 800 },
  { id: 2, name: "Grace", total: 700 },
  { id: 3, name: "Alan", total: 500 },
];

describe("election night coverage", () => {
  it("writes varied, factual articles throughout a 12-hour count", () => {
    const plan = generateElectionNightPlan(candidates, {
      seed: "coverage",
      startsAt: new Date("2026-09-20T19:00:00Z"),
      durationMs: 12 * 60 * 60 * 1000,
    });
    const articles = writeElectionCoverage(plan, candidates, 1, 2000);

    expect(articles).toHaveLength(144);
    expect(articles.every((article) => article.paragraphs.length === 2)).toBe(
      true,
    );
    expect(
      new Set(articles.map((article) => article.headline)).size,
    ).toBeGreaterThan(70);
    expect(
      new Set(
        articles.map((article) => article.headline.replace(/[\d,.]+/g, "#")),
      ).size,
    ).toBeGreaterThan(35);
    expect(articles.some((article) => article.headline.includes("Grace"))).toBe(
      true,
    );
    expect(articles.some((article) => article.headline.includes("Alan"))).toBe(
      true,
    );
    expect(articles.at(-1)?.paragraphs.join(" ")).toContain(
      "final published figures",
    );
    expect(writeElectionCoverage(plan, candidates, 1, 2000)).toEqual(articles);
  });

  it("draws from 180 subject-and-lens combinations before cycling", () => {
    const plan = generateElectionNightPlan(candidates, {
      seed: "full-editorial-deck",
      startsAt: new Date("2026-09-20T19:00:00Z"),
      durationMs: 12 * 60 * 60 * 1000,
      updateCount: 180,
    });
    const articles = writeElectionCoverage(plan, candidates, 1, 2000);
    expect(articles).toHaveLength(180);
    expect(
      new Set(
        articles
          .slice(1, -1)
          .map((article) => article.headline.replace(/[\d,.]+/g, "#")),
      ).size,
    ).toBeGreaterThan(140);
  });

  it("reports the Senate seat boundary, not just the leader", () => {
    const updates = [
      {
        sequence: 1,
        type: "OPENING",
        totalPoints: 30,
        cumulativeTotals: { "1": 12, "2": 10, "3": 8 },
      },
      {
        sequence: 2,
        type: "UPDATE",
        totalPoints: 60,
        cumulativeTotals: { "1": 24, "2": 19, "3": 17 },
      },
    ];
    const articles = writeElectionCoverage(updates, candidates, 2, 100);
    expect(articles[1].paragraphs.join(" ")).toContain("Grace");
    expect(articles[1].paragraphs.join(" ")).toContain("Alan");
    expect(articles[1].paragraphs.join(" ")).toContain("2");
    expect(articles[1].paragraphs.join(" ")).toContain("40 points unreported");
  });

  it("does not infer outcomes from unrevealed totals", () => {
    const updates = [
      {
        sequence: 1,
        type: "OPENING",
        totalPoints: 10,
        cumulativeTotals: { "1": 6, "2": 4 },
      },
    ];
    const articles = writeElectionCoverage(
      updates,
      candidates.slice(0, 2),
      1,
      100,
    );
    expect(articles[0].paragraphs.join(" ")).toContain("90");
    expect(articles[0].paragraphs.join(" ")).not.toContain("700");
  });

  it("notices when a Senate candidate enters the provisional seats", () => {
    const updates = [
      {
        sequence: 1,
        type: "OPENING",
        totalPoints: 30,
        cumulativeTotals: { "1": 15, "2": 10, "3": 5 },
      },
      {
        sequence: 2,
        type: "UPDATE",
        totalPoints: 60,
        cumulativeTotals: { "1": 25, "2": 16, "3": 19 },
      },
    ];
    const articles = writeElectionCoverage(updates, candidates, 2, 100);
    expect(articles[1].headline).toMatch(/Alan|top 2/);
    expect(articles[1].paragraphs.join(" ")).toContain("Alan");
  });
});
