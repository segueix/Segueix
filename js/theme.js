const THEME_KEY = "catube_theme_bg";

function isLightColor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const y = (r * 299 + g * 587 + b * 114) / 1000;
  return y >= 160;
}

function applyTheme(bg) {
  document.documentElement.style.setProperty("--app-bg", bg);
  document.documentElement.style.setProperty(
    "--app-fg",
    isLightColor(bg) ? "#111111" : "#ffffff"
  );

  document.querySelectorAll(".swatch").forEach((b) => b.classList.remove("is-selected"));
  const sel = document.querySelector(
    `.swatch[data-theme="${(bg || "").replace(/"/g, '\\"')}"]`
  );
  if (sel) sel.classList.add("is-selected");
}

function openPopover() {
  const pop = document.getElementById("theme-popover");
  if (!pop) return;
  pop.classList.remove("hidden");
  pop.setAttribute("aria-hidden", "false");
}

function closePopover() {
  const pop = document.getElementById("theme-popover");
  if (!pop) return;
  pop.classList.add("hidden");
  pop.setAttribute("aria-hidden", "true");
}

function togglePopover() {
  const pop = document.getElementById("theme-popover");
  if (!pop) return;
  if (pop.classList.contains("hidden")) openPopover();
  else closePopover();
}

document.addEventListener("DOMContentLoaded", () => {
  const pop = document.getElementById("theme-popover");
  const btn = document.getElementById("btn-settings");

  console.log("theme.js loaded", { hasBtn: !!btn, hasPopover: !!pop });

  const saved = localStorage.getItem(THEME_KEY);
  if (saved) applyTheme(saved);

  document.querySelectorAll(".swatch").forEach((b) => {
    const c = b.getAttribute("data-theme");
    b.style.background = c;
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      localStorage.setItem(THEME_KEY, c);
      applyTheme(c);
      closePopover();
    });
  });

  document.addEventListener("click", (e) => {
    const settingsBtn = e.target.closest("#btn-settings");
    if (settingsBtn) {
      e.stopPropagation();
      togglePopover();
      return;
    }

    if (!pop || pop.classList.contains("hidden")) return;
    const inside = pop.contains(e.target) || (btn && btn.contains(e.target));
    if (!inside) closePopover();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePopover();
  });
});
