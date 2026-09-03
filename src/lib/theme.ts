const STORAGE_KEY = "finance-theme"; // "light" | "dark" | "auto"

export function getStoredTheme(): "light" | "dark" | "auto" {
  if (typeof window === "undefined") return "auto";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" ? v : "auto";
}

export function applyTheme(mode: "light" | "dark" | "auto") {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = mode === "dark" || (mode === "auto" && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
  document.cookie = `${STORAGE_KEY}=${mode}; path=/; max-age=31536000`;
  window.localStorage.setItem(STORAGE_KEY, mode);
}

export function initThemeListener() {
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (getStoredTheme() === "auto") applyTheme("auto");
    });
}

/** Inline script that applies the stored theme before first paint (no flash). */
export const themeInitScript = `(function(){try{var m=localStorage.getItem("finance-theme")||"auto";var d=m==="dark"||(m==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;
