// Unit tests for download.js (invariant I-1: two clicks, zero detours).
//
// renderDownload/initDownload run against the shared fake document in
// ./fake-dom.js — fix fake quirks there, never per test file.
let fails = 0;
const ok = (c, m) => {
  console.log((c ? "PASS " : "FAIL ") + m);
  if (!c) fails++;
};

const D = require("../download.js");
const { fakeEl, fakeDoc } = require("./fake-dom");

function downloadDoc(triggers = []) {
  const doc = fakeDoc(
    ["dl-title", "dl-sub", "dl-primary", "dl-primary-tx", "dl-menu", "dl-note", "app-ld", "v-hero", "v-foot"],
    triggers,
  );
  doc.ids["dl-primary"].setAttribute("disabled", "");
  doc.ids["dl-menu"].hidden = true;
  // Hero pill and footer share the data-app-version markup (no ids in the
  // real DOM); the fake flags them the same way querySelectorAll selects.
  doc.ids["v-hero"].dataset.appVersion = "";
  doc.ids["v-foot"].dataset.appVersion = "";
  doc.ids["app-ld"].textContent = JSON.stringify({ softwareVersion: "stale" });
  return doc;
}

/** Every href rendered anywhere inside the block. */
function blockHrefs(doc) {
  const out = [];
  const walk = (n) => {
    if (!n || typeof n !== "object") return;
    if (typeof n.attrs?.href === "string") out.push(n.attrs.href);
    for (const c of n.children ?? []) walk(c);
  };
  for (const n of Object.values(doc.ids)) walk(n);
  return out;
}

const asset = (name, size = 40 * 1024 * 1024) => ({
  name,
  size,
  browser_download_url: `https://github.com/o/r/releases/download/v9/${name}`,
});
const rel = (tag, assets) => ({
  tag_name: tag,
  prerelease: true,
  published_at: "2026-10-08T00:00:00Z",
  html_url: `https://github.com/o/r/releases/tag/${tag}`,
  assets,
});

// --- short labels for the menu pills ---
ok(D.platformShort("chesssrs-v0.4.0-linux-x64.tar.gz") === "Linux", "tarball -> Linux");
ok(D.platformShort("chesssrs-v0.4.0-android-testing.apk") === "Android", "apk -> Android");

// --- installability: the store-upload bundle is never offered ---
ok(D.isInstallable("chesssrs-v0.4.0-linux-x64.tar.gz"), "tarball installable");
ok(D.isInstallable("chesssrs-v0.4.0-android-testing.apk"), "apk installable");
ok(!D.isInstallable("chesssrs-v0.4.0-android-testing.aab"), "aab excluded");
ok(!D.isInstallable("notes.txt"), "stray files excluded");

// --- picking: newest release carrying files wins ---
const releases = [
  rel("v0.4.0", []),
  rel("v0.3.0", [
    asset("chesssrs-v0.3.0-linux-x64.tar.gz"),
    asset("chesssrs-v0.3.0-android-testing.apk"),
    asset("chesssrs-v0.3.0-android-testing.aab"),
  ]),
];
const picked = D.pickRelease(releases);
ok(picked?.release.tag_name === "v0.3.0", "newest release carrying files wins");
ok(picked?.files.length === 2, "only installable files picked (aab dropped)");
ok(D.pickRelease([rel("v0.4.0", [])]) === null, "no files anywhere -> null");
ok(D.pickRelease([]) === null, "no releases -> null");
ok(D.pickRelease(null) === null, "garbage input -> null");

ok(D.formatSize(41 * 1024 * 1024).includes("MB"), "megabytes formatted");
ok(D.formatSize(-1) === "", "negative size blanked");

// --- rendering: button + menu, direct file hrefs, nothing else ---
{
  const doc = downloadDoc();
  const state = D.renderDownload(doc, releases);
  ok(state === "direct", "files present -> direct state");
  ok(doc.ids["dl-primary"].getAttribute("disabled") === null, "button enabled");
  ok(doc.ids["dl-primary-tx"].textContent.includes("v0.3.0"), "button names the live tag");
  ok(doc.ids["dl-menu"].children.length === 2, "menu lists exactly the installable files");
  const hrefs = blockHrefs(doc);
  ok(hrefs.length === 2 && hrefs.every((h) => h.includes("/releases/download/")), "menu rows link straight at the files");
  // File URLs are necessarily hosted there; what the block must never show
  // is a forge *page* (repo, releases index, tag notes).
  ok(hrefs.every((h) => !/\/(tree|blob|releases\/(tag|latest)|releases\/?$)/.test(h)), "no forge pages anywhere in the block");
}

// --- menu toggle: every Download entry opens the same menu in place ---
{
  const nav = fakeEl("a");
  nav.getBoundingClientRect = () => ({ left: 100, bottom: 50 });
  const doc = downloadDoc([nav]);
  D.renderDownload(doc, releases);
  const primary = doc.ids["dl-primary"];
  const menu = doc.ids["dl-menu"];
  let prevented = 0;
  primary.fire("click", { preventDefault: () => {} });
  ok(menu.hidden === false && primary.getAttribute("aria-expanded") === "true", "section button opens the menu");
  primary.fire("click", { preventDefault: () => {} });
  ok(menu.hidden === true, "click closes the menu");
  nav.fire("click", { preventDefault: () => prevented++ });
  ok(menu.hidden === false && prevented === 1, "nav entry opens the same menu in place without navigating");
  ok(menu.style.top === "58px" && menu.style.left === "100px", "menu anchors under the entry that opened it");
  menu.fire("keydown", { key: "Escape" });
  ok(menu.hidden === true, "Escape closes the menu");
}

