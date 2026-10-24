// Mobile nav toggle
const navToggle = document.getElementById("navToggle");
const navLinks = document.getElementById("navLinks");

navToggle.addEventListener("click", () => {
  const isOpen = navLinks.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

// Close the mobile menu after clicking a link
navLinks.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
  });
});

// Highlight the active nav link based on scroll position
const sections = document.querySelectorAll("section[id]");
const linkMap = new Map(
  Array.from(navLinks.querySelectorAll("a")).map((a) => [
    a.getAttribute("href").slice(1),
    a,
  ])
);

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        linkMap.forEach((a) => a.classList.remove("active"));
        const active = linkMap.get(entry.target.id);
        if (active) active.classList.add("active");
      }
    });
  },
  { rootMargin: "-50% 0px -50% 0px" }
);

sections.forEach((section) => observer.observe(section));
