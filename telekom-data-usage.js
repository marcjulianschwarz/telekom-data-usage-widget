// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: purple; icon-glyph: magic;

//########## SETUP ###########

const BACKGROUND_COLOR = Color.dynamic(
  new Color("#ffffff"),
  new Color("#161618")
);
const TELEKOM_COLOR = new Color("#ea0a8e");
const TEXT_COLOR = Color.dynamic(new Color("000000"), new Color("#ffffff"));

//########## END OF SETUP ##########

// The Telekom/fraenk data portal no longer exposes a JSON API.
// It now renders the usage values into the HTML of the status page.
// We fetch that page and parse the values with the parser below. The page
// follows the browser language, so we ask for German explicitly.
const pageURL = "https://datapass.de/home?lang=de";
const imgURL =
  "https://raw.githubusercontent.com/marcjulianschwarz/telekom-data-usage-widget/main/symbols/";

let parameters = await args.widgetParameter;
if (parameters != null) {
  parameters = parameters.toLowerCase();
} else {
  parameters = "icloud";
}

let widgetSize = config.widgetFamily;

// iCloud unless "local" is set
const useICloud = !parameters.includes("local");
let fm = useICloud ? FileManager.iCloud() : FileManager.local();

let dir = fm.joinPath(fm.documentsDirectory(), "telekom-widget");
let path = fm.joinPath(dir, "telekom-data.json");
if (!fm.fileExists(dir)) {
  fm.createDirectory(dir);
}

// Why fresh data couldn't be loaded: not on the mobile network (wifi), or the
// page loaded but wasn't recognized (layout changed or unknown brand).
let wifi = false;
let pageUnrecognized = false;
let df = new DateFormatter();
df.useShortDateStyle();

// FONTS USED BY THE WIDGET
let thin_font = Font.regularRoundedSystemFont(13);
let small_font = Font.regularRoundedSystemFont(11);
let bold_font = Font.heavyRoundedSystemFont(13);
let title_font = Font.heavyRoundedSystemFont(11);

if (widgetSize == "medium") {
  thin_font = Font.regularRoundedSystemFont(15);
  small_font = Font.regularRoundedSystemFont(13);
  bold_font = Font.heavyRoundedSystemFont(15);
  title_font = Font.heavyRoundedSystemFont(17);
}

// HELPER CLASS
class Telekom {
  constructor(
    name,
    usedVolume,
    initialVolume,
    remainingVolume,
    usedPercentage,
    validUntil,
    usedAt
  ) {
    this.name = name;
    this.usedVolume = usedVolume;
    this.initialVolume = initialVolume;
    this.remainingVolume = remainingVolume;
    this.usedPercentage = usedPercentage;
    this.validUntil = validUntil;
    this.usedAt = usedAt;
  }
}

// HELPER FUNCTION TO CALCULATE DAYS AND HOURS FOR VALIDUNTIL
function getDaysHours(data) {
  now = new Date(Date.now());
  hours_total = (data.validUntil - now) / 1000 / 60 / 60;
  hours = hours_total % 24;
  days = (hours_total - hours) / 24;
  return days + "d " + Math.round(hours) + "h";
}

// Footer line, e.g. "Bis: 30.11.26 (17d 1h)"
function validityText(data) {
  if (data.validUntil == null) {
    return "Bis: unbekannt";
  }
  return (
    "Bis: " +
    df.string(data.validUntil).toLocaleString() +
    " (" +
    getDaysHours(data) +
    ")"
  );
}

// #region parser
// Everything between the region markers is plain JavaScript without Scriptable
// APIs, so test/parser.test.js can load and test it in Node.

const KILOBYTE = 1024;
const MEGABYTE = 1024 * KILOBYTE;
const GIGABYTE = 1024 * MEGABYTE;
const TERABYTE = 1024 * GIGABYTE;
const UNITS = { KB: KILOBYTE, MB: MEGABYTE, GB: GIGABYTE, TB: TERABYTE };

