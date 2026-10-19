import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { CV_SECTIONS, cvSectionOrder } from "@/lib/constants";

describe("rekkefølgen på CV-en", () => {
  test("uten lagret rekkefølge brukes standarden", () => {
    assert.deepEqual(cvSectionOrder(null), [...CV_SECTIONS]);
  });

  test("lagret rekkefølge beholdes, og manglende deler legges til sist", () => {
    assert.deepEqual(cvSectionOrder(["skills", "experience"]), ["skills", "experience", "summary", "education", "projects"]);
  });

  test("ukjente og doble deler fjernes", () => {
    assert.deepEqual(cvSectionOrder(["projects", "hobbyer", "projects", "summary"]), ["projects", "summary", "experience", "education", "skills"]);
  });
});
