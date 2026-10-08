/* ChessSRS site — download block.
 *
 * One button, one menu, zero friction: the visitor clicks Download, picks
 * their platform, and the file downloads straight away. No accounts, no
 * intermediate pages, no forge or build-toolchain surface anywhere in the
 * block — developers already have the Source links in the nav and footer.
 *
 * The file list is fetched live from the releases API at page load (repo
 * derived from the page's own links, so a rename handled by
 * scripts/sync-site.js flows through). Until a release carries installable
 * files, the button waits honestly as "Coming soon" instead of pretending.
 *
 * Release asset names come from the app repo's release workflow
 * (.github/workflows/release.yml `publish` job):
 *   chesssrs-{TAG}-linux-x64.tar.gz      desktop app, unpack and run
 *   chesssrs-{TAG}-android-testing.apk   installs directly, test-signed
 *   chesssrs-{TAG}-android-testing.aab   store-upload format, never offered
 */
(() => {
  /** Short platform name for a release asset file name. */
  function platformShort(name) {
    const n = String(name ?? "").toLowerCase();
    if (n.endsWith(".apk")) return "Android";
    if (n.endsWith(".tar.gz") || n.endsWith(".tgz")) return "Linux";
    if (n.endsWith(".aab")) return "Android";
    if (n.endsWith(".zip")) return "Archive";
    if (n.endsWith(".deb") || n.endsWith(".rpm") || n.endsWith(".flatpak")) return "Linux";
    if (n.endsWith(".exe") || n.endsWith(".msi")) return "Windows";
    if (n.endsWith(".dmg")) return "macOS";
    return "Download";
  }

  /** Only files a visitor can actually install. The AAB the workflow uploads
   *  is Google's store-upload format and installs on nothing. */
  function isInstallable(name) {
    const n = String(name ?? "").toLowerCase();
    if (n.endsWith(".aab")) return false;
    return /\.(apk|tar\.gz|tgz|zip|deb|rpm|flatpak|exe|msi|dmg)$/.test(n);
  }

  /** Newest release carrying at least one installable file, newest first. */
  function pickRelease(releases) {
    const list = Array.isArray(releases) ? releases : [];
    for (const rel of list) {
      const files = (Array.isArray(rel?.assets) ? rel.assets : []).filter((a) => isInstallable(a?.name));
      if (files.length) return { release: rel, files };
    }
    return null;
  }

  function formatSize(bytes) {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n < 0) return "";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
    return `${(n / (1024 * 1024)).toFixed(n >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
  }

  /** Owner/repo parsed from the page's own links, so a rename handled by
   *  scripts/sync-site.js flows through with no second edit. */
  function deriveRepo(doc) {
    const links = [...doc.querySelectorAll('a[href*="github.com/"]')];
    for (const a of links) {
      const m = String(a.getAttribute("href") ?? "").match(/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\/|$|[?#])/);
      if (m) return { owner: m[1], repo: m[2] };
    }
    return null;
  }

  function releasesApi(owner, repo) {
    return `https://api.github.com/repos/${owner}/${repo}/releases?per_page=10`;
  }

  function el(doc, tag, attrs, text) {
    const node = doc.createElement(tag);
    for (const [k, v] of Object.entries(attrs ?? {})) {
      if (v != null) node.setAttribute(k, v);
    }
    if (text != null) node.textContent = text;
    return node;
  }

  /** One menu row: platform pill plus file size. Clicking it navigates to
   *  the attachment URL, which the browser downloads directly. */
  function menuItem(doc, asset) {
    const a = el(doc, "a", { role: "menuitem", href: asset.browser_download_url });
    a.append(el(doc, "span", { class: "dl-tag mono" }, platformShort(asset.name)));
    const size = formatSize(asset.size);
    if (size) a.append(el(doc, "span", { class: "mono mu" }, size));
    return a;
  }

  function setMenuOpen(doc, open) {
    const primary = doc.getElementById("dl-primary");
    const menu = doc.getElementById("dl-menu");
    if (!primary || !menu) return;
    menu.hidden = !open;
    primary.setAttribute("aria-expanded", String(open));
    if (open) menu.querySelector("a")?.focus?.();
  }

  function bindMenu(doc) {
    const primary = doc.getElementById("dl-primary");
    const menu = doc.getElementById("dl-menu");
    if (!primary || !menu || primary.dataset?.bound) return;
    if (primary.dataset) primary.dataset.bound = "1";
    primary.addEventListener("click", () => setMenuOpen(doc, menu.hidden));
    menu.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        setMenuOpen(doc, false);
        primary.focus?.();
      }
    });
    menu.addEventListener("click", (e) => {
      if (e.target?.closest?.("a")) setMenuOpen(doc, false);
    });
    doc.addEventListener("click", (e) => {
      if (!menu.hidden && !e.target?.closest?.(".dl-cta")) setMenuOpen(doc, false);
    });
  }

  /** "Coming soon" state: honest wait, no external links, no dev noise. */
  function renderSoon(doc, note) {
    const title = doc.getElementById("dl-title");
    const sub = doc.getElementById("dl-sub");
    const primary = doc.getElementById("dl-primary");
    const primaryTx = doc.getElementById("dl-primary-tx");
    const menu = doc.getElementById("dl-menu");
    const noteEl = doc.getElementById("dl-note");
    if (!title || !sub || !primary || !primaryTx || !menu) return "missing";
    title.textContent = "Get ChessSRS.";
    sub.textContent = "Installable builds are on the way — Linux and Android first.";
    primary.setAttribute("disabled", "");
    primaryTx.textContent = "Coming soon";
    setMenuOpen(doc, false);
    if (noteEl && note) noteEl.textContent = note;
    return "soon";
  }

  /** Fills the block from live release data. Never throws: any unexpected
   *  shape degrades to the honest waiting state. */
  function renderDownload(doc, releases) {
    const title = doc.getElementById("dl-title");
    const sub = doc.getElementById("dl-sub");
    const primary = doc.getElementById("dl-primary");
    const primaryTx = doc.getElementById("dl-primary-tx");
    const menu = doc.getElementById("dl-menu");
    const noteEl = doc.getElementById("dl-note");
    if (!title || !sub || !primary || !primaryTx || !menu) return "missing";
    try {
      const picked = pickRelease(releases);
      if (!picked) return renderSoon(doc);
      const tag = String(picked.release.tag_name ?? "");
      while (menu.firstChild) menu.removeChild(menu.firstChild);
      for (const f of picked.files) menu.append(menuItem(doc, f));
      title.textContent = `Get ChessSRS ${tag}.`;
      sub.textContent = `${picked.release.prerelease ? "Pre-release" : "Latest release"} · pick your platform, the file downloads straight away.`;
      primary.removeAttribute("disabled");
      primaryTx.textContent = `Download ${tag}`;
      bindMenu(doc);
      if (noteEl) {
        const total = picked.files.map((f) => formatSize(f.size)).filter(Boolean).join(" · ");
        noteEl.textContent = `Latest build ${tag}${total ? ` · ${total}` : ""}.`;
      }
      return "direct";
    } catch {
      return renderSoon(doc);
    }
  }

  async function initDownload(doc, fetchFn) {
    const repo = deriveRepo(doc);
    if (!repo) return renderSoon(doc, "Couldn't reach the update server — check back soon.");
    try {
      const res = await fetchFn(releasesApi(repo.owner, repo.repo), {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!res?.ok) return renderSoon(doc, "Couldn't reach the update server — check back soon.");
      return renderDownload(doc, await res.json());
    } catch {
      return renderSoon(doc, "Couldn't reach the update server — check back soon.");
    }
  }

  function boot() {
    if (typeof document === "undefined") return;
    const run = () =>
      initDownload(
        document,
        typeof fetch === "function" ? fetch.bind(window) : () => Promise.reject(new Error("no fetch")),
      );
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once: true });
    else run();
  }

  boot();

  const api = {
    platformShort,
    isInstallable,
    pickRelease,
    formatSize,
    deriveRepo,
    releasesApi,
    setMenuOpen,
    renderSoon,
    renderDownload,
    initDownload,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else if (typeof window !== "undefined") window.ChessSRSDownload = api;
})();
