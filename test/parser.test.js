// Tests for the HTML parser in telekom-data-usage.js. Run with: node --test
//
// The widget is a single Scriptable file, so it can't be imported. Instead the
// code between "// #region parser" and "// #endregion parser" is loaded into
// a sandbox. That part must not use Scriptable APIs.
//
// Fixtures, all saved on 2026-11-13 from datapass.de/home?lang=de / ?lang=en:
// - datapass-telekom-*.html: over the Telekom mobile network. Booking tokens
//   (crt=…) and the pass ID are redacted. The English countdown seconds are
//   set from 43 to 42 to match the German page, saved a second later.
// - datapass-wifi-*.html: over WiFi ("needs a mobile network connection").
// - datapass-congstar-de.html: saved on 2026-11-14 over the congstar network.
//   congstar ignores ?lang=en, so there is no English page. Booking tokens and
//   the pass ID are redacted.
// - datapass-fraenk-de.html: saved on 2026-11-15 over the fraenk network.
//   fraenk ignores ?lang=en too. Booking tokens and the pass IDs are redacted.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadParser() {
  const file = path.join(__dirname, "..", "telekom-data-usage.js");
  const src = fs.readFileSync(file, "utf8");
  const m = src.match(/\/\/ #region parser\n([\s\S]*?)\/\/ #endregion parser/);
  assert.ok(m, "parser region markers not found in telekom-data-usage.js");
  const sandbox = {};
  vm.runInNewContext(
    m[1] +
      "\nthis.parseUsageFromHtml = parseUsageFromHtml;" +
      "\nthis.parseNumber = parseNumber;" +
      "\nthis.GIGABYTE = GIGABYTE; this.MEGABYTE = MEGABYTE;",
    sandbox
  );
  return sandbox;
}

const { parseUsageFromHtml, parseNumber, GIGABYTE, MEGABYTE } =
  loadParser();

const fixture = (name) =>
  fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8");
const DE = fixture("datapass-telekom-de.html");
const EN = fixture("datapass-telekom-en.html");
const CONGSTAR = fixture("datapass-congstar-de.html");
const FRAENK = fixture("datapass-fraenk-de.html");

// The fixtures say the volume ends at 1796079599000 (30.11.2026 23:59:59 CET)
// and the German page showed "17 Tage 01 Std. 29 Min. 42 Sek." left.
const VALID_UNTIL = 1796079599000;
const REMAINING = 17 * 86400 + 1 * 3600 + 29 * 60 + 42;
const NOW = VALID_UNTIL - REMAINING * 1000;

function assertUsage(result, expected) {
  assert.equal(result.passName, expected.passName);
  assert.ok(
    Math.abs(result.initialVolume - expected.initialVolume) < 1,
    `initialVolume ${result.initialVolume}`
  );
  assert.ok(
    Math.abs(result.usedVolume - expected.usedVolume) < 1,
    `usedVolume ${result.usedVolume}`
  );
  assert.equal(result.usedPercentage, expected.usedPercentage);
  assert.equal(result.remainingSeconds, expected.remainingSeconds);
}

const TELEKOM_EXPECTED = {
  initialVolume: 30 * GIGABYTE,
  usedVolume: (30 - 29.28) * GIGABYTE,
  usedPercentage: 2,
  remainingSeconds: REMAINING,
};

test("German Telekom page", () => {
  assertUsage(parseUsageFromHtml(DE, NOW), {
    ...TELEKOM_EXPECTED,
    passName: "Inklusivvolumen (Inland und EU)",
  });
});

test("English Telekom page", () => {
  assertUsage(parseUsageFromHtml(EN, NOW), {
    ...TELEKOM_EXPECTED,
    passName: "Inclusive volume (domestic and EU)",
  });
});

test("expired volume gives 0 seconds, not a negative value", () => {
  const r = parseUsageFromHtml(DE, VALID_UNTIL + 3600 * 1000);
  assert.equal(r.remainingSeconds, 0);
});

test("reads the countdown text when the countdown script is missing", () => {
  for (const page of [DE, EN]) {
    const html = page.replace(/updateCountdown\([^)]*\)/, "");
    assert.equal(parseUsageFromHtml(html, NOW).remainingSeconds, REMAINING);
  }
});

test("congstar page: validity from the end date, no countdown", () => {
  // "Gültig bis: 09. Dezember 2026", end of that day in local time
  const end = new Date(2026, 11, 9, 23, 59, 59).getTime();
  const now = end - 25 * 86400 * 1000;
  const r = parseUsageFromHtml(CONGSTAR, now);
  assertUsage(r, {
    passName: "Dein Datenvolumen",
    initialVolume: 7 * GIGABYTE,
    usedVolume: (7 - 6.97) * GIGABYTE,
    usedPercentage: 0,
    remainingSeconds: 25 * 86400,
  });
  assert.deepEqual({ ...r.parsedFrom }, { volume: "markup", validity: "date", name: "markup" });
});

test("fraenk page: extra data card first, used-up base volume below", () => {
  // The countdown script says the extra data ends at 1796832715000, and the
  // page showed "23 Tage 23 Std. 04 Min. 50 Sek." left.
  const remaining = 23 * 86400 + 23 * 3600 + 4 * 60 + 50;
  const r = parseUsageFromHtml(FRAENK, 1796832715000 - remaining * 1000);
  assertUsage(r, {
    passName: "5 GB Extra-Daten",
    initialVolume: 5 * GIGABYTE,
    usedVolume: (5 - 3.49) * GIGABYTE,
    usedPercentage: 30,
    remainingSeconds: remaining,
  });
  assert.deepEqual({ ...r.parsedFrom }, { volume: "markup", validity: "script", name: "markup" });
});

