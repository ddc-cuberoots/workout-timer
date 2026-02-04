const scrollButtons = document.querySelectorAll("[data-scroll]");

scrollButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = document.querySelector(btn.dataset.scroll);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});