// "remaining / total UNIT" in visible text, e.g. "29,28 / 30 GB".
const VOLUME_TEXT_RE = /(\d[\d.,]*)\s*\/\s*(\d[\d.,]*)\s*(KB|MB|GB|TB)\b/i;

// The page's <html lang> decides the number format: English pages write
// "1,024.5", all others (German, Ukrainian) "1.024,5".
function decimalSeparator(html) {
  let lang = html.match(/<html[^>]*\slang="([a-z]+)/i);
  return lang && lang[1].toLowerCase() === "en" ? "." : ",";
}

function parseNumber(s, decimal) {
  let thousands = decimal === "," ? "." : ",";
  return parseFloat(String(s).split(thousands).join("").replace(decimal, "."));
}

// Only the entities that occur in the values we read.
function decodeEntities(s) {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/gi, "&");
}

// Visible text only. Scripts, styles, SVGs and comments are dropped first, so
// code or icon data can't be mistaken for usage values.
function htmlToText(html) {
  let text = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|svg)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(text).replace(/\s+/g, " ").trim();
}

// Text of the first element with exactly this class at or after `from`, up to
// the next tag. Fits the portal's leaf elements such as
// <div class="start-volume">30</div>. Returns { value, index } or null.
function findClassText(html, className, from) {
  let re = new RegExp(
    'class="(?:[^"]*\\s)?' + className + '(?:\\s[^"]*)?"[^>]*>([^<]*)',
    "g"
  );
  re.lastIndex = from || 0;
  let m = re.exec(html);
  if (m == null) return null;
  return {
    value: decodeEntities(m[1]).replace(/\s+/g, " ").trim(),
    index: m.index,
  };
}

// Prefers the portal's markup (first card = sum of all passes). Falls back to
// the first "remaining / total UNIT" in the visible text, e.g. for brands
// whose page uses different class names.
function findVolume(html, text) {
  let remaining = findClassText(html, "remaining-volume-value", 0);
  if (remaining) {
    let total = findClassText(html, "start-volume", remaining.index);
    let unit = total && findClassText(html, "volume-unit", total.index);
    if (total && unit) {
      return {
        remaining: remaining.value,
        total: total.value,
        unit: unit.value,
        source: "markup",
      };
    }
  }
  let m = text.match(VOLUME_TEXT_RE);
  return m ? { remaining: m[1], total: m[2], unit: m[3], source: "text" } : null;
}

// { seconds, source }: seconds until the volume expires, or null when the page
// doesn't say.
function findRemainingSeconds(html, text, now) {
  // 1. Exact end of validity from the countdown script, in epoch ms:
  //    updateCountdown("pass-…", "FLAT_LIKE", <start ms>, <end ms>)
  let script = html.match(
    /updateCountdown\(\s*"[^"]*"\s*,\s*"[^"]*"\s*,\s*(\d{12,})\s*,\s*(\d{12,})\s*\)/
  );
  if (script) {
    let end = parseInt(script[2], 10);
    return { seconds: Math.max(0, Math.round((end - now) / 1000)), source: "script" };
  }

  // Where to look for validity text: the pass cards if the page has them, so
  // offers below them ("für 24 Stunden", "für 7 Tage") can't be taken for the
  // validity. Otherwise the text right after the volume.
  let none = { seconds: null, source: "none" };
  let nearby = passCardsText(html);
  if (!nearby) {
    let start = text.search(VOLUME_TEXT_RE);
    if (start < 0) return none;
    nearby = text.slice(start, start + 300);
  }

  // 2. Countdown text, German or English (Telekom):
  //    "17 Tage 01 Std. 29 Min. 42 Sek." / "17 days 01 hours 29 min. 42 secs"
  let num = (re) => {
    let m = nearby.match(re);
    return m ? parseInt(m[1], 10) : NaN;
  };
  let days = num(/(\d+)\s*(?:Tag(?:e|en)?|days?)\b/i);
  let hours = num(/(\d+)\s*(?:Std\b|Stunden?\b|hours?\b|hrs?\b)/i);
  let mins = num(/(\d+)\s*(?:Min(?:\.|uten?\b|\b)|mins?\b|minutes?\b)/i);
  let secs = num(/(\d+)\s*(?:Sek(?:\.|unden?\b|\b)|secs?\b|seconds?\b)/i);
  if (!isNaN(days) || !isNaN(hours) || !isNaN(mins)) {
    let seconds =
      (days || 0) * 86400 + (hours || 0) * 3600 + (mins || 0) * 60 + (secs || 0);
    return { seconds, source: "text" };
  }

  // 3. End date (congstar): "Gültig bis: 09. Dezember 2026" or "09.12.2026".
  //    The page gives no time, so the end of that day is assumed.
  let end = findValidUntilDate(nearby);
  if (end) {
    return { seconds: Math.max(0, Math.round((end - now) / 1000)), source: "date" };
  }
  return none;
}

