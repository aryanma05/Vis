import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { docxToLines, pdfToLines } from "@/lib/cv-extract";
import { parseCv } from "@/lib/cv-parser";
import { parseCvLines, parseCvText } from "@/lib/cv-text-parser";

const fixture = (name: string) => new Uint8Array(readFileSync(join(__dirname, "fixtures", name)));
const pdf = async (name: string) => parseCvLines(await pdfToLines(fixture(name)));

const brief = (cv: Awaited<ReturnType<typeof pdf>>) => ({
  experience: cv.experience.map((e) => [e.title, e.organization, e.startDate, e.endDate]),
  education: cv.education.map((e) => [e.institution, e.degree, e.fieldOfStudy, e.startDate, e.endDate]),
});

describe("CV-er fra PDF", () => {
  test("norsk CV med én spalte", async () => {
    const cv = await pdf("cv-no.pdf");
    assert.equal(cv.name, "Ingrid Solberg");
    assert.equal(cv.headline, "Produktdesigner");
    assert.equal(cv.location, "Bergen");
    assert.match(cv.summary ?? "", /^Designer med fem års erfaring/);
    assert.deepEqual(
      cv.links.map((l) => l.label),
      ["LinkedIn", "GitHub"],
    );
    assert.deepEqual(brief(cv), {
      experience: [
        ["Produktdesigner", "Bekk Consulting AS", "2021-08", null],
        ["UX-designer", "Bergen kommune", "2019-01", "2021-07"],
        ["Sommerjobb, frontend-utvikler", "Vipps", "2018", "2018"],
      ],
      education: [
        ["NTNU", "Master", "Interaksjonsdesign", "2017", "2019"],
        ["Universitetet i Bergen", "Bachelor", "Informatikk", "2014", "2017"],
      ],
    });
    assert.equal(cv.experience[0].location, "Oslo");
    assert.equal(cv.experience[0].description?.split("\n").length, 2);
    assert.ok(cv.skills.includes("Universell utforming (WCAG 2.2)"));
    // Språk og referanser er ikke ferdigheter.
    assert.ok(!cv.skills.some((s) => /norsk|oppgis/i.test(s)));
  });

  test("engelsk CV med sidespalte", async () => {
    const cv = await pdf("cv-en2col.pdf");
    assert.equal(cv.name, "Jonas Berg");
    assert.equal(cv.headline, "Full-stack developer");
    assert.equal(cv.location, "Trondheim, Norway");
    assert.deepEqual(cv.links, [{ label: "Nettside", url: "https://www.jonasberg.dev" }]);
    assert.deepEqual(cv.skills, ["TypeScript", "Go", "PostgreSQL", "Docker", "Kubernetes"]);
    assert.deepEqual(brief(cv), {
      experience: [
        ["Senior Developer", "Kantega", "2022-03", null],
        ["Software Engineer", "Sopra Steria", "2019-09", "2022-02"],
      ],
      education: [["Norwegian University of Science and Technology (NTNU)", "MSc", "Computer Science", "2014", "2019"]],
    });
    assert.equal(cv.experience[0].location, "Trondheim");
  });

  test("LinkedIn-eksport over to sider", async () => {
    const cv = await pdf("cv-linkedin.pdf");
    assert.equal(cv.name, "Kari Nordmann");
    assert.equal(cv.location, "Oslo, Norway");
    assert.deepEqual(
      cv.links.map((l) => l.url),
      ["https://www.linkedin.com/in/kari-nordmann-123", "https://github.com/karin"],
    );
    assert.deepEqual(brief(cv), {
      experience: [
        ["Senior Frontend Developer", "Vipps", "2023-01", null],
        ["Frontend Developer", "Vipps", "2021-06", "2022-12"],
        ["Consultant", "Knowit", "2018-08", "2021-05"],
      ],
      education: [
        ["Universitetet i Oslo", "Master's degree", "Informatikk: programmering og systemarkitektur", "2016", "2018"],
        ["Bergen katedralskole", "Studiespesialisering", null, "2010", "2013"],
      ],
    });
    // Brutte linjer i beskrivelsen slås sammen.
    assert.match(cv.experience[2].description ?? "", /Angular and Node\.js in cross-functional teams\.$/);
  });

  test("datoer til høyre på samme linje", async () => {
    const cv = await pdf("cv-rightdates.pdf");
    assert.equal(cv.name, "Ola Hansen");
    assert.equal(cv.headline, "Systemutvikler");
    assert.equal(cv.location, "Trondheim");
    assert.deepEqual(brief(cv).experience, [
      ["Systemutvikler", "Equinor ASA", "2020", null],
      ["Konsulent", "Itera", "2017", "2020"],
      ["Lærervikar", "Strinda videregående skole", "2015", "2017"],
    ]);
    assert.deepEqual(cv.skills, ["C#", "Java", "Python", "SQL", "Azure", "Docker", "Git"]);
  });

  test("datoer i egen spalte til venstre og sperrede overskrifter", async () => {
    const cv = await pdf("cv-leftdates.pdf");
    assert.equal(cv.name, "Maja Lie");
    assert.deepEqual(cv.links, [{ label: "Behance", url: "https://behance.net/majalie" }]);
    assert.deepEqual(brief(cv), {
      experience: [
        ["Art director", "Kitchen Design Byrå AS", "2021", null],
        ["Grafisk designer", "Stavanger Aftenblad", "2018", "2021"],
      ],
      education: [["Høyskolen Kristiania", "Bachelor", "Visuell kommunikasjon", "2015", "2018"]],
    });
    assert.deepEqual(cv.skills, ["Adobe Illustrator", "Photoshop", "InDesign", "Figma", "Procreate"]);
  });
});

