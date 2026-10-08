# ChessSRS Site — Experience Invariants

Durable rules for the marketing site's conversion paths. Unlike
`docs/demo-spec.md` (which mirrors the *app*) or `docs/claims-audit.md`
(which audits *claims*), this file constrains the *site's own behavior*:
getting the app and supporting the project must flow with zero friction.

Violating any invariant fails the gates in §4, not just review.

## I-1. Download in two clicks, zero detours

- The `#download` block is one button plus one platform menu. Click
  **Download** → pick the platform → the file downloads straight away from
  its attachment URL. No accounts, no intermediate pages, no forge, host, or
  build-toolchain surface anywhere in the block.
- The homepage carries **no developer instructions** (no build/run commands,
  no source checkouts). Developer paths live with the Source links in the
  nav and footer, where developers already look.
- The file list is fetched live from the releases API at page load
  (`download.js`); the version shown is the **live release tag**, never a
  hardcoded string. Until a release carries installable files, the button
  waits honestly as **"Coming soon"** with "Installable builds are on the
  way — Linux and Android first." A dead button, a placeholder href, or a
  silently stale version all violate this invariant.
- Only genuinely installable files are offered (store-upload bundles are
  never listed). Nothing installable is hidden; every attachment gets a
  menu row with its platform and size.
- Styling reuses the existing system (`.dl` card, `.btn.p` primary block,
  `.mono` meta, `--ac` pills). No new palette, no framework, no second
  button language.

## I-2. Every support route works, whoever provides it

"Support routes" means: every outbound link inside `#support`, the footer's
Support list, the donation link in the FAQ answer, and the external services
named in `privacy.html` §3 — **selected by DOM scope, not by provider name**.

- Each one must resolve to HTTP < 400 when followed (redirects allowed).
- None may be a placeholder (RFC 2606 names, `YOUR_*`/`TODO`/`XXX` tokens —
  same patterns as the existing `basic.spec.js` gate).
- Adding a new support/donation provider means adding its link inside one of
  those scopes; it is then covered automatically. No invariant text or test
  needs editing to cover a new provider, and none names current providers
  verbatim for that reason.
- External donation links open in a new tab with `rel="noopener"` so the
  donation page can never navigate the site away underneath the visitor.

## I-3. No platform is presented as released before it ships

- A platform appears in the chooser only via a real attached file. The
  release workflow's packaging list (Linux tarball, Android APK/AAB) is what
  *can* appear; the API response is what *does*.
- Pre-releases are labeled as such wherever the live tag is shown.
- Copy outside `#download` (FAQ "Which platforms…", claims audit) must agree
  with the same facts; see `docs/claims-audit.md` §2 for the current state.

## I-4. Gates

| Gate | Catches |
|---|---|
| `node tests/download.test.js` (in `npm test`) | picking logic, AAB exclusion, honest waiting state, no external links inside `#download` |
| `node tests/support-links.test.js` (in `npm test`) | placeholder hrefs in support scopes; live reachability of every support route |
| `tests/e2e/download.spec.js` (in `npm run test:e2e`) | menu opens from the button and a platform click starts a real download; waiting state exposes no external links; offline degrades with no page errors |
| `tests/e2e/basic.spec.js` (existing) | placeholder hrefs anywhere shipped; canonical/OG integrity |

`python3 build.py` must still pass: the bundle inlines the new script and the
shipped `_headers` must allow the releases-API request (`connect-src`).
