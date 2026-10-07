/* ChessSRS site — dynamic download block.
 *
 * The #download section fetches the app repo's releases live from the GitHub
 * API and turns its primary button into a direct download of the newest
 * installable build, with a per-file chooser beside it. When no build is
 * attached yet (or the API is unreachable) the static fallback — a link to
 * the releases page plus run-from-source — stays exactly as shipped, so the
 * button is never dead. Zero DOM dependencies in the pure helpers, so the
 * picking logic is unit-tested in tests/download.test.js.
 *
 * Release asset names come from the app repo's release workflow
 * (.github/workflows/release.yml `publish` job):
 *   chesssrs-{TAG}-linux-x64.tar.gz      desktop app, unpack and run
 *   chesssrs-{TAG}-android-testing.apk   installs directly, test-signed
 *   chesssrs-{TAG}-android-testing.aab   store-upload format, NOT installable
 */
(() => {
  /** Human platform label for a release asset file name. */
  function platformLabel(name) {
    const n = String(name ?? "").toLowerCase();
    if (n.endsWith(".aab")) return "Android (AAB · store upload, not installable)";
    if (n.endsWith(".apk")) return "Android (APK)";
    if (n.endsWith(".tar.gz") || n.endsWith(".tgz")) return "Linux (.tar.gz)";
    if (n.endsWith(".zip")) return "Archive (.zip)";
    if (n.endsWith(".deb") || n.endsWith(".rpm") || n.endsWith(".flatpak")) return "Linux package";
    if (n.endsWith(".exe") || n.endsWith(".msi")) return "Windows installer";
    if (n.endsWith(".dmg")) return "macOS disk image";
    return "Download";
  }

  /** Only files a visitor can actually install. The AAB the workflow uploads
   *  is Google's store-upload format and installs on nothing. */
  function isInstallable(name) {
    const n = String(name ?? "").toLowerCase();
    if (n.endsWith(".aab")) return false;
    return /\.(apk|tar\.gz|tgz|zip|deb|rpm|flatpak|exe|msi|dmg)$/.test(n);
  }

  /** Best direct-download asset for a platform hint. Prefers the newest
   *  release that carries an installable file, newest release first. */
  function pickPrimary(releases, platform) {
    const list = Array.isArray(releases) ? releases : [];
    for (const rel of list) {
      const assets = (Array.isArray(rel?.assets) ? rel.assets : []).filter((a) => isInstallable(a?.name));
      if (!assets.length) continue;
      const want =
        platform === "android"
          ? (assets.find((a) => /\.apk$/i.test(a.name)) ?? assets[0])
          : (assets.find((a) => /linux/i.test(a.name) || /\.tar\.gz$/i.test(a.name)) ??
            assets.find((a) => !/\.apk$/i.test(a.name)) ??
            assets[0]);
      return { release: rel, asset: want };
    }
    return null;
  }

  /** Newest release in the list, regardless of attachments. */
  function newestRelease(releases) {
    return Array.isArray(releases) && releases.length ? releases[0] : null;
  }

  function formatSize(bytes) {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n < 0) return "";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
    return `${(n / (1024 * 1024)).toFixed(n >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
  }

  function shortTag(tag) {
    return String(tag ?? "");
  }

  /** Rough OS hint for preselecting the primary file. Never used to hide
   *  anything — the chooser always lists every attachment. */
  function detectPlatform(uaDataPlatform, platformStr, userAgent) {
    const src = `${uaDataPlatform ?? ""} ${platformStr ?? ""} ${userAgent ?? ""}`.toLowerCase();
    if (/android/.test(src)) return "android";
    if (/linux/.test(src)) return "linux";
    return "other";
  }

  /** Owner/repo parsed from the page's own GitHub links, so a rename handled
   *  by scripts/sync-site.js flows through with no second edit. */
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

  function releasesPage(owner, repo) {
    return `https://github.com/${owner}/${repo}/releases`;
  }

  function el(doc, tag, attrs, text) {
    const node = doc.createElement(tag);
    for (const [k, v] of Object.entries(attrs ?? {})) {
      if (v != null) node.setAttribute(k, v);
    }
    if (text != null) node.textContent = text;
    return node;
  }

  /** Renders one asset row inside the chooser list. */
  function assetRow(doc, asset, tag) {
    const li = el(doc, "li", { class: "dl-file" });
    const label = platformLabel(asset.name);
    const link = el(doc, "a", { href: asset.browser_download_url }, asset.name);
    const size = formatSize(asset.size);
    const meta = el(doc, "span", { class: "mono mu" }, [label, size, tag].filter(Boolean).join(" · "));
    const head = el(doc, "div", { class: "dl-file-h" });
    const pill = el(doc, "span", { class: "dl-tag mono" }, label.split(" (")[0]);
    head.append(pill, link);
    li.append(head, meta);
    return li;
  }

  /** A chooser row as a single span (text + inline link/code), so the .dl
   *  flex row keeps its counter rhythm instead of spreading fragments apart. */
  function richRow(doc, parts) {
    const li = el(doc, "li");
    const s = el(doc, "span", {});
    for (const p of parts) {
      if (typeof p === "string") s.append(doc.createTextNode(p));
      else if (p.code) s.append(el(doc, "span", { class: "mono" }, p.code));
      else s.append(el(doc, "a", { href: p.href }, p.text));
    }
    li.append(s);
    return li;
  }

  /** Fills the #download block from live release data. Never throws: any
   *  unexpected shape falls back to the shipped static content. */
  function renderDownload(doc, releases, platform) {
    const title = doc.getElementById("dl-title");
    const sub = doc.getElementById("dl-sub");
    const primary = doc.getElementById("dl-primary");
    const primaryTx = doc.getElementById("dl-primary-tx");
    const pick = doc.getElementById("dl-pick");
    const note = doc.getElementById("dl-note");
    if (!title || !sub || !primary || !primaryTx || !pick) return "missing";
    try {
      const picked = pickPrimary(releases, platform);
      const newest = newestRelease(releases);
      while (pick.firstChild) pick.removeChild(pick.firstChild);
      if (picked) {
        const tag = shortTag(picked.release.tag_name);
        const osName = platform === "android" ? "Android" : platform === "linux" ? "Linux" : "your platform";
        title.textContent = `Get ChessSRS ${tag}.`;
        sub.textContent =
          `${picked.release.prerelease ? "Pre-release" : "Latest release"}` +
          `${picked.release.published_at ? ` · published ${String(picked.release.published_at).slice(0, 10)}` : ""}` +
          ".";
        primary.setAttribute("href", picked.asset.browser_download_url);
        const size = formatSize(picked.asset.size);
        primaryTx.textContent = `Download for ${osName}${size ? ` · ${size}` : ""}`;
        const files = (picked.release.assets ?? []).filter((a) => a?.name);
        for (const a of files) {
          if (!isInstallable(a.name)) {
            const li = el(doc, "li", { class: "dl-file skip" });
            li.append(el(doc, "span", {}, `${a.name} — store-upload format, not installable from here.`));
            pick.append(li);
            continue;
          }
          pick.append(assetRow(doc, a, tag));
        }
        const more = richRow(doc, [
          "Looking for something else? ",
          { href: picked.release.html_url ?? primary.getAttribute("href"), text: "All files and notes for this release" },
          ".",
        ]);
        pick.append(more);
        if (note) note.textContent = `Fetched live from GitHub · ${files.length} file${files.length === 1 ? "" : "s"} in ${tag}.`;
        return "direct";
      }
      if (newest) {
        const tag = shortTag(newest.tag_name);
        title.textContent = `Get ChessSRS ${tag}.`;
        sub.textContent = "This pre-release carries no installable files yet — grab the notes on GitHub, or run from source.";
        const url = newest.html_url ?? primary.getAttribute("href");
        primary.setAttribute("href", url);
        primaryTx.textContent = `See ${tag} on GitHub`;
        pick.append(
          richRow(doc, [
            "Installable builds (Linux tarball, Android APK) will appear here automatically once attached. ",
            { href: url, text: "Read the release notes" },
            ".",
          ]),
        );
        pick.append(
          richRow(doc, ["Developers can run it from source today: ", { code: "fvm flutter run -d linux" }, "."]),
        );
        if (note) note.textContent = `Fetched live from GitHub · ${tag} has no downloads attached yet.`;
        return "notes";
      }
      if (note) note.textContent = "No releases published yet — check back soon.";
      return "empty";
    } catch {
      return "error";
    }
  }

  /** Offline/API failure path: leave the shipped fallback in place and say
   *  so, instead of leaving the "Checking…" line hanging. */
  function renderOffline(doc) {
    const note = doc.getElementById("dl-note");
    if (note) note.textContent = "Couldn’t reach GitHub just now — the releases page link still works.";
    return "offline";
  }

  async function initDownload(doc, fetchFn, nav) {
    const repo = deriveRepo(doc);
    if (!repo) {
      renderOffline(doc);
      return "no-repo";
    }
    const platform = detectPlatform(nav?.userAgentData?.platform, nav?.platform, nav?.userAgent);
    try {
      const res = await fetchFn(releasesApi(repo.owner, repo.repo), {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!res?.ok) {
        renderOffline(doc);
        return "http";
      }
      const data = await res.json();
      return renderDownload(doc, data, platform);
    } catch {
      renderOffline(doc);
      return "error";
    }
  }

  function boot() {
    if (typeof document === "undefined") return;
    const run = () =>
      initDownload(
        document,
        typeof fetch === "function" ? fetch.bind(window) : () => Promise.reject(new Error("no fetch")),
        typeof navigator === "undefined" ? {} : navigator,
      );
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once: true });
    else run();
  }

  boot();

  const api = {
    platformLabel,
    isInstallable,
    pickPrimary,
    newestRelease,
    formatSize,
    detectPlatform,
    deriveRepo,
    releasesApi,
    releasesPage,
    renderDownload,
    renderOffline,
    initDownload,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else if (typeof window !== "undefined") window.ChessSRSDownload = api;
})();
