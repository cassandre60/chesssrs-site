/* ChessSRS Engine — legal chess rules via chess.js + domain-adapted FSRS-5 spaced repetition.
   Pure functions and models, zero DOM dependencies.
*/
(function (root) {
  'use strict';

  let ChessClass = null;
  if (typeof Chess !== 'undefined') {
    ChessClass = Chess;
  } else if (typeof require !== 'undefined') {
    try {
      const c = require('./chess.bundle.js');
      ChessClass = c.Chess || c;
    } catch (e) {
      try {
        const c2 = require('chess.js');
        ChessClass = c2.Chess || c2;
      } catch (e2) {}
    }
  }

  const F = "abcdefgh";
  const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
  const sq = n => (8 - parseInt(n[1], 10)) * 8 + F.indexOf(n[0]);
  const nm = i => F[i & 7] + (8 - (i >> 3));

  /* ---------- Chess FSRS Mathematical Model (Decision D015) ---------- */
  const DEFAULT_FSRS_PARAMS = {
    w0: 0.35,  // S0(Again)
    w2: 2.20,  // S0(Good)
    w4: 4.93,  // D0 base
    w5: 0.94,  // D0 slope
    w6: 1.05,  // D responsiveness
    w7: 0.01,  // D mean reversion
    w8: 1.49,
    w9: 0.14,
    w10: 0.94,
    w11: 2.18,
    w12: 0.09,
    w13: 0.34,
    w14: 1.26,
    sameDayThresholdDays: 1 / 24, // 1 hour
    sameDayGainFactor: 1.02,
    sameDayLapseFactor: 0.85,
    minStabilityDays: 0.02,       // ~30 minutes floor
    maxStabilityDays: 365 * 5     // 5 years cap
  };

  const FSRS_DECAY = -0.5;
  const FSRS_FACTOR = Math.pow(0.9, 1 / FSRS_DECAY) - 1; // 19 / 81 ≈ 0.2345679

  function fsrsRetrievability(elapsedDays, stabilityDays) {
    if (stabilityDays <= 0) return 0.0;
    const t = elapsedDays < 0 ? 0.0 : elapsedDays;
    return Math.pow(1 + FSRS_FACTOR * t / stabilityDays, FSRS_DECAY);
  }

  function fsrsIntervalForTarget(stabilityDays, targetRetention) {
    const r = Math.max(0.70, Math.min(0.99, targetRetention));
    const raw = (stabilityDays / FSRS_FACTOR) * (Math.pow(r, 1 / FSRS_DECAY) - 1);
    return (Number.isFinite(raw) && raw > 0) ? raw : 0.0;
  }

  function fsrsInitialDifficulty(rating, p = DEFAULT_FSRS_PARAMS) {
    const g = rating === 'again' ? 1 : 3;
    return Math.max(1.0, Math.min(10.0, p.w4 - (g - 3) * p.w5));
  }

  function fsrsNextDifficulty(d, rating, p = DEFAULT_FSRS_PARAMS) {
    const g = rating === 'again' ? 1 : 3;
    const delta = d - p.w6 * (g - 3);
    const reverted = p.w7 * p.w4 + (1 - p.w7) * delta;
    return Math.max(1.0, Math.min(10.0, reverted));
  }

  function fsrsInitialStability(rating, p = DEFAULT_FSRS_PARAMS) {
    return rating === 'again' ? p.w0 : p.w2;
  }

  function fsrsNextStabilitySuccess(d, s, r, p = DEFAULT_FSRS_PARAMS) {
    const safeS = s <= 0 ? p.minStabilityDays : s;
    const factor = Math.exp(p.w8) * (11 - d) * Math.pow(safeS, -p.w9) * (Math.exp((1 - r) * p.w10) - 1);
    return safeS * (1 + factor);
  }

  function fsrsNextStabilityLapse(d, s, r, p = DEFAULT_FSRS_PARAMS) {
    const safeS = s <= 0 ? p.minStabilityDays : s;
    return p.w11 * Math.pow(d, -p.w12) * (Math.pow(safeS + 1, p.w13) - 1) * Math.exp((1 - r) * p.w14);
  }

  class ChessFsrsCard {
    constructor(id) {
      this.id = id;
      this.stability = 0;
      this.difficulty = 0;
      this.repetitionCount = 0;
      this.lapseCount = 0;
      this.lastReviewedAt = null;
      this.nextDueAt = null;
      this.due = true;
    }

    schedule(rating, now = new Date(), targetRetention = 0.88, p = DEFAULT_FSRS_PARAMS) {
      const isColdStart = this.repetitionCount === 0 && this.stability <= 0;
      let elapsedDays = 0;
      if (this.lastReviewedAt) {
        const diffMs = now.getTime() - new Date(this.lastReviewedAt).getTime();
        elapsedDays = diffMs <= 0 ? 0 : diffMs / 86400000;
      }

      let newD, newS;
      if (isColdStart) {
        newD = fsrsInitialDifficulty(rating, p);
        newS = fsrsInitialStability(rating, p);
      } else {
        const prevS = this.stability <= 0 ? p.minStabilityDays : this.stability;
        const prevD = this.difficulty <= 0 ? fsrsInitialDifficulty('good', p) : this.difficulty;
        const r = fsrsRetrievability(elapsedDays, prevS);
        newD = fsrsNextDifficulty(prevD, rating, p);

        if (elapsedDays < p.sameDayThresholdDays) {
          newS = rating === 'again' ? prevS * p.sameDayLapseFactor : prevS * p.sameDayGainFactor;
        } else if (rating === 'again') {
          newS = fsrsNextStabilityLapse(newD, prevS, r, p);
        } else {
          newS = fsrsNextStabilitySuccess(newD, prevS, r, p);
        }
      }

      newS = Math.max(p.minStabilityDays, Math.min(p.maxStabilityDays, newS));
      const intervalDays = fsrsIntervalForTarget(newS, targetRetention);

      this.difficulty = newD;
      this.stability = newS;
      this.lastReviewedAt = now;
      this.nextDueAt = new Date(now.getTime() + Math.round(intervalDays * 86400000));
      if (rating === 'again') {
        this.lapseCount++;
        this.due = true;
      } else {
        this.repetitionCount++;
        this.due = false;
      }
      return { intervalDays, stability: newS, difficulty: newD };
    }
  }

  /* ---------- Chess rules & move generation (with chess.js fallback) ---------- */
  /* pseudo-legal fallback move generator */
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

  function getLegalMoves(fen, squareName, b) {
    if (ChessClass && fen) {
      try {
        const c = new ChessClass(fen);
        const moves = c.moves({ square: squareName, verbose: true });
        return moves.map(m => sq(m.to));
      } catch (e) {}
    }
    if (b) {
      return genB(b, sq(squareName));
    }
    return [];
  }

  function compile(sanStr) {
    if (!ChessClass) throw new Error("chess.js not loaded");
    const c = new ChessClass();
    const out = [];
    const tokens = sanStr.split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      try {
        const m = c.move(token);
        if (!m) throw new Error(`could not read the move “${token}”`);
        out.push(m.from + m.to);
      } catch (err) {
        throw new Error(`could not read the move “${token}”`);
      }
    }
    return out;
  }

  function parsePGN(text) {
    const games = text.trim().split(/\n\s*\n(?=\[Event)/);
    const out = [];
    for (const g of games) {
      const h = {};
      for (const m of g.matchAll(/\[(\w+)\s+"([^"]*)"\]/g)) h[m[1]] = m[2];
      let t = g.replace(/\{[^}]*\}/g, " ").replace(/;[^\n]*/g, " ").replace(/\[[^\]]*\]/g, " ");
      while (/\([^()]*\)/.test(t)) t = t.replace(/\([^()]*\)/g, " ");
      t = t.replace(/\$\d+/g, " ").replace(/\d+\.(\.\.)?/g, " ").replace(/1-0|0-1|1\/2-1\/2|\*/g, " ");
      const s = t.split(/\s+/).filter(Boolean).join(" ");
      if (!s) continue;
      const title = h.ChapterName || h.Event || h.Study || "Imported line";
      out.push({
        title,
        side: h.Orientation === "black" || /\bblack\b/i.test(h.Study || h.Event || "") ? "b" : "w",
        s
      });
    }
    if (!out.length) throw new Error("no moves found");
    return out;
  }

  function toPGN(study) {
    return study.lines.map(l => {
      const mv = l.s.split(" ").map((x, i) => (i % 2 ? "" : `${Math.floor(i / 2) + 1}. `) + x).join(" ");
      return `[Event "${study.name}"]\n[Chapter "${l.t}"]\n${study.side === "b" ? '[Orientation "black"]\n' : ""}${mv} *\n`;
    }).join("\n");
  }

  function nextInterval(ivl, retention) {
    // Solves optimal FSRS interval based on current stability and target retention
    const stability = ivl <= 0 ? DEFAULT_FSRS_PARAMS.w2 : ivl;
    return Math.max(1, Math.round(fsrsIntervalForTarget(stability, retention / 100)));
  }

  const api = {
    F,
    START,
    sq,
    nm,
    genB,
    compile,
    parsePGN,
    toPGN,
    nextInterval,
    getLegalMoves,
    fsrsRetrievability,
    fsrsIntervalForTarget,
    fsrsInitialDifficulty,
    fsrsNextDifficulty,
    fsrsInitialStability,
    fsrsNextStabilitySuccess,
    fsrsNextStabilityLapse,
    ChessFsrsCard,
    DEFAULT_FSRS_PARAMS,
    Chess: ChessClass
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.SRSEngine = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