test("offers below the pass card are not taken as the validity", () => {
  // Without the "Letzte Aktualisierung" block, "für 24 Stunden" from the first
  // offer would be right after the volume.
  const html = CONGSTAR
    .replace(/<div class="last-update">[\s\S]*?Uhr\s*<\/div>/, "")
    .replace(/Gültig bis:\s[^<]*/, "");
  assert.ok(!/Letzte Aktualisierung|Gültig bis/.test(html), "test setup");
  assert.equal(parseUsageFromHtml(html, NOW).remainingSeconds, null);
});

test("end date with a numeric month", () => {
  const html = "<div>6,97 / 7 GB</div><div>Gültig bis: 09.12.2026</div>";
  const end = new Date(2026, 11, 9, 23, 59, 59).getTime();
  assert.equal(parseUsageFromHtml(html, end - 3600 * 1000).remainingSeconds, 3600);
});

test("promo text before the usage card doesn't win over the markup", () => {
  const promo = "<p>Jetzt 5 / 10 GB extra buchen, 24 Std. gültig</p>";
  const html = DE.replace('<div id="content"', promo + '<div id="content"');
  assertUsage(parseUsageFromHtml(html, NOW), {
    ...TELEKOM_EXPECTED,
    passName: "Inklusivvolumen (Inland und EU)",
  });
});

test("text fallback (fraenk-style page without the Telekom markup)", () => {
  const html =
    "<h1>Deine fraenk flat</h1>" +
    "<script>var cfg = { timeout: '5 min' };</script>" +
    "<div>35,93&nbsp;/&nbsp;36 GB</div>" +
    "<span>verbleibend für 12 Tage 4 Std. 30 Min.</span>" +
    "<p>DayFlat für 24 Std.</p>";
  assertUsage(parseUsageFromHtml(html, NOW), {
    passName: "Deine fraenk flat",
    initialVolume: 36 * GIGABYTE,
    usedVolume: (36 - 35.93) * GIGABYTE,
    usedPercentage: 0,
    remainingSeconds: 12 * 86400 + 4 * 3600 + 30 * 60,
  });
});

test("text fallback in English", () => {
  const html =
    '<html lang="en"><div>29.28 / 30 GB</div>' +
    "<span>remaining for 17 days 01 hours 29 min.</span>";
  const r = parseUsageFromHtml(html, NOW);
  assert.ok(Math.abs(r.usedVolume - 0.72 * GIGABYTE) < 1, `usedVolume ${r.usedVolume}`);
  assert.equal(r.remainingSeconds, 17 * 86400 + 3600 + 29 * 60);
  assert.equal(r.passName, "Datenvolumen");
});

test("MB volumes with thousands separators", () => {
  const html =
    '<html lang="de"><div class="remaining-volume-value">512</div>' +
    '<div class="start-volume">1.024</div><div class="volume-unit">MB</div>';
  const r = parseUsageFromHtml(html, NOW);
  assert.ok(Math.abs(r.initialVolume - 1024 * MEGABYTE) < 1);
  assert.equal(r.usedPercentage, 50);
});

test("missing validity gives null instead of a date in the past", () => {
  const r = parseUsageFromHtml("<div>29,28 / 30 GB</div>", NOW);
  assert.equal(r.remainingSeconds, null);
});

// The sandbox has its own Error class, so check the kind instead of instanceof.
const errorOfKind = (kind) => (err) => {
  assert.equal(err.kind, kind, String(err));
  return true;
};

test("WiFi page throws an offline error, so the widget shows the WiFi icon", () => {
  for (const name of ["datapass-wifi-de.html", "datapass-wifi-en.html"]) {
    assert.throws(() => parseUsageFromHtml(fixture(name), NOW), errorOfKind("offline"), name);
  }
});

test("usage page with a changed layout is unrecognized, not offline", () => {
  // Simulates a redesign: no volume markup and no "x / y GB" text left.
  for (const page of [DE, EN]) {
    const html = page
      .replace(/remaining-volume-value|start-volume|volume-unit/g, "changed")
      .replace(/\bGB\b/g, "Gigabyte");
    assert.throws(() => parseUsageFromHtml(html, NOW), errorOfKind("unrecognized"));
  }
});

test("implausible volume is unrecognized instead of saved as junk", () => {
  assert.throws(
    () => parseUsageFromHtml("<div>5 / 0 GB</div>", NOW),
    errorOfKind("unrecognized")
  );
});

test("parsedFrom reports which method found each value", () => {
  const from = (html) => ({ ...parseUsageFromHtml(html, NOW).parsedFrom });
  assert.deepEqual(from(DE), { volume: "markup", validity: "script", name: "markup" });
  assert.deepEqual(from(DE.replace(/updateCountdown\([^)]*\)/, "")), {
    volume: "markup",
    validity: "text",
    name: "markup",
  });
  assert.deepEqual(
    from("<h1>Deine fraenk flat</h1><div>35,93 / 36 GB</div><span>12 Tage</span>"),
    { volume: "text", validity: "text", name: "text" }
  );
  assert.deepEqual(from("<div>29,28 / 30 GB</div>"), {
    volume: "text",
    validity: "none",
    name: "default",
  });
});

test("parseNumber follows the page language", () => {
  const german = { "29,28": 29.28, "30": 30, "1.024": 1024, "1.024,5": 1024.5 };
  const english = { "29.28": 29.28, "30": 30, "1,024": 1024, "1,024.5": 1024.5 };
  for (const [input, expected] of Object.entries(german)) {
    assert.equal(parseNumber(input, ","), expected, input);
  }
  for (const [input, expected] of Object.entries(english)) {
    assert.equal(parseNumber(input, "."), expected, input);
  }
});
