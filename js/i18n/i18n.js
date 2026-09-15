/* ==========================================================================
   FoldFX website — i18n engine
   Lightweight, dependency-free client translation for the static site.

   How it works
   ------------
   - Every translatable element carries data-i18n="key" (textContent),
     data-i18n-html="key" (innerHTML, for values containing markup) or
     data-i18n-attr="attr:key,attr:key" (attributes such as aria-label,
     alt, title, content, placeholder).
   - Dictionaries live in js/i18n/translations/<code>.js as flat
     "key": "value" pairs and register themselves on window.FX_I18N.
     Files are lazy-loaded only for the chosen language; English (en.js)
     is the fallback dictionary and is also lazy-loaded on demand.
   - The chosen language is persisted in localStorage ("foldfx-lang").
     First visit auto-detects from ?lang= URL parameter, then
     navigator.languages. A tiny inline guard in each page's <head>
     (html.fx-boot) hides the body until the dictionary is applied so
     an English flash is avoided; a failsafe timer always unhides it.
   - Arabic and Urdu switch the document to RTL via <html dir="rtl">;
     the 3D fold demo and its controls stay LTR (physical layout).
   - Dynamic strings in main.js read translations through window.FXLang.t()
     and re-render via FXLang.onChange().
   ========================================================================== */

