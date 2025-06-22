document.addEventListener("DOMContentLoaded", () => {
  const sections = document.querySelectorAll("section");
  const navLinks = document.querySelectorAll(".scrollspy a");
  const scrollspy = document.querySelector(".scrollspy");

  window.addEventListener("scroll", () => {
    if (window.scrollY > 450) {
      scrollspy.classList.add("visible");
    } else {
      scrollspy.classList.remove("visible");
    }

    let current = "";
    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      if (window.pageYOffset >= sectionTop - 800) {
        current = section.getAttribute("id");
      }
    });

    navLinks.forEach(link => {
      link.classList.remove("active");
      if (link.getAttribute("href") === "#" + current) {
        link.classList.add("active");
      }
    });
  });
});
