// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: purple; icon-glyph: magic;

// Same page as in telekom-data-usage.js
const pageURL = "https://datapass.de/home?lang=de";

let fm = FileManager.iCloud();
let dir = fm.joinPath(fm.documentsDirectory(), "telekom-widget")
let path = fm.joinPath(dir, "telekom-data.json");

if(!fm.fileExists(dir)){
  fm.createDirectory(dir)
}

let wifi = false

let df = new DateFormatter();
df.useShortDateStyle();

class Telekom{
  constructor(name, usedVolume, initialVolume, remainingVolume, usedPercentage, validUntil, usedAt){
   	this.name = name;
    this.usedVolume = usedVolume;
    this.initialVolume = initialVolume;
    this.remainingVolume = remainingVolume;
    this.usedPercentage = usedPercentage;
    this.validUntil = validUntil;
    this.usedAt = usedAt;
  }
}


// The parser region is a copy of the one in telekom-data-usage.js, because the
// module is installed as a file of its own. test/telekom-module.test.js checks
// that both copies are the same.
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

// Throws when the page can't be loaded or parsed (e.g. on WiFi).
async function fetchUsage(){
  let request = new Request(pageURL);
  request.headers = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 13_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Mobile/15E148 Safari/604.1"
  };
  let html = await request.loadString();
  return parseUsageFromHtml(html);
}

async function saveData(data){
  data.savedDate = Date.now();
  fm.writeString(path, JSON.stringify(data));
}

async function getFromFile(){
  await fm.downloadFileFromiCloud(path);
  data = await JSON.parse(fm.readString(path));
  return data
}


async function processData(data){
  
  var name = data.passName;
  var usedVolumeNum = data.usedVolume / 1024 / 1024 / 1024;
  var initialVolumeNum = data.initialVolume / 1024 / 1024 / 1024;
  
  var usedVolume = String(Math.round((usedVolumeNum + Number.EPSILON) * 100) /100).replace('.', ',') + ' GB';
  var initialVolume = String(Math.round((initialVolumeNum + Number.EPSILON) * 100) / 100).replace('.', ',') + ' GB';
  
  var remainingVolumeNum = (data.initialVolume - data.usedVolume) / 1024 / 1024 / 1024;
  var remainingVolume = String(Math.round((remainingVolumeNum + Number.EPSILON) * 100) / 100) + ' GB';
  remainingVolume = remainingVolume.replace('.', ',');
  
  var usedPercentage = data.usedPercentage;
  // null when the page showed no validity
  var validUntil = null;
  if(data.remainingSeconds != null){
    var date = data.savedDate + data.remainingSeconds*1000 - 60*1000;
    validUntil = new Date(date);
  }

  var telekom = new Telekom(name, usedVolume, initialVolume, remainingVolume, usedPercentage, validUntil);
  
  return telekom;
}


module.exports.getData = async function getData(){
  data = ""
  try{
    data = await fetchUsage()
    saveData(data)
  }catch(err){
    wifi = err.kind === "offline"
    console.log("Couldnt fetch data from datapass.de (" + err + "). Will try to read from file.")
  }

  if(!fm.fileExists(path)){
    console.log("File doesnt exist. Looks like your first init. Disable Wifi and try again.")
  }else{
    data = await getFromFile()
    data = await processData(data)
  }
  return data
}
