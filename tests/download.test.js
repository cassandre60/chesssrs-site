// Unit tests for download.js picking logic (invariant I-1).
//
// Pure helpers need no DOM. renderDownload/initDownload run against a tiny
// fake document implementing only what download.js touches: getElementById,
// createElement, setAttribute/getAttribute, textContent, append/remove.
let fails = 0;
const ok = (c, m) => {
  console.log((c ? "PASS " : "FAIL ") + m);
  if (!c) fails++;
};

const D = require("../download.js");

function fakeEl(tag) {
  return {
    tag,
    attrs: {},
    children: [],
    _tc: "",
    firstChild: null,
    setAttribute(k, v) {
      this.attrs[k] = String(v);
    },
    getAttribute(k) {
      return this.attrs[k] ?? null;
    },
    append(...nodes) {
      for (const n of nodes) this.children.push(n);
      this.firstChild = this.children[0] ?? null;
    },
    removeChild(n) {
      this.children = this.children.filter((c) => c !== n);
      this.firstChild = this.children[0] ?? null;
    },
    get textContent() {
      return this._tc;
    },
    set textContent(v) {
      this._tc = String(v);
    },
  };
}

function fakeDoc() {
  const ids = {};
  for (const id of ["dl-title", "dl-sub", "dl-primary", "dl-primary-tx", "dl-pick", "dl-note"]) {
    const e = fakeEl("div");
    if (id === "dl-primary") e.attrs.href = "https://github.com/o/r/releases";
    ids[id] = e;
  }
  return {
    ids,
    getElementById: (id) => ids[id] ?? null,
    createElement: (t) => fakeEl(t),
    createTextNode: (v) => ({ nodeType: 3, text: String(v) }),
    querySelectorAll: () => [],
  };
}

const asset = (name, size = 40 * 1024 * 1024) => ({
  name,
  size,
  browser_download_url: `https://github.com/o/r/releases/download/v9/${name}`,
});
const rel = (tag, assets, extra = {}) => ({
  tag_name: tag,
  prerelease: true,
  published_at: "2026-10-08T00:00:00Z",
  html_url: `https://github.com/o/r/releases/tag/${tag}`,
  assets,
  ...extra,
});

// --- labels: every workflow artifact maps to a platform, AAB flagged ---
ok(D.platformLabel("chesssrs-v0.4.0-linux-x64.tar.gz") === "Linux (.tar.gz)", "tarball labels Linux");
ok(D.platformLabel("chesssrs-v0.4.0-android-testing.apk") === "Android (APK)", "apk labels Android");
ok(
  D.platformLabel("chesssrs-v0.4.0-android-testing.aab").includes("not installable"),
  "aab flagged not installable",
);

// --- installability: the store-upload bundle must never be a download ---
ok(D.isInstallable("chesssrs-v0.4.0-linux-x64.tar.gz"), "tarball installable");
ok(D.isInstallable("chesssrs-v0.4.0-android-testing.apk"), "apk installable");
ok(!D.isInstallable("chesssrs-v0.4.0-android-testing.aab"), "aab excluded from direct download");
ok(!D.isInstallable("notes.txt"), "stray files excluded");

// --- picking: OS preselect, newest release with files wins ---
const releases = [
  rel("v0.4.0", []),
  rel("v0.3.0", [asset("chesssrs-v0.3.0-linux-x64.tar.gz"), asset("chesssrs-v0.3.0-android-testing.apk")]),
];
const linux = D.pickPrimary(releases, "linux");
ok(linux?.asset.name.endsWith(".tar.gz") && linux.release.tag_name === "v0.3.0", "linux preselects tarball from newest release carrying files");
const android = D.pickPrimary(releases, "android");
ok(android?.asset.name.endsWith(".apk"), "android preselects apk");
const other = D.pickPrimary(releases, "other");
ok(other?.asset.name.endsWith(".tar.gz"), "unknown OS defaults to the desktop build");
ok(D.pickPrimary([rel("v0.4.0", [])], "linux") === null, "no files anywhere -> null");
ok(D.pickPrimary([], "linux") === null, "no releases -> null");
ok(D.pickPrimary(null, "linux") === null, "garbage input -> null");

// newestRelease ignores attachments
ok(D.newestRelease(releases)?.tag_name === "v0.4.0", "newest release returned regardless of files");
ok(D.newestRelease([]) === null, "empty list -> null");

// --- platform detection never throws on odd inputs ---
ok(D.detectPlatform("Linux x86_64", "", "") === "linux", "linux detected");
ok(D.detectPlatform("", "Android", "") === "android", "android detected");
ok(D.detectPlatform(undefined, undefined, undefined) === "other", "missing navigator -> other");

// --- sizes stay human ---
ok(D.formatSize(38 * 1024 * 1024).includes("MB"), "megabytes formatted");
ok(D.formatSize(512) === "512 B", "bytes formatted");
ok(D.formatSize(-1) === "", "negative size blanked");

// --- rendering: direct state rewrites primary + chooser ---
{
  const doc = fakeDoc();
  const state = D.renderDownload(doc, releases, "linux");
  ok(state === "direct", "files present -> direct state");
  ok(doc.ids["dl-primary"].attrs.href.includes(".tar.gz"), "primary href is the direct file");
  ok(doc.ids["dl-title"].textContent.includes("v0.3.0"), "title carries the live tag");
  ok(doc.ids["dl-pick"].children.length === 3, "chooser lists both files plus the all-files row");
}

// --- rendering: asset-less release stays honest ---
{
  const doc = fakeDoc();
  const state = D.renderDownload(doc, [rel("v0.4.0", [])], "linux");
  ok(state === "notes", "files absent -> notes state");
  ok(doc.ids["dl-primary-tx"].textContent.includes("v0.4.0"), "primary names the tag, not a file");
  ok(doc.ids["dl-primary"].attrs.href.includes("/releases/tag/v0.4.0"), "primary falls back to the release page");
  ok(/no installable files/.test(doc.ids["dl-sub"].textContent), "copy admits no files are attached");
}

// --- rendering: offline never breaks the shipped fallback ---
{
  const doc = fakeDoc();
  ok(D.renderOffline(doc) === "offline", "offline path returns offline");
  ok(doc.ids["dl-primary"].attrs.href === "https://github.com/o/r/releases", "offline leaves the static releases link untouched");
}

// --- initDownload: repo derived from page links, failures degrade ---
{
  const doc = fakeDoc();
  doc.querySelectorAll = () => [{ getAttribute: () => "https://github.com/cassandre60/ChessSRS" }];
  const seen = [];
  const fetchFn = (url, opts) => {
    seen.push([url, opts]);
    return Promise.resolve({ ok: true, json: () => Promise.resolve([rel("v0.4.0", [])]) });
  };
  D.initDownload(doc, fetchFn, {}).then((state) => {
    ok(state === "notes", "init resolves through the derived repo");
    ok(seen[0][0] === "https://api.github.com/repos/cassandre60/ChessSRS/releases?per_page=10", "API URL derived from the page, not hardcoded");
    ok((seen[0][1].headers.Accept ?? "").includes("github+json"), "versioned Accept header sent");
    const badDoc = fakeDoc();
    badDoc.querySelectorAll = () => [{ getAttribute: () => "https://github.com/cassandre60/ChessSRS" }];
    const bad = D.initDownload(badDoc, () => Promise.reject(new Error("down")), {});
    bad.then((s) => {
      ok(s === "error", "fetch rejection degrades instead of throwing");
      process.exitCode = fails ? 1 : 0;
      console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
    });
  });
}