// --- no files: entries keep their anchor fallback to the waiting block ---
{
  let prevented = 0;
  const nav = fakeEl("a");
  const doc = downloadDoc([nav]);
  D.renderDownload(doc, [rel("v0.4.0", [])]);
  nav.fire("click", { preventDefault: () => prevented++ });
  ok(prevented === 0 && doc.ids["dl-menu"].hidden === true, "empty menu never opens; anchor scrolls to Coming soon");
}

// --- waiting state: honest, no external links, no dev noise ---
{
  const doc = downloadDoc();
  const state = D.renderDownload(doc, [rel("v0.4.0", [])]);
  ok(state === "soon", "files absent -> soon state");
  ok(doc.ids["dl-primary"].getAttribute("disabled") === "", "button waits disabled");
  ok(doc.ids["dl-primary-tx"].textContent === "Coming soon", "button says coming soon");
  ok(blockHrefs(doc).length === 0, "waiting block links nowhere");
  ok(!JSON.stringify(doc.ids).includes("fvm"), "no toolchain instructions in the block");
}

// --- versions: every slot shows the live tag, never a hardcoded number ---
{
  ok(D.bareVersion("v1.1.2") === "1.1.2", "release tag v-prefix stripped for display");
  ok(D.bareVersion("1.1.0") === "1.1.0", "bare version passes through");
  ok(D.bareVersion("") === "" && D.bareVersion(null) === "", "empty version stays empty");

  const doc = downloadDoc();
  const v = D.renderVersion(doc, "v9.9.9-e2e");
  ok(v === "9.9.9-e2e", "renderVersion returns the bare live tag");
  ok(
    doc.ids["v-hero"].textContent === "9.9.9-e2e" && doc.ids["v-foot"].textContent === "9.9.9-e2e",
    "hero and footer slots updated",
  );
  ok(
    JSON.parse(doc.ids["app-ld"].textContent).softwareVersion === "9.9.9-e2e",
    "JSON-LD softwareVersion follows the live tag",
  );
}

// --- versions: live tag wins on direct, synced app version while waiting ---
{
  const prevWindow = global.window;
  global.window = { CHESSSRS_META: { version: "1.1.0" } };
  try {
    ok(D.metaVersion() === "1.1.0", "synced app version readable");
    const direct = downloadDoc();
    D.renderDownload(direct, releases);
    ok(direct.ids["v-hero"].textContent === "0.3.0", "direct state shows the live tag, not the synced version");
    const soon = downloadDoc();
    D.renderDownload(soon, [rel("v0.4.0", [])]);
    ok(soon.ids["v-hero"].textContent === "1.1.0", "waiting state falls back to the synced app version");
  } finally {
    if (prevWindow === undefined) delete global.window;
    else global.window = prevWindow;
  }
}

// --- menu: a page scroll dismisses it, a scroll inside it does not ---
{
  const doc = downloadDoc();
  D.renderDownload(doc, releases);
  const menu = doc.ids["dl-menu"];
  const primary = doc.ids["dl-primary"];
  primary.fire("click", { preventDefault: () => {} });
  ok(menu.hidden === false, "menu open before scroll");
  doc.fire("scroll", { target: null });
  ok(menu.hidden === true, "page scroll dismisses the menu");
  primary.fire("click", { preventDefault: () => {} });
  ok(menu.hidden === false, "menu reopens after dismissal");
  const inner = fakeEl("div");
  inner.closest = () => menu;
  doc.fire("scroll", { target: inner });
  ok(menu.hidden === false, "scroll inside the menu keeps it open");
}

// --- menu: window scroll/resize listeners dismiss it in the browser ---
{
  const events = {};
  const prevWindow = global.window;
  global.window = {
    CHESSSRS_META: { version: "1.1.0" },
    innerWidth: 1280,
    innerHeight: 800,
    addEventListener: (t, f) => {
      if (!events[t]) events[t] = [];
      events[t].push(f);
    },
  };
  try {
    const doc = downloadDoc();
    D.renderDownload(doc, releases);
    const menu = doc.ids["dl-menu"];
    doc.ids["dl-primary"].fire("click", { preventDefault: () => {} });
    ok(menu.hidden === false, "menu open before resize");
    for (const f of events.resize || []) f();
    ok(menu.hidden === true, "resize dismisses the menu");
    ok((events.scroll || []).length > 0, "scroll listener registered on window");
  } finally {
    if (prevWindow === undefined) delete global.window;
    else global.window = prevWindow;
  }
}

// --- initDownload: repo derived from page links, failures wait honestly ---
{
  const ghLink = fakeEl("a");
  ghLink.getAttribute = () => "https://github.com/cassandre60/ChessSRS";
  const doc = downloadDoc([ghLink]);
  const seen = [];
  const fetchFn = (url, opts) => {
    seen.push([url, opts]);
    return Promise.resolve({ ok: true, json: () => Promise.resolve([rel("v0.4.0", [])]) });
  };
  D.initDownload(doc, fetchFn).then((state) => {
    ok(state === "soon", "asset-less release waits honestly");
    ok(seen[0][0] === "https://api.github.com/repos/cassandre60/ChessSRS/releases?per_page=10", "API URL derived from the page, not hardcoded");
    const offDoc = downloadDoc(doc.triggers);
    D.initDownload(offDoc, () => Promise.reject(new Error("down"))).then((s) => {
      ok(s === "soon", "fetch rejection waits instead of throwing");
      ok(/update server/.test(offDoc.ids["dl-note"].textContent), "offline note names the problem, not a forge");
      ok(blockHrefs(offDoc).length === 0, "offline block links nowhere");
      process.exitCode = fails ? 1 : 0;
      console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
    });
  });
}
