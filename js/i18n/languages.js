/* ==========================================================================
   FoldFX website — language registry
   The 15 most-spoken languages plus Greek (el). Order = speaker count.
   - code : dictionary file name in js/i18n/translations/<code>.js
   - native: endonym shown in the switcher (never translated)
   - en   : English name shown as a secondary hint in the switcher
   - dir  : text direction for <html dir> (ar/ur are RTL)
   ========================================================================== */

(function (g) {
  "use strict";

  g.FX_LANGS = [
    { code: "en", native: "English",            en: "English",             dir: "ltr" },
    { code: "zh", native: "中文",                en: "Chinese (Mandarin)",  dir: "ltr" },
    { code: "hi", native: "हिन्दी",                en: "Hindi",               dir: "ltr" },
    { code: "es", native: "Español",            en: "Spanish",             dir: "ltr" },
    { code: "fr", native: "Français",           en: "French",              dir: "ltr" },
    { code: "ar", native: "العربية",            en: "Arabic",              dir: "rtl" },
    { code: "bn", native: "বাংলা",                en: "Bengali",             dir: "ltr" },
    { code: "pt", native: "Português",          en: "Portuguese",          dir: "ltr" },
    { code: "ru", native: "Русский",            en: "Russian",             dir: "ltr" },
    { code: "ur", native: "اردو",               en: "Urdu",                dir: "rtl" },
    { code: "id", native: "Bahasa Indonesia",   en: "Indonesian",          dir: "ltr" },
    { code: "de", native: "Deutsch",            en: "German",              dir: "ltr" },
    { code: "ja", native: "日本語",              en: "Japanese",            dir: "ltr" },
    { code: "mr", native: "मराठी",                en: "Marathi",             dir: "ltr" },
    { code: "te", native: "తెలుగు",               en: "Telugu",              dir: "ltr" },
    { code: "el", native: "Ελληνικά",           en: "Greek",               dir: "ltr" }
  ];

  g.FX_BASE_LANG = "en";
})(typeof window !== "undefined" ? window : globalThis);
