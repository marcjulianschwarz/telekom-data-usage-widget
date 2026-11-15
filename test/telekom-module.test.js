// Tests for telekom-module/telekom-module.js. Run with: node --test
//
// The module runs in a sandbox with fakes for the Scriptable globals. The page
// comes from the datapass.de fixtures of test/parser.test.js.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = (...parts) =>
  fs.readFileSync(path.join(__dirname, "..", ...parts), "utf8");
const source = read("telekom-module", "telekom-module.js");
const fixture = (name) => read("test", "fixtures", name);
const dataPath = "/icloud/telekom-widget/telekom-data.json";

const savedData = {
  passName: "MagentaMobil",
  usedVolume: 1.5 * 1024 * 1024 * 1024,
  initialVolume: 10 * 1024 * 1024 * 1024,
  usedPercentage: 15,
  remainingSeconds: 3600,
};

function parserRegion(src) {
  const m = src.match(/\/\/ #region parser\n[\s\S]*?\/\/ #endregion parser\n/);
  assert.ok(m, "parser region markers not found");
  return m[0];
}

function createFakeFileManager(files) {
  const calls = [];
  const downloaded = new Set();
  return {
    calls,
    files,
    documentsDirectory: () => "/icloud",
    joinPath: (a, b) => a + "/" + b,
    fileExists: (p) => p === "/icloud/telekom-widget" || files.has(p),
    createDirectory: () => {},
    downloadFileFromiCloud: async (p) => {
      calls.push("download " + p);
      downloaded.add(p);
    },
    readString: (p) => {
      calls.push("read " + p);
      if (!downloaded.has(p)) {
        throw new Error("file is not downloaded from iCloud");
      }
      return files.get(p);
    },
    writeString: (p, content) => {
      calls.push("write " + p);
      files.set(p, content);
      downloaded.add(p);
    },
  };
}

function loadModule(fm, loadString) {
  const module = { exports: {} };
  const context = {
    module,
    console: { log: () => {} },
    FileManager: { iCloud: () => fm },
    DateFormatter: class {
      useShortDateStyle() {}
    },
    Request: class {
      loadString() {
        return loadString();
      }
    },
  };
  vm.runInNewContext(source, context);
  return module.exports;
}

test("parser region is the same as in the widget", () => {
  assert.equal(parserRegion(source), parserRegion(read("telekom-data-usage.js")));
});

test("downloads the iCloud file before it reads it when the page can't be loaded", async () => {
  const saved = JSON.stringify({ ...savedData, savedDate: Date.now() });
  const fm = createFakeFileManager(new Map([[dataPath, saved]]));
  const telekom = loadModule(fm, async () => {
    throw new Error("no connection");
  });

  const data = await telekom.getData();

  assert.deepEqual(fm.calls, ["download " + dataPath, "read " + dataPath]);
  assert.equal(data.name, "MagentaMobil");
  assert.equal(data.usedVolume, "1,5 GB");
  assert.equal(data.initialVolume, "10 GB");
  assert.equal(data.remainingVolume, "8,5 GB");
  assert.equal(data.usedPercentage, 15);
});

test("parses the page, saves it and reads it back", async () => {
  const fm = createFakeFileManager(new Map());
  const telekom = loadModule(fm, async () =>
    fixture("datapass-telekom-de.html")
  );

  const data = await telekom.getData();

  assert.deepEqual(fm.calls, [
    "write " + dataPath,
    "download " + dataPath,
    "read " + dataPath,
  ]);
  const saved = JSON.parse(fm.files.get(dataPath));
  assert.equal(saved.usedPercentage, data.usedPercentage);
  assert.match(data.initialVolume, / GB$/);
  assert.equal(typeof data.validUntil.getTime(), "number");
});

test("keeps the saved data when the page is the WiFi page", async () => {
  const saved = JSON.stringify({ ...savedData, savedDate: Date.now() });
  const fm = createFakeFileManager(new Map([[dataPath, saved]]));
  const telekom = loadModule(fm, async () => fixture("datapass-wifi-de.html"));

  const data = await telekom.getData();

  assert.deepEqual(fm.calls, ["download " + dataPath, "read " + dataPath]);
  assert.equal(data.remainingVolume, "8,5 GB");
});

test("keeps the saved data when the page is not recognized", async () => {
  const saved = JSON.stringify({ ...savedData, savedDate: Date.now() });
  const fm = createFakeFileManager(new Map([[dataPath, saved]]));
  const telekom = loadModule(fm, async () => "<html><body>Wartung</body></html>");

  const data = await telekom.getData();

  assert.deepEqual(fm.calls, ["download " + dataPath, "read " + dataPath]);
  assert.equal(data.remainingVolume, "8,5 GB");
});

test("validUntil is null when the saved data has no validity", async () => {
  const saved = JSON.stringify({
    ...savedData,
    remainingSeconds: null,
    savedDate: Date.now(),
  });
  const fm = createFakeFileManager(new Map([[dataPath, saved]]));
  const telekom = loadModule(fm, async () => {
    throw new Error("no connection");
  });

  const data = await telekom.getData();

  assert.equal(data.validUntil, null);
});

test("skips the download when no file exists and the page can't be loaded", async () => {
  const fm = createFakeFileManager(new Map());
  const telekom = loadModule(fm, async () => {
    throw new Error("no connection");
  });

  const data = await telekom.getData();

  assert.deepEqual(fm.calls, []);
  assert.equal(data, "");
});

test("fails when the iCloud download fails", async () => {
  const saved = JSON.stringify({ ...savedData, savedDate: Date.now() });
  const fm = createFakeFileManager(new Map([[dataPath, saved]]));
  fm.downloadFileFromiCloud = async () => {
    throw new Error("iCloud unavailable");
  };
  const telekom = loadModule(fm, async () => {
    throw new Error("no connection");
  });

  await assert.rejects(telekom.getData(), /iCloud unavailable/);
});
