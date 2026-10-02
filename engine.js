/* ChessSRS demo engine — pure functions, no DOM. Board = array of 64 chars, index 0 = a8 … 63 = h1. */
(function (root) {
  const F = "abcdefgh", START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
  const sq = n => (8 - n[1]) * 8 + F.indexOf(n[0]), nm = i => F[i & 7] + (8 - (i >> 3));
  const fenB = fen => { const b = []; fen.split("/").forEach(r => { for (const ch of r) { if (+ch) for (let k = 0; k < +ch; k++) b.push(""); else b.push(ch); } }); return b; };

  /* pseudo-legal destinations (no check detection: the review only compares with the repertoire) */
  function genB(b, i) {
    const p = b[i], w = p < "a", t = p.toLowerCase(), r = i >> 3, c = i & 7, out = [];
    const add = (R, C) => { if (R < 0 || R > 7 || C < 0 || C > 7) return 0; const j = R * 8 + C, q = b[j]; if (q && (q < "a") === w) return 0; out.push(j); return !q; };
    if (t === "p") { const d = w ? -1 : 1, s = w ? 6 : 1;
      if (!b[(r + d) * 8 + c]) { out.push((r + d) * 8 + c); if (r === s && !b[(r + 2 * d) * 8 + c]) out.push((r + 2 * d) * 8 + c); }
      [-1, 1].forEach(dc => { const C = c + dc; if (C < 0 || C > 7) return; const q = b[(r + d) * 8 + C]; if (q && (q < "a") !== w) out.push((r + d) * 8 + C); }); }
    else if (t === "n") [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]].forEach(([a, e]) => add(r + a, c + e));
    else { const V = []; if (t !== "b") V.push([1, 0], [-1, 0], [0, 1], [0, -1]); if (t !== "r") V.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
      V.forEach(([a, e]) => { let R = r + a, C = c + e; while (add(R, C) && t !== "k") { R += a; C += e; } }); }
    return out;
  }
  function applyB(b, f, t) {
    const p = b[f], k = p.toLowerCase();
    if (k === "p" && (f & 7) !== (t & 7) && !b[t]) b[(f >> 3) * 8 + (t & 7)] = "";                       // en passant
    if (k === "k" && Math.abs((f & 7) - (t & 7)) === 2) { const r = (f >> 3) * 8; if (t > f) { b[r + 5] = b[r + 7]; b[r + 7] = ""; } else { b[r + 3] = b[r]; b[r] = ""; } } // castling
    b[t] = k === "p" && (t >> 3 === 0 || t >> 3 === 7) ? (p < "a" ? "Q" : "q") : p; b[f] = "";
  }
  function san2uci(b, white, san) {
    san = san.replace(/[+#!?]/g, "");
    if (/^[O0]-[O0](-[O0])?$/.test(san)) { const r = white ? 56 : 0, long = san.length > 3; return [r + 4, r + (long ? 2 : 6)]; }
    const m = san.match(/^([KQRBN])?([a-h])?([1-8])?x?([a-h][1-8])(?:=?[QRBN])?$/); if (!m) return null;
    const piece = m[1] || "P", t = sq(m[4]);
    for (let i = 0; i < 64; i++) { const ch = b[i];
      if (!ch || (ch < "a") !== white || ch.toUpperCase() !== piece) continue;
      if (m[2] && F[i & 7] !== m[2]) continue; if (m[3] && 8 - (i >> 3) !== +m[3]) continue;
      if (genB(b, i).includes(t)) return [i, t]; }
    if (piece === "P" && m[2]) { const i = (white ? (t >> 3) + 1 : (t >> 3) - 1) * 8 + F.indexOf(m[2]);   // en passant capture
      if (b[i] && b[i].toUpperCase() === "P" && (b[i] < "a") === white) return [i, t]; }
    return null;
  }
  function compile(sanStr) {                           // "e4 e5 Nf3" -> ["e2e4","e7e5","g1f3"]
    const b = fenB(START), out = []; let white = true;
    for (const s of sanStr.split(/\s+/).filter(Boolean)) {
      const mv = san2uci(b, white, s); if (!mv) throw new Error(`could not read the move “${s}”`);
      applyB(b, mv[0], mv[1]); out.push(nm(mv[0]) + nm(mv[1])); white = !white; }
    return out;
  }
  function parsePGN(text) {                            // -> [{title, side, s}] one entry per chapter (mainline only)
    const games = text.trim().split(/\n\s*\n(?=\[Event)/), out = [];
    for (const g of games) {
      const h = {}; for (const m of g.matchAll(/\[(\w+)\s+"([^"]*)"\]/g)) h[m[1]] = m[2];
      let t = g.replace(/\{[^}]*\}/g, " ").replace(/;[^\n]*/g, " ").replace(/\[[^\]]*\]/g, " ");
      while (/\([^()]*\)/.test(t)) t = t.replace(/\([^()]*\)/g, " ");
      t = t.replace(/\$\d+/g, " ").replace(/\d+\.(\.\.)?/g, " ").replace(/1-0|0-1|1\/2-1\/2|\*/g, " ");
      const s = t.split(/\s+/).filter(Boolean).join(" "); if (!s) continue;
      const title = h.ChapterName || h.Event || h.Study || "Imported line";
      out.push({ title, side: h.Orientation === "black" || /\bblack\b/i.test(h.Study || h.Event || "") ? "b" : "w", s });
    }
    if (!out.length) throw new Error("no moves found");
    return out;
  }
  function toPGN(study) {
    return study.lines.map(l => {
      const mv = l.s.split(" ").map((x, i) => (i % 2 ? "" : `${i / 2 + 1}. `) + x).join(" ");
      return `[Event "${study.name}"]\n[Chapter "${l.t}"]\n${study.side === "b" ? '[Orientation "black"]\n' : ""}\n${mv} *\n`;
    }).join("\n");
  }
  const STEPS = [1, 3, 7, 16, 35, 80];
  const nextInterval = (ivl, retention) => { const i = STEPS.findIndex(x => x > ivl), base = STEPS[i < 0 ? STEPS.length - 1 : i];
    return Math.max(1, Math.round(base * (1 - (retention - 90) / 25))); };   // higher target retention = shorter gaps

  const api = { F, START, sq, nm, fenB, genB, applyB, san2uci, compile, parsePGN, toPGN, nextInterval };
  if (typeof module !== "undefined") module.exports = api; else root.SRSEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
