/* ChessSRS live demo — the Review screen with its menus. Toy repertoire; everything lives in memory.
   Logic (chess, PGN, scheduling) is in engine.js, piece art in pieces.js. */
(() => {
  const host = document.getElementById("app"); if (!host) return;
  const { F, START, sq, nm, genB, applyB, compile, parsePGN, toPGN, nextInterval } = window.SRSEngine;
  const NS = "http://www.w3.org/2000/svg", $ = (s, c = host) => c.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const days = n => n === 1 ? "1 day" : n + " days";

  /* ---------- data ---------- */
  const PRESETS = [
    { name: "white-vs-french", side: "w", lines: [
      { t: "White Vs [French]: Advance, short variation", s: "e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 a3 c4 Nbd2" },
      { t: "White Vs [French]: Advance, …Bd7 line", s: "e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Bd7 Be2 Nge7 Na3 cxd4 cxd4 Nf5 Nc2" }] },
    { name: "black-vs-sicilian", side: "b", lines: [
      { t: "Black Vs [Sicilian]: Najdorf, English Attack", s: "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6" }] }];
  const SAMPLE = `[Event "My Rep for White"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 Bb4+ 7. Nc3 Nxe4 8. O-O Bxc3 9. d5 Bf6 10. Re1 Ne7 *`;
  const ACC = [["Ultramarine", "#8A9BFF", "#2A3FD9"], ["Violet", "#B7A0FF", "#6B3FD4"], ["Verdigris", "#5FCBD3", "#0B7A83"], ["Ochre", "#F2B04D", "#9A5500"]];
  const set = { theme: "dark", accent: "#8A9BFF", sound: false, coords: true, arrows: true, retention: 88, limit: 20 };
  let studies = [], uid = 0, sel = 0, practice = false, queue = [], cur = null, an = null, isrc = "file";
  const mkStudy = (name, side, lines) => {
    const s = { id: ++uid, name, side, active: true, lines: [] };
    for (const l of lines) { const m = compile(l.s), line = { t: l.t, s: l.s, m, cards: [] };
      m.forEach((_, k) => { if ((k % 2 === 0) === (side === "w")) line.cards.push({ k, line, due: true, ivl: 0, lapses: 0 }); }); s.lines.push(line); }
    return s;
  };
  studies = PRESETS.map(p => mkStudy(p.name, p.side, p.lines));
  const st = () => studies[sel], dueN = s => s.lines.reduce((n, l) => n + l.cards.filter(c => c.due).length, 0);

  /* ---------- markup ---------- */
  const ico = { chev: '<path d="m6 9 6 6 6-6"/>', dots: '<g fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></g>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>', check: '<path d="m5 12.5 5 5 9-10"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>' };
  const I = k => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ico[k]}</svg>`;
  const squares = [...Array(64)].map((_, i) => {
    const f = i & 7, r = i >> 3;
    const isDark = (f + r) % 2 === 1;
    return `<rect x="${f}" y="${r}" width="1" height="1" class="${isDark ? 'sq-d' : 'sq-l'}"/>` +
      (isDark ? `<rect x="${f}" y="${r}" width="1" height="1" fill="url(#hatch)"/>` : '');
  }).join("");
  host.innerHTML = `
  <div class="ah"><button class="as" data-a="picker" aria-haspopup="dialog"><span id="a-study"></span>${I("chev")}</button><span class="ad" id="a-due"></span>
    <span class="gap"></span><button class="ib2" data-a="settings" aria-label="Settings">${I("gear")}</button><button class="ib2" data-a="more" aria-label="Study menu">${I("dots")}</button></div>
  <div class="ab">
    <div class="bw"><div class="rk"></div>
      <svg class="bd" viewBox="0 0 8 8" role="application" tabindex="0" aria-label="Chess board. Arrow keys move the cursor, Enter picks up or drops a piece.">
        <defs><pattern id="hatch" width=".1" height=".1" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width=".012" height=".1" fill="currentColor"/></pattern>${window.PIECE_DEFS}</defs>
        <g class="board-squares">${squares}</g><g class="ov"></g><g class="pcs"></g><g class="arr" style="color:var(--aa)" opacity=".95"></g>
        <rect width="8" height="8" fill="none" stroke="currentColor" stroke-width=".035" class="board-frame"/>
      </svg><div class="fl"></div></div>
    <div class="ap">
      <div id="a-rev"><p class="at" id="a-title"></p><p class="aw"><i class="tn"></i><span id="a-turn"></span></p>
        <div class="rv" id="a-rv" hidden><svg class="pi" viewBox="0 0 45 45" aria-hidden="true"></svg><b id="a-sq"></b><p>Play this move to continue. The position will come back soon.</p></div></div>
      <div id="a-an" hidden></div><div id="a-empty" hidden></div>
      <div class="act" id="a-act"><button class="sk" data-a="skip" id="a-skip">Skip <kbd>S</kbd></button><button class="pill" data-a="cont" id="a-cont" hidden>Continue <kbd>Space</kbd></button></div>
    </div>
  </div><div class="mo" id="a-mo" hidden></div><p class="sr" role="status" aria-live="polite" id="a-live"></p>`;

  /* ---------- board ---------- */
  const bd = $(".bd"), layer = $(".pcs"), ov = $(".ov"), arr = $(".arr"), mo = $("#a-mo");
  let flip = false, pcs = [], selSq = -1, dests = [], drag = null, enabled = false, timer = 0, user = "w", lastMove = null, ac = null, opener = null, kb = -1, kbOn = false;
  const kc = { c: 4, r: 6 }, PN = { k: "king", q: "queen", r: "rook", b: "bishop", n: "knight", p: "pawn" };
  const at = i => pcs.find(p => p.i === i), D = i => [flip ? 7 - (i & 7) : i & 7, flip ? 7 - (i >> 3) : i >> 3];
  const art = ch => { const t = ch.toUpperCase(), isWhite = ch < "a"; return `<g class="pc-g ${isWhite ? "w" : "b"}" transform="scale(0.01)"><use href="#g${t}" class="halo"/><use href="#g${t}" class="line"/><use href="#g${t}" class="fill"/><use href="#d${t}" class="det"/></g>`; };
  const place = (p, i) => { p.i = i; const [c, r] = D(i); p.el.style.transform = `translate(${c}px,${r}px)`; };
  const labels = () => { $(".rk").innerHTML = [...Array(8)].map((_, r) => `<span>${flip ? r + 1 : 8 - r}</span>`).join(""); $(".fl").innerHTML = [...Array(8)].map((_, c) => `<span>${F[flip ? 7 - c : c]}</span>`).join(""); };
  function ping() { if (!set.sound) return; try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 620; g.gain.value = .04; o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + .05); } catch (e) {} }
  function setup(fen, f) {
    layer.innerHTML = ""; pcs = []; flip = f; labels(); selSq = -1; dests = []; mark(); arrow();
    fen.split("/").forEach((row, r) => { let c = 0; for (const ch of row) { if (+ch) { c += +ch; continue; }
      const el = document.createElementNS(NS, "g"); el.setAttribute("class", "p " + (ch < "a" ? "w" : "b")); el.innerHTML = art(ch); layer.append(el);
      const p = { ch, el, i: 0 }; place(p, r * 8 + c); pcs.push(p); c++; } });
  }
  function move(f, t) {
    const p = at(f), c = at(t), k = p.ch.toLowerCase(), drop = x => { if (x) { x.el.remove(); pcs.splice(pcs.indexOf(x), 1); } };
    drop(c);
    if (k === "p" && (f & 7) !== (t & 7) && !c) drop(at((f >> 3) * 8 + (t & 7)));
    if (k === "k" && Math.abs((f & 7) - (t & 7)) === 2) { const r = at((f >> 3) * 8 + (t > f ? 7 : 0)); r && place(r, (f >> 3) * 8 + (t > f ? 5 : 3)); }
    if (k === "p" && (t >> 3 === 0 || t >> 3 === 7)) { p.ch = p.ch < "a" ? "Q" : "q"; p.el.innerHTML = art(p.ch); }
    place(p, t);
  }
  const gen = i => { const b = Array(64).fill(""); pcs.forEach(p => b[p.i] = p.ch); return genB(b, i); };
  function mark(last, selected) {
    const box = (i, o) => { const [c, r] = D(i); return `<rect x="${c}" y="${r}" width="1" height="1" style="fill:var(--aa)" opacity="${o}"/>`; };
    let h = (last || []).map(i => box(i, .4)).join("") + (selected >= 0 ? box(selected, .55) : "");
    dests.forEach(i => { const [c, r] = D(i); h += at(i)
      ? `<circle cx="${c + .5}" cy="${r + .5}" r=".43" fill="none" stroke="#0D0F13" stroke-opacity=".45" stroke-width=".08"/>`
      : `<circle cx="${c + .5}" cy="${r + .5}" r=".15" fill="#0D0F13" fill-opacity=".45"/>`; });
    if (kbOn && kb >= 0) { const [c, r] = D(kb); h += `<rect x="${c + .04}" y="${r + .04}" width=".92" height=".92" fill="none" style="stroke:var(--aa)" stroke-width=".07"/>`; }
    ov.innerHTML = h;
  }
  function arrow(m) {
    arr.innerHTML = ""; if (!m || !set.arrows) return;
    const P = i => D(i).map(v => v + .5), [x1, y1] = P(sq(m.slice(0, 2))), [x2, y2] = P(sq(m.slice(2, 4))), dx = x2 - x1, dy = y2 - y1;
    const cx = (x1 + x2) / 2 - dy * .14, cy = (y1 + y2) / 2 + dx * .14, ux = x2 - cx, uy = y2 - cy, l = Math.hypot(ux, uy), hx = ux / l, hy = uy / l, h = .44;
    arr.innerHTML = `<path d="M${x1} ${y1}Q${cx} ${cy} ${x2 - hx * h * .8} ${y2 - hy * h * .8}" fill="none" stroke="currentColor" stroke-width=".17" stroke-linecap="round"/>` +
      `<path d="M${x2} ${y2}L${x2 - hx * h - hy * .25} ${y2 - hy * h + hx * .25}L${x2 - hx * h + hy * .25} ${y2 - hy * h - hx * .25}Z" fill="currentColor"/>`;
  }
  const snapTo = (L, n, side) => {                          // jump to the position after n plies without animation
    layer.classList.add("snap"); setup(START, side === "b");
    for (let j = 0; j < n; j++) move(sq(L.m[j].slice(0, 2)), sq(L.m[j].slice(2, 4)));
    lastMove = n ? [sq(L.m[n - 1].slice(0, 2)), sq(L.m[n - 1].slice(2, 4))] : null; mark(lastMove, -1); setTimeout(() => layer.classList.remove("snap"), 40);
  };

  /* ---------- input: drag a piece, or click it and then click a square ---------- */
  const idx = e => { const r = bd.getBoundingClientRect(), cl = v => Math.min(7, Math.max(0, v)),
    c = cl(Math.floor((e.clientX - r.left) / r.width * 8)), w = cl(Math.floor((e.clientY - r.top) / r.height * 8)); return flip ? (7 - w) * 8 + 7 - c : w * 8 + c; };
  const mine = p => (p.ch < "a") === (user === "w");
  const select = i => { selSq = i; dests = i < 0 ? [] : gen(i); mark(lastMove, i); };
  bd.addEventListener("pointerdown", e => {
    if (!enabled) return; const i = idx(e), p = at(i);
    if (selSq >= 0 && dests.includes(i)) return attempt(selSq, i);
    if (p && mine(p)) { select(i); drag = { p, from: i, x: e.clientX, y: e.clientY, moved: false }; p.el.style.transition = "none"; layer.append(p.el); bd.setPointerCapture(e.pointerId); }
    else select(-1);
  });
  bd.addEventListener("pointermove", e => {
    if (!drag) return; if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 5) drag.moved = true;
    if (drag.moved) { const r = bd.getBoundingClientRect(), s = r.width / 8; drag.p.el.style.transform = `translate(${(e.clientX - r.left) / s - .5}px,${(e.clientY - r.top) / s - .5}px)`; }
  });
  const release = (e, cancel) => {
    if (!drag) return; const { p, from, moved } = drag; drag = null; p.el.style.transition = "";
    const i = cancel ? -1 : idx(e); if (moved && dests.includes(i)) attempt(from, i); else { place(p, from); if (moved) select(-1); }
  };
  bd.addEventListener("pointerup", e => release(e)); bd.addEventListener("pointercancel", e => release(e, true));

  /* ---------- keyboard: arrows move a cursor, Enter selects and moves ---------- */
  const NAMES = { k: "king", q: "queen", r: "rook", b: "bishop", n: "knight", p: "pawn" };
  const desc = i => { const p = at(i); return nm(i) + (p ? `, ${p.ch < "a" ? "white" : "black"} ${NAMES[p.ch.toLowerCase()]}` : ", empty"); };
  bd.addEventListener("focus", () => { kbOn = true; if (kb < 0) kb = sq(user === "w" ? "e2" : "e7"); mark(lastMove, selSq); say(desc(kb)); });
  bd.addEventListener("blur", () => { kbOn = false; mark(lastMove, selSq); });
  bd.addEventListener("keydown", e => {
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[e.key]) { e.preventDefault(); const [c, r] = D(kb), nc = Math.min(7, Math.max(0, c + arrows[e.key][0])), nr = Math.min(7, Math.max(0, r + arrows[e.key][1]));
      kb = flip ? (7 - nr) * 8 + 7 - nc : nr * 8 + nc; mark(lastMove, selSq); say(desc(kb)); return; }
    if (e.key === "Escape") { select(-1); say("Selection cleared"); return; }
    if (e.key !== "Enter" && e.key !== " ") return; e.preventDefault(); if (!enabled) return;
    const p = at(kb);
    if (selSq >= 0 && dests.includes(kb)) return attempt(selSq, kb);
    if (p && mine(p)) { select(kb); say(`${desc(kb)} selected. ${dests.length} squares to move to.`); } else { select(-1); say(`${desc(kb)}. Not one of your pieces.`); }
  });

  /* ---------- review: cards, queue, scheduling ---------- */
  const say = t => $("#a-live").textContent = t;
  const view = n => { $("#a-rev").hidden = n !== "rev"; $("#a-an").hidden = n !== "an"; $("#a-empty").hidden = n !== "empty"; $("#a-act").hidden = n !== "rev"; };
  function head() { const s = st(); $("#a-study").textContent = s ? s.name : "No repertoire"; $("#a-due").textContent = !s ? "" : !s.active ? "Paused" : practice ? "Practice" : dueN(s) + " due"; }
  const turn = () => $("#a-turn").textContent = (user === "w" ? "White" : "Black") + " to play" + (practice ? " · Practice" : "");
  function startSession() {
    clearTimeout(timer); cur = null; an = null; enabled = false; const s = st(); queue = [];
    if (s && s.active) { const all = s.lines.flatMap(l => l.cards); queue = (practice ? all : all.filter(c => c.due)).slice(0, set.limit); }
    head(); queue.length ? present(queue[0]) : empty();
  }
  function present(c) {
    clearTimeout(timer); const s = st(), L = c.line, again = cur && cur.line === L && c.k === cur.k + 2;
    view("rev"); user = s.side; enabled = false; $("#a-title").textContent = L.t; $("#a-cont").hidden = true; $("#a-skip").hidden = false; reveal(); head();
    const go = () => { cur = { c, line: L, missed: false, wait: false }; enabled = true; turn(); };
    if (again) { play(L.m[cur.c.k + 1]); timer = setTimeout(go, 430); }                        // the opponent replies, then it is your move
    else { snapTo(L, c.k, s.side); go(); }
  }
  function play(m) { const f = sq(m.slice(0, 2)), t = sq(m.slice(2, 4)); move(f, t); lastMove = [f, t]; mark(lastMove, -1); ping(); }
  function reveal(m) {
    $("#a-rv").hidden = !m; arrow(m); if (!m) return;
    const p = at(sq(m.slice(0, 2)));
    const isW = p && p.ch < "a";
    const pieceId = p ? p.ch.toUpperCase() : "P";
    $(".pi").setAttribute("viewBox", "0 0 100 100");
    $(".pi").innerHTML = `<g class="pc-g ${isW ? "w" : "b"}"><use href="#g${pieceId}" class="halo"/><use href="#g${pieceId}" class="line"/><use href="#g${pieceId}" class="fill"/><use href="#d${pieceId}" class="det"/></g>`;
    $("#a-sq").textContent = m.slice(2, 4); say(`Play ${m.slice(2, 4)} to continue.`);
  }
  function rate(c, ok) { if (practice) return; if (ok) { c.ivl = nextInterval(c.ivl, set.retention); c.due = false; } else { c.lapses++; c.ivl = 0; c.due = true; } head(); }
  function miss() { if (!cur.missed) { cur.missed = true; rate(cur.c, false); } }
  function attempt(f, t) {
    select(-1); const want = cur.line.m[cur.c.k];
    if (nm(f) + nm(t) === want.slice(0, 4)) {
      move(f, t); lastMove = [f, t]; mark(lastMove, -1); ping(); enabled = false; reveal();
      if (cur.missed) { cur.wait = true; $("#a-turn").textContent = "That's the move"; $("#a-skip").hidden = true; $("#a-cont").hidden = false; }   // wait for Continue
      else { rate(cur.c, true); $("#a-turn").textContent = "Remembered" + (practice ? "" : " · back in " + days(cur.c.ivl)); timer = setTimeout(next, 750); }
    } else { miss(); reveal(want); place(at(f), f); }                                           // not remembered: show the move, don't interrupt
  }
  const skip = () => { if (enabled && cur) { miss(); reveal(cur.line.m[cur.c.k]); } };
  const cont = () => { if (cur && cur.wait) next(); };
  function next() { const done = queue.shift(); if (cur.missed && !practice) queue.push(done); head(); queue.length ? present(queue[0]) : empty(); }
  function empty() {
    enabled = false; cur = null; select(-1); reveal(); view("empty"); head(); const s = st(); let h;
    if (!s) h = `<h3>No repertoire yet</h3><p>Import a PGN to start reviewing.</p><button class="pill" data-a="import">Import repertoire</button>`;
    else if (!s.active) h = `<h3>Paused</h3><p>Reviews for this study are paused.</p><button class="pill" data-a="pause">Resume</button>`;
    else { const iv = s.lines.flatMap(l => l.cards.map(c => c.ivl)).filter(x => x > 0);
      h = `<h3>All caught up</h3><p>Nothing is due in ${esc(s.name)}.${iv.length ? " The next review is in " + days(Math.min(...iv)) + "." : ""}</p><div class="cta2"><button class="pill" data-a="practice">Practice</button><button class="sk" data-a="restart">Start over</button></div>`; }
    $("#a-empty").innerHTML = h;
  }

  /* ---------- analyze ---------- */
  function showPly(i) { an.i = Math.max(0, Math.min(an.L.m.length, i)); snapTo(an.L, an.i, st().side); drawAn(); }
  function drawAn() {
    const t = an.L.s.split(" ");
    $("#a-an").innerHTML = `<p class="at">${esc(an.L.t)}</p><div class="mv">${t.map((x, i) => (i % 2 ? "" : `<span class="n">${i / 2 + 1}.</span>`) + `<button data-a="ply" data-i="${i + 1}" class="${an.i === i + 1 ? "on" : ""}">${esc(x)}</button>`).join("")}</div>` +
      `<div class="act"><button class="sk" data-a="aback">Back to review</button><span class="nv2"><button data-a="aprev" aria-label="Previous move">‹</button><button data-a="anext" aria-label="Next move">›</button></span></div>`;
  }
  function analyze() { closeModal(); const s = st(); clearTimeout(timer); const L = cur ? cur.line : s.lines[0]; cur = null; enabled = false; reveal(); view("an"); an = { L, i: 0 }; showPly(0); }

  /* ---------- sheets ---------- */
  function modal(title, body) {
    opener = document.activeElement; mo.innerHTML = `<div class="sh" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="sht"><b>${esc(title)}</b><button class="x" data-a="close" aria-label="Close">${I("x")}</button></div>${body}</div>`;
    mo.hidden = false; (mo.querySelector("[autofocus],textarea,input:not([type=file]),.row,.pill") || mo.querySelector(".x")).focus();
  }
  function closeModal() { if (mo.hidden) return; mo.hidden = true; mo.innerHTML = ""; opener && opener.focus && opener.focus(); }
  const row = (a, label, sub, extra = "") => `<button class="row ${extra}" data-a="${a}"><span>${label}${sub ? `<small>${sub}</small>` : ""}</span></button>`;
  const picker = () => modal("Studies", `<div class="grp">${studies.map((s, i) => `<button class="row" data-a="pick" data-i="${i}"><span>${esc(s.name)}<small>${s.active ? dueN(s) + " due" : "Paused"}</small></span>${i === sel ? I("check") : ""}</button>`).join("")}</div><div class="grp">${row("import", "Import repertoire")}</div>`);
  const more = () => { const s = st(); if (!s) return importModal(); modal(s.name, `<div class="grp">${row("analyze", "Analyze", "Browse moves and variations")}${row("practice", practice ? "End practice" : "Practice", "Drill lines without changing your schedule")}</div>` +
    `<div class="grp">${row("export", "Export PGN", "Share or copy standard PGN notation")}${row("pause", s.active ? "Pause" : "Resume", s.active ? "Stop scheduling reviews for this study" : "Start scheduling reviews again")}</div>` +
    `<div class="grp">${row("rename", "Rename")}${row("delete", "Delete", "", "danger")}</div>`); };
  const switchRow = (k, label) => `<label class="row"><span>${label}</span><input type="checkbox" role="switch" data-k="${k}" ${set[k] ? "checked" : ""}></label>`;
  const settings = () => modal("Settings", `<div class="grp">
    <div class="row"><span>Theme</span><span class="seg">${["dark", "light"].map(v => `<button data-a="theme" data-v="${v}" aria-pressed="${set.theme === v}">${v[0].toUpperCase() + v.slice(1)}</button>`).join("")}</span></div>
    <div class="row"><span>Accent</span><span class="swt">${ACC.map(([n, cd, cl]) => { const c = set.theme === "light" ? cl : cd; return `<button data-a="accent" data-v="${c}" style="--c:${c}" aria-label="${n}" aria-pressed="${set.accent === c}"></button>`; }).join("")}</span></div>
    ${switchRow("sound", "Sound")}${switchRow("coords", "Show move notation")}${switchRow("arrows", "Show arrows and circles")}</div>
    <div class="grp"><label class="row col"><span>Target retention <b id="v-ret">${set.retention}%</b></span><input type="range" min="80" max="95" value="${set.retention}" data-k="retention"></label>
    <label class="row col"><span>Daily limit <b id="v-lim">${set.limit}</b></span><input type="range" min="5" max="50" step="5" value="${set.limit}" data-k="limit"></label></div>
    <div class="grp">${row("about", "About")}</div>`);
  const about = () => modal("About", `<p class="pad">ChessSRS 0.2.0 is free software under GPL-3.0, a fork of Lichess Mobile. This demo runs entirely in your browser and saves nothing.</p><div class="grp"><a class="row" href="https://github.com/mansourvery-hub/chess-repertoire-srs" target="_blank" rel="noopener"><span>ChessSRS source</span></a><a class="row" href="https://github.com/lichess-org/mobile" target="_blank" rel="noopener"><span>Lichess Mobile source</span></a></div>`);
  const importModal = () => { isrc = "file"; modal("Import Repertoire", `<div class="seg wide">${[["lichess", "Lichess Study"], ["file", "PGN Text / File"]].map(([v, l]) => `<button data-a="isrc" data-v="${v}" aria-pressed="${v === "file"}">${l}</button>`).join("")}</div>
    <div id="i-file"><textarea id="i-pgn" rows="6" spellcheck="false" aria-label="PGN text">${esc(SAMPLE)}</textarea><label class="filebtn">Choose a .pgn file<input type="file" id="i-f" accept=".pgn,.txt"></label></div>
    <div id="i-li" hidden><input id="i-url" placeholder="https://lichess.org/study/…" aria-label="Lichess study URL"></div>
    <input id="i-title" placeholder="Study Title (optional)" aria-label="Study title (optional)"><p class="err" id="i-err" role="alert" hidden></p>
    <button class="pill big" data-a="doimport">Import and Start Review</button>`); };
  function doImport() {
    const err = $("#i-err"), fail = m => { err.textContent = "Import failed: " + m; err.hidden = false; };
    if (isrc === "lichess") return fail("this demo can't reach Lichess. Paste PGN text instead.");
    try { const g = parsePGN($("#i-pgn").value), title = $("#i-title").value.trim() || g[0].title || "Imported Study";
      studies.push(mkStudy(title, g[0].side, g.map(x => ({ t: x.title, s: x.s })))); sel = studies.length - 1; practice = false; closeModal(); startSession(); }
    catch (e) { fail(e.message); }
  }
  const textIn = (id, val, ph) => `<input id="${id}" value="${esc(val)}" aria-label="${ph}" autofocus>`;

  /* ---------- actions ---------- */
  const A = {
    close: closeModal, picker, more, settings, about, import: importModal, doimport: doImport, analyze, skip, cont,
    pick: el => { sel = +el.dataset.i; practice = false; closeModal(); startSession(); },
    practice: () => { practice = !practice; closeModal(); startSession(); },
    pause: () => { const s = st(); s.active = !s.active; closeModal(); startSession(); },
    restart: () => { st().lines.forEach(l => l.cards.forEach(c => { c.due = true; c.ivl = 0; c.lapses = 0; })); startSession(); },
    export: () => modal("Export PGN", `<pre class="pgn2" id="x-pgn" tabindex="0">${esc(toPGN(st()))}</pre><div class="cta2"><button class="pill" data-a="copy">Copy PGN</button></div>`),
    copy: el => { const txt = toPGN(st()); (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => el.textContent = "Copied", () => { const r = document.createRange(); r.selectNodeContents($("#x-pgn")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); el.textContent = "Selected: press Ctrl+C"; }); },
    rename: () => modal("Rename", `${textIn("r-in", st().name, "Study name")}<div class="cta2"><button class="pill" data-a="dorename">Rename</button><button class="sk" data-a="close">Cancel</button></div>`),
    dorename: () => { const v = $("#r-in").value.trim(); if (v) st().name = v; closeModal(); head(); },
    delete: () => modal("Delete study", `<p class="pad">Delete ${esc(st().name)}? Its lines and review schedule are removed.</p><div class="cta2"><button class="pill danger" data-a="dodelete">Delete</button><button class="sk" data-a="close">Cancel</button></div>`),
    dodelete: () => { studies.splice(sel, 1); sel = Math.max(0, sel - 1); practice = false; closeModal(); startSession(); },
    isrc: el => { isrc = el.dataset.v; mo.querySelectorAll("[data-a=isrc]").forEach(b => b.setAttribute("aria-pressed", b === el)); $("#i-file").hidden = isrc !== "file"; $("#i-li").hidden = isrc !== "lichess"; },
    theme: el => { set.theme = el.dataset.v; apply(); mo.querySelectorAll("[data-a=theme]").forEach(b => b.setAttribute("aria-pressed", b === el)); },
    accent: el => { set.accent = el.dataset.v; apply(); mo.querySelectorAll("[data-a=accent]").forEach(b => b.setAttribute("aria-pressed", b === el)); },
    ply: el => showPly(+el.dataset.i), aprev: () => showPly(an.i - 1), anext: () => showPly(an.i + 1), aback: () => startSession()
  };
  function apply() { host.classList.toggle("light", set.theme === "light"); host.classList.toggle("nocoord", !set.coords); host.style.setProperty("--aa", set.accent); }
  host.addEventListener("click", e => { if (e.target === mo) return closeModal(); const a = e.target.closest("[data-a]"); if (a && A[a.dataset.a]) A[a.dataset.a](a); });
  const onSetting = e => { const k = e.target.dataset.k; if (!k) return; set[k] = e.target.type === "checkbox" ? e.target.checked : +e.target.value; apply();
    if (k === "retention") $("#v-ret").textContent = set.retention + "%"; if (k === "limit") { $("#v-lim").textContent = set.limit; if (e.type === "change") startSession(); } };
  mo.addEventListener("input", onSetting); mo.addEventListener("change", e => { onSetting(e); if (e.target.id === "i-f" && e.target.files[0]) e.target.files[0].text().then(t => $("#i-pgn").value = t); });
  addEventListener("keydown", e => {
    if (!mo.hidden) { if (e.key === "Escape") closeModal(); else if (e.key === "Enter" && e.target.id === "r-in") A.dorename();
      else if (e.key === "Tab") { const f = [...mo.querySelectorAll("button,input,textarea,a[href]")].filter(x => !x.hidden && x.offsetParent !== null), i = f.indexOf(document.activeElement);
        if (f.length && (e.shiftKey ? i <= 0 : i === f.length - 1)) { e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0].focus(); } } return; }
    if (e.metaKey || e.ctrlKey || e.altKey || (document.activeElement !== document.body && !host.contains(document.activeElement)) || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if (an) { if (e.key === "ArrowLeft") showPly(an.i - 1); if (e.key === "ArrowRight") showPly(an.i + 1); return; }
    if (e.key.toLowerCase() === "s") skip(); else if (e.key === " " && cur && cur.wait && !/BUTTON|A/.test(document.activeElement.tagName)) { e.preventDefault(); cont(); }
  });
  apply(); startSession();
})();
