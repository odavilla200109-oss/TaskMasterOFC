export function applyTheme(dark) {
  const r = document.documentElement;
  r.style.colorScheme = dark ? "dark" : "light";
  if (dark) {
    r.style.setProperty("--bg-card",    "rgba(8,18,13,0.97)");
    r.style.setProperty("--bg-glass",   "rgba(5,12,9,0.87)");
    r.style.setProperty("--border",     "rgba(16,185,129,0.17)");
    r.style.setProperty("--text-main",  "#d1fae5");
    r.style.setProperty("--text-sub",   "#6ee7b7");
    r.style.setProperty("--text-muted", "#6aaa8a");
    r.style.setProperty("--node-bg",    "rgba(8,18,13,0.97)");
    r.style.setProperty("--node-shadow","0 4px 28px rgba(0,0,0,.55),0 0 0 1px rgba(16,185,129,.07)");
  } else {
    r.style.setProperty("--bg-card",    "rgba(255,255,255,0.97)");
    r.style.setProperty("--bg-glass",   "rgba(255,255,255,0.76)");
    r.style.setProperty("--border",     "rgba(16,185,129,0.18)");
    r.style.setProperty("--text-main",  "#064e3b");
    r.style.setProperty("--text-sub",   "#065f46");
    r.style.setProperty("--text-muted", "#9ca3af");
    r.style.setProperty("--node-bg",    "rgba(255,255,255,0.97)");
    r.style.setProperty("--node-shadow","0 4px 20px rgba(16,185,129,.14),0 1px 4px rgba(0,0,0,.05)");
  }
}
