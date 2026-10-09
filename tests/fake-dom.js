// Shared minimal DOM fake for node unit tests.
//
// The single fake every test file uses: fixing a quirk here fixes it
// everywhere, and per-file fakes are how a selector-blind querySelectorAll
// once caused a false failure that cost real debug time (aria-expanded never
// landed on an element the stub hid). querySelectorAll is therefore
// selector-aware: it returns the trigger list for broad selectors and adds
// the #id match when the selector names one.
function fakeEl(tag) {
  return {
    tag,
    attrs: {},
    dataset: {},
    style: {},
    children: [],
    handlers: {},
    hidden: false,
    _tc: "",
    firstChild: null,
    setAttribute(k, v) {
      this.attrs[k] = String(v);
    },
    getAttribute(k) {
      return this.attrs[k] ?? null;
    },
    removeAttribute(k) {
      delete this.attrs[k];
    },
    addEventListener(t, f) {
      if (!this.handlers[t]) this.handlers[t] = [];
      this.handlers[t].push(f);
    },
    fire(t, e = {}) {
      for (const f of this.handlers[t] ?? []) f(e);
    },
    append(...nodes) {
      for (const n of nodes) this.children.push(n);
      this.firstChild = this.children[0] ?? null;
    },
    removeChild(n) {
      this.children = this.children.filter((c) => c !== n);
      this.firstChild = this.children[0] ?? null;
    },
    querySelector: () => undefined,
    closest: () => null,
    focus() {},
    get textContent() {
      return this._tc;
    },
    set textContent(v) {
      this._tc = String(v);
    },
  };
}

function fakeDoc(ids = [], triggers = []) {
  const byId = {};
  for (const id of ids) byId[id] = fakeEl("div");
  const doc = {
    ids: byId,
    handlers: {},
    triggers,
    getElementById: (id) => byId[id] ?? null,
    createElement: (t) => fakeEl(t),
    createTextNode: (v) => ({ nodeType: 3, text: String(v) }),
    querySelectorAll: (sel) => {
      const out = [...doc.triggers];
      const m = String(sel).match(/#([\w-]+)/);
      if (m && byId[m[1]] && !out.includes(byId[m[1]])) out.push(byId[m[1]]);
      return out;
    },
    addEventListener(t, f) {
      if (!this.handlers[t]) this.handlers[t] = [];
      this.handlers[t].push(f);
    },
  };
  return doc;
}

module.exports = { fakeEl, fakeDoc };
