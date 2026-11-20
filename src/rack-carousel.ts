export function enableRackCarousels() {
  document.documentElement.classList.add('carousel-enabled');
  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLButtonElement>('.carousel-controls button');
    if (!button) return;
    const track = button.closest('.rack-carousel')?.querySelector<HTMLElement>('.carousel-track');
    if (!track) return;

    const maximum = track.scrollWidth - track.clientWidth;
    const first = track.firstElementChild as HTMLElement | null;
    const next = first?.nextElementSibling as HTMLElement | null;
    const step = first && next ? next.offsetLeft - first.offsetLeft : track.clientWidth;
    const forward = button.dataset.slide === '1';
    const target = forward
      ? track.scrollLeft >= maximum - 2 ? 0 : Math.min(maximum, track.scrollLeft + step)
      : track.scrollLeft <= 2 ? maximum : Math.max(0, track.scrollLeft - step);
    track.scrollTo({ left: target, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  });
}
