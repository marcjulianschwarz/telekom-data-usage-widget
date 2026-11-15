// Tests for telekom-module/telekom-module.js. Run with: node --test
//
// The module runs in a sandbox with fakes for the Scriptable globals.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "telekom-module", "telekom-module.js"),
  "utf8"
);
const dataPath = "/icloud/telekom-widget/telekom-data.json";

const apiData = {
  passName: "MagentaMobil",
  usedVolume: 1.5 * 1024 * 1024 * 1024,
  initialVolume: 10 * 1024 * 1024 * 1024,
  usedPercentage: 15,
  remainingSeconds: 3600,
};

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

function loadModule(fm, loadJSON) {
  const module = { exports: {} };
  const context = {
    module,
    console: { log: () => {} },
    FileManager: { iCloud: () => fm },
    DateFormatter: class {
      useShortDateStyle() {}
    },
    Request: class {
      loadJSON() {
        return loadJSON();
      }
    },
  };
  vm.runInNewContext(source, context);
  return module.exports;
}

test("downloads the iCloud file before it reads it when the API fails", async () => {
  const saved = JSON.stringify({ ...apiData, savedDate: Date.now() });
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

test("saves the API data and reads it back", async () => {
  const fm = createFakeFileManager(new Map());
  const telekom = loadModule(fm, async () => ({ ...apiData }));

  const data = await telekom.getData();

  assert.deepEqual(fm.calls, [
    "write " + dataPath,
    "download " + dataPath,
    "read " + dataPath,
  ]);
  assert.equal(data.remainingVolume, "8,5 GB");
});

test("skips the download when no file exists and the API fails", async () => {
  const fm = createFakeFileManager(new Map());
  const telekom = loadModule(fm, async () => {
    throw new Error("no connection");
  });

  const data = await telekom.getData();

  assert.deepEqual(fm.calls, []);
  assert.equal(data, "");
});

test("fails when the iCloud download fails", async () => {
  const saved = JSON.stringify({ ...apiData, savedDate: Date.now() });
  const fm = createFakeFileManager(new Map([[dataPath, saved]]));
  fm.downloadFileFromiCloud = async () => {
    throw new Error("iCloud unavailable");
  };
  const telekom = loadModule(fm, async () => {
    throw new Error("no connection");
  });

  await assert.rejects(telekom.getData(), /iCloud unavailable/);
});
