// hide scroll badge
window.addEventListener("scroll", () => {
  const scrollHint = document.querySelector(".scroll");
  if (window.scrollY > 50) {
    scrollHint.style.opacity = "0";
    scrollHint.style.pointerEvents = "none";
    scrollHint.style.animation = "none";
  } else {
    scrollHint.style.opacity = "1";
    scrollHint.style.pointerEvents = "auto";
    scrollHint.style.animation = "pulse 1.5s infinite";
  }
});