import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  assignableRoles,
  can,
  CAN,
  canManageMember,
  COMPANY_ACTIONS,
  COMPANY_ROLES,
  TERMS_ACTIONS,
  TWO_FACTOR_EXEMPT,
  type CompanyAction,
  type CompanyRole,
} from "@/lib/company-permissions";
import { findSensitiveTerms } from "@/lib/fair-hiring";

// Matrisen slik den står i spesifikasjonen: E = eier, A = admin, R = rekrutterer, V = vurderer.
const MATRIX: [string, CompanyAction[]][] = [
  ["EARV", ["company.view", "members.view", "applications.view", "jobs.draft", "challenges.view"]],
  ["EARV", ["notes.write", "reviews.write"]],
  ["EAR", ["applications.contactDetails", "jobs.publish"]],
  [
    "EAR",
    [
      "applications.move",
      "applications.bulk",
      "applications.hire",
      "templates.manage",
      "interviews.manage",
      "reviews.criteria",
      "candidates.search",
      "candidates.contact",
      "lists.edit",
      "searches.manage",
    ],
  ],
  [
    "EA",
    [
      "company.edit",
      "company.privacy",
      "company.billing",
      "members.invite",
      "members.manage",
      "audit.view",
      "jobs.delete",
      "lists.delete",
      "challenges.manage",
      "webhooks.view",
    ],
  ],
  ["EA", ["lists.export", "audit.export", "webhooks.manage"]],
  ["E", ["company.security", "company.delete", "members.grantAdmin"]],
];
const LETTER: Record<CompanyRole, string> = { owner: "E", admin: "A", member: "R", reviewer: "V" };

describe("roller og tilgang", () => {
  test("hver handling i matrisen, og ingen andre", () => {
    const listed = MATRIX.flatMap(([, actions]) => actions);
    assert.deepEqual([...listed].sort(), [...COMPANY_ACTIONS].sort());
    assert.deepEqual(Object.keys(CAN).sort(), [...COMPANY_ACTIONS].sort());
  });

  test("hele matrisen: riktig rolle får lov, alle andre ikke", () => {
    for (const [roles, actions] of MATRIX) {
      for (const action of actions) {
        for (const role of COMPANY_ROLES) {
          assert.equal(can(role, action), roles.includes(LETTER[role]), `${role} / ${action}`);
        }
      }
    }
  });

  test("uten rolle får man ingenting", () => {
    for (const action of COMPANY_ACTIONS) {
      assert.equal(can(null, action), false);
      assert.equal(can(undefined, action), false);
    }
  });

  test("vurderere får aldri kontaktinfo, sender ingen meldinger og søker ikke etter kandidater", () => {
    for (const action of ["applications.contactDetails", "candidates.contact", "candidates.search", "applications.move"] as const) {
      assert.equal(can("reviewer", action), false, action);
    }
  });

  test("databehandleravtale og tofaktor gjelder de riktige handlingene", () => {
    assert.deepEqual([...TERMS_ACTIONS].sort(), ["candidates.contact", "candidates.search", "jobs.publish"]);
    assert.deepEqual([...TWO_FACTOR_EXEMPT].sort(), ["company.view", "members.view"]);
  });

  test("hvem kan gi hvilke roller", () => {
    assert.deepEqual(assignableRoles("owner"), ["admin", "member", "reviewer"]);
    assert.deepEqual(assignableRoles("admin"), ["member", "reviewer"]);
    assert.deepEqual(assignableRoles("member"), []);
    assert.deepEqual(assignableRoles("reviewer"), []);
    assert.deepEqual(assignableRoles(null), []);
    for (const role of COMPANY_ROLES) assert.ok(!assignableRoles(role).includes("owner"), "eierskap gis bare ved overføring");
  });

  test("ingen rører eieren, bare eieren rører en administrator", () => {
    for (const actor of COMPANY_ROLES) assert.equal(canManageMember(actor, "owner", false), false, actor);
    assert.equal(canManageMember("owner", "owner", true), false, "eieren kan ikke fjerne seg selv");
    assert.equal(canManageMember("owner", "admin", false), true);
    assert.equal(canManageMember("admin", "admin", false), false);
    assert.equal(canManageMember("member", "admin", false), false);
  });

  test("administratorer endrer rekrutterere og vurderere; andre roller kan ikke endre noen", () => {
    for (const target of ["member", "reviewer"] as const) {
      assert.equal(canManageMember("owner", target, false), true);
      assert.equal(canManageMember("admin", target, false), true);
      assert.equal(canManageMember("member", target, false), false);
      assert.equal(canManageMember("reviewer", target, false), false);
    }
    assert.equal(canManageMember(null, "member", false), false);
    assert.equal(canManageMember("owner", null, false), false);
  });

  test("alle unntatt eieren kan fjerne seg selv", () => {
    assert.equal(canManageMember("admin", "admin", true), true);
    assert.equal(canManageMember("member", "member", true), true);
    assert.equal(canManageMember("reviewer", "reviewer", true), true);
  });
});

describe("rettferdig ansettelse", () => {
  test("finner sensitive ord, med bøyninger og store bokstaver", () => {
    assert.deepEqual(findSensitiveTerms("Hun nevnte at hun er gravid og har barneplaner."), ["gravid", "barneplaner"]);
    assert.deepEqual(findSensitiveTerms("RELIGIØS bakgrunn, og alderen hans"), ["religiøs", "alderen"]);
    assert.deepEqual(findSensitiveTerms("Spurte om graviditet, svangerskap og familieplanlegging"), ["graviditet", "svangerskap", "familieplanlegging"]);
    assert.deepEqual(
      findSensitiveTerms("etnisitet, hudfarge, funksjonsnedsettelse, diagnose, sykdom, helse, legning, homofil, kjønnsidentitet, fagforening, politisk"),
      ["etnisitet", "hudfarge", "funksjonsnedsettelse", "diagnose", "sykdom", "helse", "legning", "homofil", "kjønnsidentitet", "fagforening", "politisk"],
    );
  });

  test("hele ord: deler av lengre ord gir ingen advarsel", () => {
    assert.deepEqual(findSensitiveTerms("Vi tilbyr helseforsikring og en god pensjonsordning."), []);
    assert.deepEqual(findSensitiveTerms("Sterk i TypeScript, god kommunikasjon og lærevillig."), []);
    assert.deepEqual(findSensitiveTerms("Alderstrinn og politiker"), []);
  });

  test("hvert ord én gang, og tomt gir tomt", () => {
    assert.deepEqual(findSensitiveTerms("Helse, helse og HELSE"), ["helse"]);
    assert.deepEqual(findSensitiveTerms(""), []);
    assert.deepEqual(findSensitiveTerms(null), []);
  });
});
