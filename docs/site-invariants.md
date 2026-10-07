# ChessSRS Site — Experience Invariants

Durable rules for the marketing site's conversion paths. Unlike
`docs/demo-spec.md` (which mirrors the *app*) or `docs/claims-audit.md`
(which audits *claims*), this file constrains the *site's own behavior*:
getting the app and supporting the project must flow with zero friction.

Violating any invariant fails the gates in §4, not just review.

## I-1. The download button always downloads something real

- The `#download` primary button (`#dl-primary`) resolves to a **direct file
  download** whenever the newest release carrying an installable attachment
  exists. The file list is fetched live from the releases API at page load
  (`download.js`), never from a hardcoded version or filename.
- Beside it, the chooser (`#dl-pick`) lists **every attachment** of that
  release with a platform label, so a visitor on any OS reaches their file
  in one more click. Nothing installable is hidden; nothing
  non-installable (e.g. store-upload bundles) is presented as installable.
- When no release carries files yet — or the API is unreachable — the button
  falls back to the **releases index page** (which always exists) and says so
  (`#dl-note`). A dead button, a placeholder href, or a silently stale
  version string all violate this invariant.
- The version shown in `#download` is the **live release tag**, not a
  hardcoded string. Static markup ships a truthful fallback ("Installable
  builds ship with GitHub releases") so no-JS and offline visitors still get
  a working path.
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
| `node tests/download.test.js` (in `npm test`) | picking logic: OS preselect, AAB exclusion, empty/error shapes |
| `node tests/support-links.test.js` (in `npm test`) | placeholder hrefs in support scopes; live reachability of every support route |
| `tests/e2e/download.spec.js` (in `npm run test:e2e`) | primary becomes a direct download with mocked assets; honest fallback with none; offline leaves the static path intact with no page errors |
| `tests/e2e/basic.spec.js` (existing) | placeholder hrefs anywhere shipped; canonical/OG integrity |

`python3 build.py` must still pass: the bundle inlines the new script and the
shipped `_headers` must allow the releases-API request (`connect-src`).
