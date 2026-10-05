import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ACHIEVEMENT_BY_KEY, ACHIEVEMENTS, goalText, tierFor } from "@/lib/achievement-defs";
import { PET_ACCESSORIES } from "@/lib/profile-style";
import { bannerConfig, petConfig } from "@/lib/validation";

describe("prestasjoner", () => {
  test("nøklene er unike og nivåene stiger", () => {
    assert.equal(ACHIEVEMENT_BY_KEY.size, ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) {
      assert.ok(a.tiers.length >= 1 && a.tiers.length <= 4, a.key);
      assert.deepEqual([...a.tiers].sort((x, y) => x - y), a.tiers, a.key);
    }
  });

  test("nivået følger grensene", () => {
    const builder = ACHIEVEMENT_BY_KEY.get("byggmester")!;
    assert.equal(tierFor(builder, 2), 0);
    assert.equal(tierFor(builder, 3), 1);
    assert.equal(tierFor(builder, 24), 2);
    assert.equal(tierFor(builder, 25), 3);
    assert.equal(tierFor(builder, 999), 4);
  });

  test("målet bruker entall når tallet er 1", () => {
    const team = ACHIEVEMENT_BY_KEY.get("lagspiller")!;
    assert.deepEqual(goalText(team, 1), { text: team.goalOne, n: 1 });
    assert.deepEqual(goalText(team, 2), { text: team.goal, n: 3 });
  });

  test("tilbehør som må låses opp, peker på merker som finnes", () => {
    for (const [key, accessory] of Object.entries(PET_ACCESSORIES)) {
      const requires = (accessory as { requires?: { key: string; tier: number } }).requires;
      if (!requires) continue;
      const def = ACHIEVEMENT_BY_KEY.get(requires.key);
      assert.ok(def, key);
      assert.ok(requires.tier <= def.tiers.length, key);
    }
  });
});

describe("banner og kjæledyr", () => {
  test("ugyldige verdier avvises", () => {
    assert.equal(bannerConfig.safeParse({ type: "color", color: "red" }).success, false);
    assert.equal(bannerConfig.safeParse({ type: "art", art: "finnes-ikke" }).success, false);
    assert.equal(petConfig.safeParse({ species: "drage", color: "gull" }).success, false);
  });

  test("gyldige verdier normaliseres", () => {
    assert.deepEqual(bannerConfig.parse({ type: "pattern", pattern: "prikker", color: "#ABCDEF" }), { type: "pattern", pattern: "prikker", color: "#abcdef" });
    assert.deepEqual(bannerConfig.parse({ type: "image", url: "/filer/x.webp", y: 33.6 }), { type: "image", url: "/filer/x.webp", y: 34 });
    assert.deepEqual(petConfig.parse({ species: "rev", color: "oransje", name: "  Pixel " }), { species: "rev", color: "oransje", accessory: "ingen", name: "Pixel" });
  });
});