describe("CV-er fra Word", () => {
  test("student-CV med kulepunkter", async () => {
    const cv = parseCvLines(await docxToLines(fixture("cv-student.docx")));
    assert.equal(cv.name, "Sara Ahmed");
    assert.equal(cv.headline, "Informatikkstudent ved UiO");
    assert.equal(cv.location, "Oslo");
    assert.deepEqual(
      cv.links.map((l) => l.url),
      ["https://github.com/saraahmed", "https://saraahmed.no"],
    );
    assert.deepEqual(brief(cv), {
      experience: [
        ["Butikkmedarbeider", "Kiwi Majorstuen", "2020-06", null],
        ["Gruppelærer i IN1000", "Universitetet i Oslo", "2022", "2023"],
      ],
      education: [["Universitetet i Oslo", "Bachelor", "Informatikk: programmering og systemarkitektur", "2021", "2024"]],
    });
    assert.deepEqual(cv.skills, ["Python", "Java", "Kotlin", "Git", "Figma"]);
  });
});

describe("tolkeren", () => {
  test("datoformater", () => {
    const cv = parseCvText(
      [
        "Erfaring",
        "Utvikler, A AS",
        "08.2020 – 12.2021",
        "Utvikler, B AS",
        "2019-03 - 2020-07",
        "Utvikler, C AS",
        "Siden 2022",
        "Utvikler, D AS",
        "jan 2015 til des. 2016",
      ].join("\n"),
    );
    assert.deepEqual(
      cv.experience.map((e) => [e.organization, e.startDate, e.endDate]),
      [
        ["A AS", "2020-08", "2021-12"],
        ["B AS", "2019-03", "2020-07"],
        ["C AS", "2022", null],
        ["D AS", "2015-01", "2016-12"],
      ],
    );
  });

  test("årstall inne i en setning lager ikke en ny oppføring", () => {
    const cv = parseCvText(
      ["Erfaring", "Designer, Vipps", "2019 – 2021", "Vant intern designpris i 2020", "Tok over teamet etter 2020"].join("\n"),
    );
    assert.equal(cv.experience.length, 1);
    assert.equal(cv.experience[0].description, "Vant intern designpris i 2020\nTok over teamet etter 2020");
  });

  test("teknologinavn blir ikke lenker", () => {
    const cv = parseCvText(["Per Olsen", "Utvikler", "Bruker Node.js, Vue.js og ASP.NET hver dag, f.eks. i socket.io-prosjekter."].join("\n"));
    assert.deepEqual(cv.links, []);
  });

  test("ingen ferdighetsseksjon: kjente verktøy hentes fra teksten", () => {
    const cv = parseCvText(["Erfaring", "Utvikler hos Bekk", "2020 – nå", "Laget apper i React og TypeScript med PostgreSQL."].join("\n"));
    assert.deepEqual(cv.skills, ["TypeScript", "React", "PostgreSQL"]);
  });

  test("finner ikke på noe når teksten ikke er en CV", () => {
    const cv = parseCvText("Handleliste\nMelk\nBrød\nEgg");
    assert.deepEqual(cv.experience, []);
    assert.deepEqual(cv.education, []);
    assert.deepEqual(cv.links, []);
  });
});

describe("parseCv", () => {
  test("avviser bilder med en forklaring", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    await assert.rejects(parseCv({ name: "cv.png", type: "image/png", bytes: png }), /PDF/);
  });

  test("avviser ukjente filtyper", async () => {
    await assert.rejects(parseCv({ name: "cv.txt", type: "text/plain", bytes: new TextEncoder().encode("hei") }), /PDF eller Word/);
  });

  test("leser en PDF hele veien", async () => {
    const cv = await parseCv({ name: "cv.pdf", type: "application/pdf", bytes: fixture("cv-no.pdf") });
    assert.equal(cv.experience.length, 3);
  });
});
