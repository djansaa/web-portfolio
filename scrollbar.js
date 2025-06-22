window.addEventListener("scroll", () => {
  const indicator = document.getElementById("scroll-indicator");
  const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
  const scrollPercent = (window.scrollY / scrollHeight) * 100;
  indicator.style.height = scrollPercent + "%";
});