// Visible text of all pass cards (<section class="data-pass-instance">), or ""
// when the page has none. Offers and footers are outside these cards.
function passCardsText(html) {
  let re =
    /<section\b[^>]*class="(?:[^"]*\s)?data-pass-instance(?:\s[^"]*)?"[^>]*>[\s\S]*?<\/section>/g;
  let cards = html.match(re) || [];
  return cards.map(htmlToText).join(" ");
}

const GERMAN_MONTHS = [
  "jan", "feb", "mär", "apr", "mai", "jun",
  "jul", "aug", "sep", "okt", "nov", "dez",
];

// End of the day given after "Gültig bis", as epoch ms, or null.
function findValidUntilDate(text) {
  let m = text.match(
    /Gültig bis:?\s*(\d{1,2})\.\s*(?:([A-Za-zÄÖÜäöü]+)|(\d{1,2})\.)\s*(\d{4})/i
  );
  if (m == null) return null;
  let month = m[2]
    ? GERMAN_MONTHS.indexOf(m[2].slice(0, 3).toLowerCase())
    : parseInt(m[3], 10) - 1;
  if (month < 0 || month > 11) return null;
  let day = parseInt(m[1], 10);
  return new Date(parseInt(m[4], 10), month, day, 23, 59, 59).getTime();
}

// { name, source }
function findPassName(html, text) {
  // Telekom: <div class="data-pass-instance__headline"><h2>Inklusivvolumen …</h2>
  let headline = html.match(
    /class="(?:[^"]*\s)?data-pass-instance__headline(?:\s[^"]*)?"[^>]*>\s*<h2[^>]*>([\s\S]*?)<\/h2>/
  );
  if (headline) {
    let name = htmlToText(headline[1]);
    if (name) return { name, source: "markup" };
  }
  // fraenk: "Deine fraenk flat"
  let m = text.match(/Deine\s+[\wÄÖÜäöüß -]+?flat/i);
  if (m) return { name: m[0].trim(), source: "text" };
  return { name: "Datenvolumen", source: "default" };
}

// The page shown outside the mobile network, e.g. "Für den Aufruf dieser Seite
// ist eine Internetverbindung über das Mobilfunknetz notwendig" / "you need an
// internet connection over the mobile network". The usage page contains none of
// these words, so a usage page whose layout changed isn't mistaken for it.
const OFFLINE_PAGE_RE = /Mobilfunknetz|mobile[- ]network|WLAN|Wi-?Fi/i;

// error.kind is "offline" (the page needs the mobile network, e.g. on WiFi) or
// "unrecognized" (neither usage values nor the offline page: layout changed or
// an unknown brand).
function parseError(kind, message) {
  let err = new Error(message);
  err.kind = kind;
  return err;
}

// Reads the datapass.de status page. Returns the byte-based shape that caching
// and the widgets read:
//   { passName, usedVolume, initialVolume, usedPercentage, remainingSeconds,
//     parsedFrom }
// remainingSeconds is null when the page shows no validity. parsedFrom says
// which method found each value, for bug reports. Throws a parseError when the
// page has no plausible volume, so the cache is used instead.
function parseUsageFromHtml(html, now) {
  if (now == null) now = Date.now();
  let text = htmlToText(html);

  let volume = findVolume(html, text);
  if (volume == null) {
    if (OFFLINE_PAGE_RE.test(text)) {
      throw parseError("offline", "Page needs the mobile network (on WiFi?)");
    }
    throw parseError("unrecognized", "No volume found (page changed?)");
  }
  let unit = UNITS[volume.unit.toUpperCase()];
  let decimal = decimalSeparator(html);
  let remainingVolume = parseNumber(volume.remaining, decimal) * unit;
  let initialVolume = parseNumber(volume.total, decimal) * unit;
  if (!isFinite(remainingVolume) || !isFinite(initialVolume) ||
      remainingVolume < 0 || initialVolume <= 0) {
    throw parseError(
      "unrecognized",
      "Implausible volume: " + volume.remaining + " / " + volume.total + " " + volume.unit
    );
  }
  let usedVolume = Math.max(initialVolume - remainingVolume, 0);
  let usedPercentage = Math.round((usedVolume / initialVolume) * 100);
  let validity = findRemainingSeconds(html, text, now);
  let name = findPassName(html, text);

  return {
    passName: name.name,
    usedVolume,
    initialVolume,
    usedPercentage,
    remainingSeconds: validity.seconds,
    parsedFrom: {
      volume: volume.source,
      validity: validity.source,
      name: name.source,
    },
  };
}
// #endregion parser

// Saved when the page isn't recognized, so users can attach it to a bug report.
let unrecognizedPagePath = fm.joinPath(dir, "unrecognized-page.html");

// Loads the status page and parses the usage. Throws when that isn't
// possible (network error, outside the mobile network, page not recognized).
async function fetchUsage() {
  let request = new Request(pageURL);
  request.headers = {
    "User-Agent":
      "Mozilla/5.0 (iPhone; CPU iPhone OS 13_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Mobile/15E148 Safari/604.1",
  };
  let html = await request.loadString();

  // Outside the mobile network, or when the page changed, the parser throws
  // and we fall back to the cached file instead of saving junk.
  try {
    data = parseUsageFromHtml(html);
  } catch (err) {
    if (err.kind === "unrecognized") {
      fm.writeString(unrecognizedPagePath, html);
      console.log("Saved the unrecognized page to " + unrecognizedPagePath);
    }
    throw err;
  }
  if (fm.fileExists(unrecognizedPagePath)) {
    fm.remove(unrecognizedPagePath);
  }
  let from = data.parsedFrom;
  console.log(
    "Parsed volume from " + from.volume + ", validity from " + from.validity +
      ", name from " + from.name
  );
  return data;
}

async function saveImages() {
  console.log("loading and saving images");
  var imgs = ["full", "half", "low", "empty", "almost"];
  for (img of imgs) {
    let img_path = fm.joinPath(dir, img + ".png");
    if (!fm.fileExists(img_path)) {
      console.log("Loading image: " + img + ".png");
      let request = new Request(imgURL + img + ".png");
      console.log(request);
      image = await request.loadImage();
      fm.writeImage(img_path, image);
    }
  }
}

async function getImageFor(name) {
  let img_path = fm.joinPath(dir, name + ".png");
  if (useICloud) {
    await fm.downloadFileFromiCloud(img_path);
  }
  img = await fm.readImage(img_path);
  return img;
}

async function saveData(data) {
  data.savedDate = Date.now();
  fm.writeString(path, JSON.stringify(data));
  console.log("Saved new data to file");
}

async function getFromFile() {
  if (useICloud) {
    await fm.downloadFileFromiCloud(path);
  }
  data = await JSON.parse(fm.readString(path));
  console.log("Fetching data from file was successful");
  return data;
}

async function processData(data) {
  var name = data.passName;
  var usedVolumeNum = data.usedVolume / 1024 / 1024 / 1024;
  var initialVolumeNum = data.initialVolume / 1024 / 1024 / 1024;

  var usedVolume =
    String(Math.round((usedVolumeNum + Number.EPSILON) * 100) / 100).replace(
      ".",
      ","
    ) + " GB";
  var initialVolume =
    String(Math.round((initialVolumeNum + Number.EPSILON) * 100) / 100).replace(
      ".",
      ","
    ) + " GB";

  var remainingVolumeNum =
    (data.initialVolume - data.usedVolume) / 1024 / 1024 / 1024;
  var remainingVolume =
    String(Math.round((remainingVolumeNum + Number.EPSILON) * 100) / 100) +
    " GB";
  remainingVolume = remainingVolume.replace(".", ",");

  var usedPercentage = data.usedPercentage;
  // null when the page showed no validity
  var validUntil = null;
  if (data.remainingSeconds != null) {
    var date = data.savedDate + data.remainingSeconds * 1000 - 60 * 1000;
    validUntil = new Date(date);
  }

  var telekom = new Telekom(
    name,
    usedVolume,
    initialVolume,
    remainingVolume,
    usedPercentage,
    validUntil
  );

  return telekom;
}

// Create all widgets
function createFirstWidget() {
  first = new ListWidget();
  if (pageUnrecognized) {
    first.addText(
      "Datenseite nicht erkannt. Bitte unrecognized-page.html aus dem Ordner telekom-widget an den Entwickler schicken."
    );
  } else {
    first.addText(
      "Wlan für die erste Einrichtung ausschalten und Widget erneut erstellen."
    );
  }
  return first;
}

async function createErrorWidget(err) {
  err_widget = new ListWidget();
  err_widget.addText(err);
  return err_widget;
}

async function createSmallVisualWidget(data) {
  var small_visual_widget = new ListWidget();
  var img = await getImageFor("empty");

  if (data.usedPercentage >= 75 && data.usedPercentage <= 95) {
    img = await getImageFor("low");
  } else if (data.usedPercentage >= 50 && data.usedPercentage < 75) {
    img = await getImageFor("half");
  } else if (data.usedPercentage >= 25 && data.usedPercentage < 50) {
    img = await getImageFor("almost");
  } else if (data.usedPercentage < 25) {
    img = await getImageFor("full");
  }

  var widget_image = small_visual_widget.addImage(img);
  widget_image.centerAlignImage();

  small_visual_widget.backgroundColor = BACKGROUND_COLOR;

  return small_visual_widget;
}

async function createSmallWidget(data) {
  var widget = new ListWidget();
  var header_stack = widget.addStack();
  var title = header_stack.addText(data.name);

  // Status symbol when showing cached data: WiFi, or page not recognized
  let status_symbol = wifi
    ? "wifi.exclamationmark"
    : pageUnrecognized
    ? "exclamationmark.triangle"
    : null;
  if (status_symbol) {
    header_stack.addSpacer();
    let symbol_image = SFSymbol.named(status_symbol).image;
    var symbol = header_stack.addImage(symbol_image);
    symbol.imageSize = new Size(17, 17);
    symbol.tintColor = TEXT_COLOR;
  }

  widget.addSpacer();
  var used_txt = widget.addText(
    "Benutzt: \n" + data.usedVolume + " (" + data.usedPercentage + "%)"
  );
  widget.addSpacer();
  var available_txt = widget.addText(
    data.remainingVolume + " von " + data.initialVolume
  );
  widget.addSpacer();
  var footer = widget.addText(validityText(data));

  // ASSIGNING FONTS and COLORS
  title.font = title_font;
  available_txt.font = bold_font;
  used_txt.font = thin_font;
  footer.font = small_font;

  title.textColor = TELEKOM_COLOR;
  used_txt.textColor = TEXT_COLOR;
  footer.textColor = TEXT_COLOR;

  // COLORING BASED ON DATA PERCENTAGE
  if (data.usedPercentage >= 75) {
    available_txt.textColor = Color.red();
  } else if (data.usedPercentage >= 50 && data.usedPercentage < 75) {
    available_txt.textColor = Color.orange();
  } else if (data.usedPercentage >= 25 && data.usedPercentage < 50) {
    available_txt.textColor = Color.yellow();
  } else {
    available_txt.textColor = Color.green();
  }

  widget.backgroundColor = BACKGROUND_COLOR;

  return widget;
}

async function createMediumWidget(data) {
  medium_widget = new ListWidget();
  var body_stack = medium_widget.addStack();

  var info_stack = body_stack.addStack();
  body_stack.addSpacer();
  var visual_stack = body_stack.addStack();

  // Stack Layout
  body_stack.layoutHorizontally();
  info_stack.layoutVertically();
  visual_stack.layoutVertically();

  var title = info_stack.addText(data.name);
  info_stack.addSpacer();
  var used_txt = info_stack.addText(
    "Benutzt: " + data.usedVolume + " (" + data.usedPercentage + "%)."
  );
  info_stack.addSpacer();
  var available_txt = info_stack.addText(
    data.remainingVolume + " von " + data.initialVolume
  );
  info_stack.addSpacer();
  var footer = info_stack.addText(validityText(data));

  img = await getImageFor("empty");

  // COLORING BASED ON DATA PERCENTAGE
  if (data.usedPercentage >= 75 && data.usedPercentage <= 95) {
    available_txt.textColor = Color.red();
    img = await getImageFor("low");
  } else if (data.usedPercentage >= 50 && data.usedPercentage < 75) {
    available_txt.textColor = Color.orange();
    img = await getImageFor("half");
  } else if (data.usedPercentage >= 25 && data.usedPercentage < 50) {
    available_txt.textColor = Color.yellow();
    img = await getImageFor("almost");
  } else if (data.usedPercentage < 25) {
    available_txt.textColor = Color.green();
    img = await getImageFor("full");
  } else if (data.usedPercentage > 95) {
    available_txt.textColor = Color.red();
  }

  visual_stack.addSpacer();
  visual_stack.addImage(img);

  // ASSIGNING FONTS and COLORS
  title.font = title_font;
  available_txt.font = bold_font;
  used_txt.font = thin_font;
  footer.font = small_font;

  title.textColor = TELEKOM_COLOR;
  used_txt.textColor = TEXT_COLOR;
  footer.textColor = TEXT_COLOR;

  medium_widget.backgroundColor = BACKGROUND_COLOR;

  return medium_widget;
}

async function createLargeWidget(data) {
  var large_widget = new ListWidget();
  var img = await getImageFor("empty");

  if (data.usedPercentage >= 75 && data.usedPercentage <= 95) {
    img = await getImageFor("low");
  } else if (data.usedPercentage >= 50 && data.usedPercentage < 75) {
    img = await getImageFor("half");
  } else if (data.usedPercentage >= 25 && data.usedPercentage < 50) {
    img = await getImageFor("almost");
  } else if (data.usedPercentage < 25) {
    img = await getImageFor("full");
  }

  var widget_image = large_widget.addImage(img);
  widget_image.centerAlignImage();

  large_widget.backgroundColor = BACKGROUND_COLOR;

  return large_widget;
}

// Runtime:
await saveImages();

try {
  data = await fetchUsage();
  saveData(data);
} catch (err) {
  // Network errors (e.g. a redirect loop outside the mobile network) count as
  // WiFi, like the offline page.
  if (err.kind === "unrecognized") {
    pageUnrecognized = true;
  } else {
    wifi = true;
  }
  console.log(
    "Couldnt fetch valid data (" + err + "). Trying to read from file."
  );
}

if (!fm.fileExists(path)) {
  console.log("File doesnt exist. Looks like your first init.");
  first = await createFirstWidget();
  // Show the hint when the script is run in the app, e.g. right after setup
  if (config.runsInApp) {
    first.presentSmall();
  }
  Script.setWidget(first);
} else {
  data = await getFromFile();
  processedData = await processData(data);

  widget = createErrorWidget("Widget couldnt be created");

  switch (widgetSize) {
    case "small":
      if (parameters.includes("visual")) {
        widget = await createSmallVisualWidget(processedData);
      } else {
        widget = await createSmallWidget(processedData);
      }
      break;
    case "medium":
      widget = await createMediumWidget(processedData);
      break;
    case "large":
      widget = await createLargeWidget(processedData);
      break;
    default:
      widget = await createSmallWidget(processedData);
  }

  widget.presentSmall();
  widget.url = "https://datapass.de";

  Script.setWidget(widget);
}

Script.complete();
