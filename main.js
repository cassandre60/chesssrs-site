(() => {
  const root = document.documentElement, $ = (s, c = document) => [...c.querySelectorAll(s)];
  // Header border once the page scrolls
  const hd = $(".hd")[0], onScroll = () => hd.classList.toggle("on", scrollY > 8);
  addEventListener("scroll", onScroll, { passive: true }); onScroll();
  // Theme: follows the system until the visitor picks one
  $("#theme")[0].addEventListener("click", () => {
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("theme", root.dataset.theme); } catch {}
  });
  // Close the mobile menu after choosing a link
  $(".mm a").forEach(a => { a.addEventListener("click", () => a.closest("details").removeAttribute("open")); });
  // Scroll story: the sticky panel follows the active step
  const steps = $(".st"), panels = $(".pn");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      const i = steps.indexOf(e.target);
      steps.forEach((s, j) => { s.classList.toggle("act", i === j); });
      panels.forEach((p, j) => { p.classList.toggle("on", i === j); });
    }), { rootMargin: "-45% 0px -45% 0px" });
    steps.forEach(s => { io.observe(s); });
  }
  // Hero cursor spotlight: a golden-knight layer follows the cursor through
  // a small radial mask (desktop pointers only; touch keeps the static base).
  (() => {
    const hero = document.querySelector(".spot-hero"), layer = document.getElementById("spotReveal");
    if (!hero || !layer) return;
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const snap = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let tx = 0, ty = 0, cx = 0, cy = 0, live = false, seen = false, gen = 0;
    const put = (x, y) => {
      layer.style.maskPosition = `${x - 55}px ${y - 70}px`;
      layer.style.webkitMaskPosition = `${x - 55}px ${y - 70}px`;
    };
    const tick = (g) => {
      if (g !== gen) return;
      if (snap) { cx = tx; cy = ty; } else { cx += (tx - cx) * 0.22; cy += (ty - cy) * 0.22; }
      put(cx, cy);
      if (Math.abs(tx - cx) < 0.3 && Math.abs(ty - cy) < 0.3) {
        cx = tx; cy = ty; put(cx, cy); live = false; return;
      }
      requestAnimationFrame(() => tick(g));
    };
    hero.addEventListener("mousemove", (e) => {
      const r = hero.getBoundingClientRect();
      tx = e.clientX - r.left; ty = e.clientY - r.top;
      if (!seen) { seen = true; cx = tx; cy = ty; put(cx, cy); layer.style.opacity = "1"; return; }
      if (snap) { cx = tx; cy = ty; put(cx, cy); return; }
      if (!live) { live = true; gen += 1; requestAnimationFrame(() => tick(gen)); }
    });
    hero.addEventListener("mouseleave", () => {
      layer.style.opacity = "0"; seen = false; live = false; gen += 1;
    });
  })();
})();
