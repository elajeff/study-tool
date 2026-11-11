// Runs before the page is painted; the controls use the same root attribute.
export const themeScript = `(() => {
  const media = matchMedia("(prefers-color-scheme: dark)");
  function apply() {
    let saved;
    try { saved = localStorage.getItem("study-tool-theme"); } catch {}
    document.documentElement.dataset.theme = saved === "light" || saved === "dark"
      ? saved : (media.matches ? "dark" : "light");
  }
  apply();
  media.addEventListener("change", apply);
  window.addEventListener("storage", (event) => {
    if (event.key === "study-tool-theme" || event.key === null) apply();
  });
})();`;
