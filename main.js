(() => {
  const root = document.documentElement, $ = (s, c = document) => [...c.querySelectorAll(s)];
  // Header border once the page scrolls
  const hd = $(".hd")[0], onScroll = () => hd.classList.toggle("on", scrollY > 8);
  addEventListener("scroll", onScroll, { passive: true }); onScroll();
  // Theme: follows the system until the visitor picks one
  $("#theme")[0].addEventListener("click", () => {
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("theme", root.dataset.theme); } catch (e) {}
  });
  // Close the mobile menu after choosing a link
  $(".mm a").forEach(a => a.addEventListener("click", () => a.closest("details").removeAttribute("open")));
  // Scroll story: the sticky panel follows the active step
  const steps = $(".st"), panels = $(".pn");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      const i = steps.indexOf(e.target);
      steps.forEach((s, j) => s.classList.toggle("act", i === j));
      panels.forEach((p, j) => p.classList.toggle("on", i === j));
    }), { rootMargin: "-45% 0px -45% 0px" });
    steps.forEach(s => io.observe(s));
  }
})();