(function (g, d) {
  "use strict";

  var BASE = g.FX_BASE_LANG || "en";
  var STORAGE_KEY = "foldfx-lang";
  var BOOT_FAILSAFE_MS = 2500;

  var reg = (g.FX_I18N = g.FX_I18N || {});
  var langs = g.FX_LANGS || [];
  var current = BASE;
  var changeFns = [];
  var loading = {};   /* code -> Promise */
  var booted = false; /* failsafe timer armed */

  /* ---------- dictionary lookup ---------- */

  function lookup(lang, key) {
    var dict = reg[lang];
    if (!dict) return undefined;
    if (Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
    /* also tolerate dotted paths into nested objects */
    var parts = key.split(".");
    var v = dict;
    for (var i = 0; i < parts.length; i++) {
      if (v == null) return undefined;
      v = v[parts[i]];
    }
    return typeof v === "string" ? v : undefined;
  }

  /* Translate a key; {year} placeholders are filled with the current year. */
  function t(key) {
    var v = lookup(current, key);
    if (v === undefined) v = lookup(BASE, key);
    if (v === undefined) return "";
    return String(v).replace(/\{year\}/g, String(new Date().getFullYear()));
  }

  /* ---------- dictionary loading ---------- */

  function loadDict(code) {
    if (reg[code]) return Promise.resolve();
    if (loading[code]) return loading[code];
    loading[code] = new Promise(function (resolve, reject) {
      var s = d.createElement("script");
      s.src = "js/i18n/translations/" + code + ".js";
      s.async = false;
      s.onload = function () {
        if (reg[code]) resolve();
        else reject(new Error("i18n: " + code + ".js did not register a dictionary"));
      };
      s.onerror = function () { reject(new Error("i18n: failed to load " + code + ".js")); };
      d.head.appendChild(s);
    });
    return loading[code];
  }

  /* ---------- DOM application ---------- */

  function apply(root) {
    root = root || d;
    /* match BOTH carriers: plain data-i18n and markup-carrying
       data-i18n-html (some elements have only the latter). */
    var els = root.querySelectorAll("[data-i18n], [data-i18n-html]");
    var i, el, key, val;
    for (i = 0; i < els.length; i++) {
      el = els[i];
      key = el.getAttribute("data-i18n") || el.getAttribute("data-i18n-html");
      val = t(key);
      if (val === "") continue; /* never wipe content on a missing key */
      if (el.hasAttribute("data-i18n-html")) el.innerHTML = val;
      else el.textContent = val;
    }
    var at = root.querySelectorAll("[data-i18n-attr]");
    for (i = 0; i < at.length; i++) {
      el = at[i];
      var pairs = el.getAttribute("data-i18n-attr").split(",");
      for (var j = 0; j < pairs.length; j++) {
        var p = pairs[j].split(":");
        if (p.length === 2) {
          val = t(p[1].trim());
          if (val !== "") el.setAttribute(p[0].trim(), val);
        }
      }
    }
  }

  function metaFor(code) {
    for (var i = 0; i < langs.length; i++) {
      if (langs[i].code === code) return langs[i];
    }
    return null;
  }

  function applyDir() {
    var m = metaFor(current);
    d.documentElement.setAttribute("lang", current);
    d.documentElement.setAttribute("dir", m && m.dir ? m.dir : "ltr");
  }

  /* ---------- boot guard ---------- */

  function clearBoot() {
    d.documentElement.classList.remove("fx-boot");
  }
  function armBoot() {
    if (booted) return;
    booted = true;
    g.setTimeout(clearBoot, BOOT_FAILSAFE_MS); /* never trap the user behind a blank page */
  }

  /* ---------- language switching ---------- */

  function setLang(code, opts) {
    opts = opts || {};
    var target = metaFor(code) ? code : BASE;

    return loadDict(target)
      .catch(function (err) {
        if (g.console && g.console.warn) g.console.warn(err.message || err);
        return null;
      })
      .then(function () {
        if (reg[target]) current = target;
        applyDir();
        apply(d);
        updateSwitcher();
        if (!opts.noSave) {
          try { g.localStorage.setItem(STORAGE_KEY, current); } catch (e) { /* storage unavailable */ }
        }
        clearBoot();
        for (var i = 0; i < changeFns.length; i++) {
          try { changeFns[i](current); } catch (e) { /* listener error must not break the rest */ }
        }
        return current;
      });
  }

  function onChange(fn) {
    if (typeof fn === "function") changeFns.push(fn);
  }

  /* ---------- switcher UI ---------- */

  var btn, menu, btnLabel;

  function buildSwitcher() {
    btn = d.getElementById("langBtn");
    menu = d.getElementById("langMenu");
    btnLabel = d.getElementById("langBtnLabel");
    if (!btn || !menu) return;

    langs.forEach(function (l) {
      var item = d.createElement("button");
      item.type = "button";
      item.className = "lang-item";
      item.setAttribute("role", "option");
      item.setAttribute("data-code", l.code);
      item.innerHTML = '<span class="lang-native"></span><span class="lang-en"></span>';
      item.querySelector(".lang-native").textContent = l.native;
      item.querySelector(".lang-en").textContent = l.en;
      item.addEventListener("click", function () {
        closeMenu();
        setLang(l.code);
      });
      menu.appendChild(item);
    });

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (menu.hasAttribute("hidden")) openMenu();
      else closeMenu();
    });
    d.addEventListener("click", function (e) {
      if (menu.hasAttribute("hidden")) return;
      if (!menu.contains(e.target) && e.target !== btn && !btn.contains(e.target)) closeMenu();
    });
    d.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu();
    });

    updateSwitcher();
  }

  function openMenu() {
    menu.removeAttribute("hidden");
    btn.setAttribute("aria-expanded", "true");
  }
  function closeMenu() {
    if (menu && !menu.hasAttribute("hidden")) menu.setAttribute("hidden", "");
    if (btn) btn.setAttribute("aria-expanded", "false");
  }
  function updateSwitcher() {
    if (!btn || !menu) return;
    var m = metaFor(current) || metaFor(BASE);
    if (btnLabel && m) btnLabel.textContent = m.native;
    var items = menu.querySelectorAll(".lang-item");
    for (var i = 0; i < items.length; i++) {
      items[i].setAttribute("aria-selected", items[i].getAttribute("data-code") === current ? "true" : "false");
    }
  }

  /* ---------- first-visit detection ---------- */

  function detect() {
    var q = null;
    try { q = new URLSearchParams(g.location.search).get("lang"); } catch (e) { /* older browsers */ }
    if (q && metaFor(q)) return { code: q, fromUrl: true };

    var saved = null;
    try { saved = g.localStorage.getItem(STORAGE_KEY); } catch (e) { /* storage unavailable */ }
    if (saved && metaFor(saved)) return { code: saved, fromUrl: false };

    var candidates = (g.navigator.languages && g.navigator.languages.length)
      ? g.navigator.languages
      : [g.navigator.language || BASE];
    for (var i = 0; i < candidates.length; i++) {
      var tag = String(candidates[i]);
      var exact = metaFor(tag.toLowerCase());
      if (exact) return { code: exact.code, fromUrl: false };
      var base = tag.toLowerCase().split("-")[0];
      var m = metaFor(base);
      if (m) return { code: m.code, fromUrl: false };
    }
    return { code: BASE, fromUrl: false };
  }

  /* ---------- init ---------- */

  function init() {
    buildSwitcher();
    var choice = detect();
    if (choice.code !== BASE) {
      armBoot();
      setLang(choice.code, { noSave: choice.fromUrl });
    } else {
      applyDir(); /* en stays LTR; still set lang="en" explicitly */
      /* The base dictionary must be registered too: dynamic lookups
         through FXLang.t() (form states, errors, etc.) would otherwise
         find nothing on a default-English visit. Static markup already
         carries the same English text, so re-applying is a no-op. */
      loadDict(BASE)
        .then(function () { apply(d); clearBoot(); })
        .catch(function (err) {
          if (g.console && g.console.warn) g.console.warn(err.message || err);
          clearBoot();
        });
    }
  }

  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", init);
  else init();

  /* ---------- public API ---------- */

  g.FXLang = {
    t: t,
    apply: apply,
    set: setLang,
    get: function () { return current; },
    locale: function () { return current; },
    onChange: onChange,
    langs: langs,
    metaFor: metaFor
  };
})(typeof window !== "undefined" ? window : globalThis, document);
