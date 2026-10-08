import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DEFAULT_TEMPLATES, MERGE_FIELDS, renderMessage, renderSubject, renderTemplate, TEMPLATE_KINDS } from "@/lib/template-render";

const vars = { fornavn: "Kari", navn: "Kari Nordmann", stilling: "Frontend-utvikler", bedrift: "Fjordkode", svartid: 14, bookinglenke: "https://vis.no/soknader/1/book" };

describe("svarmaler", () => {
  test("flettefeltene fylles inn", () => {
    const out = renderTemplate("Hei {fornavn} ({navn})!\nOm {stilling} hos {bedrift}: svar innen {svartid} dager. {bookinglenke}", vars);
    assert.equal(out, "Hei Kari (Kari Nordmann)!\nOm Frontend-utvikler hos Fjordkode: svar innen 14 dager. https://vis.no/soknader/1/book");
    assert.equal(renderSubject("{bedrift} vil gjerne snakke med deg", vars), "Fjordkode vil gjerne snakke med deg");
  });

  test("en linje med tomt flettefelt fjernes, uten doble tomrom", () => {
    const body = "Hei {fornavn}!\n\nVelg en tid her: {bookinglenke}\n\nHilsen {bedrift}";
    assert.equal(renderTemplate(body, { ...vars, bookinglenke: "" }), "Hei Kari!\n\nHilsen Fjordkode");
    assert.equal(renderTemplate(body, { ...vars, bookinglenke: null }), "Hei Kari!\n\nHilsen Fjordkode");
    assert.equal(renderTemplate("Svar innen {svartid} dager.\nTakk!", { svartid: "  " }), "Takk!");
    // Emnet mister bare feltet, ikke hele linjen.
    assert.equal(renderSubject("Søknaden på {stilling} hos {bedrift}", { stilling: "Designer" }), "Søknaden på Designer hos");
  });

  test("ukjente felt står som de er", () => {
    assert.equal(renderTemplate("Hei {fornavn}, {ukjent} og {Fornavn}", vars), "Hei Kari, {ukjent} og {Fornavn}");
    assert.equal(renderTemplate("{ukjent}\nLinje to", {}), "{ukjent}\nLinje to");
  });

  test("ingen HTML slipper gjennom, verken fra malen eller fra navnet", () => {
    const out = renderTemplate('<b>Hei</b> {fornavn}!\n<script>alert(1)</script>\n<a href="x">lenke</a> <img src=x onerror=y>', {
      fornavn: "<img src=x onerror=alert(1)>Kari",
    });
    assert.doesNotMatch(out, /<[a-z/!]/i);
    assert.match(out, /Hei Kari!/);
    assert.equal(renderSubject("Til <i>{navn}</i>", { navn: "<b>Ola</b>" }), "Til Ola");
    // Vanlige tegn som < og > i tekst er greit (mailer escaper dem).
    assert.equal(renderTemplate("3 < 5 og 7 > 2", {}), "3 < 5 og 7 > 2");
  });

  test("standardmalene finnes for alle typer og bruker bare kjente felt", () => {
    for (const kind of TEMPLATE_KINDS) {
      const t = DEFAULT_TEMPLATES[kind];
      assert.ok(t.name && t.subject && t.body, kind);
      for (const [, name] of `${t.subject}\n${t.body}`.matchAll(/\{(\w+)\}/g)) assert.ok((MERGE_FIELDS as readonly string[]).includes(name), `${kind}: {${name}}`);
      const rendered = renderMessage(t, vars);
      assert.doesNotMatch(`${rendered.subject}\n${rendered.body}`, /\{\w+\}/);
    }
    // Uten ledige intervjutider forsvinner booking-linjen i intervjumalen.
    assert.doesNotMatch(renderTemplate(DEFAULT_TEMPLATES.intervju.body, { ...vars, bookinglenke: "" }), /Velg en tid/);
  });
});
