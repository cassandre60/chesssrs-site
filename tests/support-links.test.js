// Support-route health gate (invariant I-2), deliberately provider-agnostic.
//
// Scopes are DOM regions, not provider names: every absolute https link found
// inside <section id="support">, <footer>, or a FAQ <details> is a "support
// route" and must (a) contain no placeholder and (b) resolve live. Adding a
// new donation provider inside one of those scopes covers it automatically;
// nothing here names any provider, so no edit is needed when the set grows.
const fs = require("fs");
const path = require("path");

let fails = 0;
const ok = (c, m) => {
  console.log((c ? "PASS " : "FAIL ") + m);
  if (!c) fails++;
};

const PLACEHOLDER = /(\.example|\.test|\.invalid|\.localhost|example\.(com|org|net)|your-)/i;
const FILL_ME_IN =
  /(YOUR[_-]?|USERNAME|USER[_-]?NAME|CHANGEME|CHANGE[_-]?ME|REPLACEME|FILL[_-]?ME|INSERT[_-]?HERE|\bTODO\b|XXX)/i;

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function region(re) {
  const m = html.match(re);
  return m ? m[1] : "";
}

const scopes = {
  support: region(/<section[^>]*id="support"[^>]*>([\s\S]*?)<\/section>/),
  footer: region(/<footer[^>]*>([\s\S]*?)<\/footer>/),
  faq: region(/<section[^>]*id="faq"[^>]*>([\s\S]*?)<\/section>/),
};

for (const [name, body] of Object.entries(scopes)) {
  ok(body.length > 0, `scope present: ${name}`);
}

const hrefs = new Map(); // url -> first scope seen in
for (const [name, body] of Object.entries(scopes)) {
  for (const m of body.matchAll(/href="(https:\/\/[^"]*)"/g)) {
    if (!hrefs.has(m[1])) hrefs.set(m[1], name);
  }
}
ok(hrefs.size > 0, `support scopes expose outbound links (${hrefs.size} found)`);

// Every external donation-style link must not navigate the site away.
for (const m of scopes.support.matchAll(/<a\s[^>]*href="(https:\/\/[^"]*)"[^>]*>/g)) {
  const tag = m[0];
  if (/target="_blank"/.test(tag)) {
    ok(/rel="[^"]*noopener[^"]*"/.test(tag), `new-tab support link carries rel=noopener: ${m[1]}`);
  }
}

const bad = [...hrefs.keys()].filter((u) => PLACEHOLDER.test(u) || FILL_ME_IN.test(u));
ok(bad.length === 0, bad.length ? `placeholder support links: ${bad.join(", ")}` : "no placeholder support links");

async function check(url) {
  // Transient egress flakes (bot-mitigation timeouts) must not fail the
  // gate: retry with backoff, and only fail when the link stays down.
  let last;
  for (const wait of [0, 2000, 5000]) {
    if (wait) await new Promise((r) => setTimeout(r, wait));
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25000);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) ChessSRS-site-linkcheck",
          Accept: "text/html,*/*",
        },
      });
      return { status: res.status };
    } catch (e) {
      last = e;
    } finally {
      clearTimeout(t);
    }
  }
  throw last;
}

(async () => {
  for (const [url, scope] of hrefs) {
    try {
      const { status } = await check(url);
      ok(status < 400, `${scope}: ${url} -> ${status}`);
    } catch (e) {
      ok(false, `${scope}: ${url} unreachable (${e.cause?.code ?? e.message})`);
    }
    // Stagger outbound hits so bot-mitigation never mistakes the gate for a burst.
    await new Promise((r) => setTimeout(r, 1500));
  }
  process.exitCode = fails ? 1 : 0;
  console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
})();
