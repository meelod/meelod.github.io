(() => {
  const viewer = document.querySelector(".photo-viewer");
  if (!viewer || typeof viewer.showModal !== "function") return;

  const links = [...document.querySelectorAll("a[data-gallery]")];
  const image = viewer.querySelector(".viewer-image");
  const title = viewer.querySelector(".viewer-title");
  const caption = viewer.querySelector(".viewer-caption");
  const position = viewer.querySelector(".viewer-position");
  let current = 0;
  let opener = null;

  function show(index) {
    current = (index + links.length) % links.length;
    const link = links[current];
    image.src = link.href;
    image.alt = link.querySelector("img").alt;
    title.textContent = link.dataset.title;
    caption.textContent = link.closest("figure").querySelector("figcaption").textContent;
    position.textContent = `${current + 1} / ${links.length}`;
  }

  links.forEach((link, index) => {
    link.addEventListener("click", (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      opener = link;
      show(index);
      viewer.showModal();
    });
  });

  viewer.querySelector("[data-close]").addEventListener("click", () => viewer.close());
  viewer.querySelector("[data-previous]").addEventListener("click", () => show(current - 1));
  viewer.querySelector("[data-next]").addEventListener("click", () => show(current + 1));
  viewer.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      show(current + (event.key === "ArrowLeft" ? -1 : 1));
    }
  });
  viewer.addEventListener("click", (event) => {
    const rect = viewer.getBoundingClientRect();
    if (event.target === viewer && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) viewer.close();
  });
  // Swipe left/right to change photos; multi-finger touches (pinch-zoom) are ignored.
  let swipe = null;
  viewer.addEventListener("touchstart", ({ touches }) => {
    swipe = touches.length === 1 ? { x: touches[0].clientX, y: touches[0].clientY } : null;
  }, { passive: true });
  viewer.addEventListener("touchmove", ({ touches }) => {
    if (touches.length > 1) swipe = null;
  }, { passive: true });
  viewer.addEventListener("touchend", ({ changedTouches }) => {
    if (!swipe) return;
    const dx = changedTouches[0].clientX - swipe.x;
    const dy = changedTouches[0].clientY - swipe.y;
    swipe = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) show(current + (dx < 0 ? 1 : -1));
  }, { passive: true });
  viewer.addEventListener("close", () => {
    opener?.focus();
  });
})();
