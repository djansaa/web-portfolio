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

// portfolio filter logic
document.querySelectorAll('.filter-button').forEach(button => {
  button.addEventListener('click', () => {
    const filter = button.dataset.filter;
    
    document.querySelectorAll('.filter-button').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    document.querySelectorAll('.project').forEach(project => {
      if (filter === 'all' || project.classList.contains(filter)) {
        project.style.display = 'block';
      } else {
        project.style.display = 'none';
      }
    });
  });
});

// portfolio tech filter logic
document.querySelectorAll('.tech-button').forEach(button => {
  button.addEventListener('click', () => {
    const tech = button.dataset.tech;

    document.querySelectorAll('.tech-button').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    document.querySelectorAll('.project').forEach(project => {
      const hasTech = tech === 'all' || project.classList.contains(tech);
      project.style.display = hasTech ? 'block' : 'none';
    });
  });
});