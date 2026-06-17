const menuButton = document.getElementById("menuButton");
const mainNavigation = document.getElementById("mainNavigation");
const directoryButton = document.getElementById("directoryButton");
const currentYear = document.getElementById("currentYear");

menuButton.addEventListener("click", () => {
  const isOpen = mainNavigation.classList.toggle("is-open");
  menuButton.setAttribute("aria-expanded", String(isOpen));
});

mainNavigation.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    mainNavigation.classList.remove("is-open");
    menuButton.setAttribute("aria-expanded", "false");
  });
});



currentYear.textContent = new Date().getFullYear();
