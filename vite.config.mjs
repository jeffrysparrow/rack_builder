import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { carouselImageSizes, rackPhotoGroups, rackPhotos, rackPhotoSource } from './src/config/gallery.ts';

function photoMarkup(photo, eager = false) {
  const { src, srcSet, width, height } = rackPhotoSource(photo);
  const sizes = eager ? '(max-width: 720px) 100vw, 52vw' : carouselImageSizes;
  return `<img src="${src}" srcset="${srcSet}" sizes="${sizes}" width="${width}" height="${height}" alt="${photo.alt}" ${eager ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"'}>`;
}

export default defineConfig({
  plugins: [{
    name: 'tote-rack-static-photos',
    transformIndexHtml(html) {
      return html.replace('<!-- storefront-hero -->', photoMarkup(rackPhotos[2], true))
        .replace('<!-- photo-hero -->', photoMarkup(rackPhotos[2], true))
        .replace('<!-- rack-carousels -->', () => rackPhotoGroups.map(({ id, title, photos }) =>
          `<section class="rack-carousel" aria-labelledby="gallery-${id}">
            <div class="carousel-heading">
              <h3 id="gallery-${id}">${title}</h3>
              <div class="carousel-controls">
                <button type="button" data-slide="-1" aria-controls="gallery-track-${id}" aria-label="Previous photo · ${title}">‹</button>
                <button type="button" data-slide="1" aria-controls="gallery-track-${id}" aria-label="Next photo · ${title}">›</button>
              </div>
            </div>
            <ul class="carousel-track" id="gallery-track-${id}">
              ${photos.map((photo) => `<li><figure><a href="${rackPhotoSource(photo).full}">${photoMarkup(photo)}</a><figcaption>${photo.title}</figcaption></figure></li>`).join('')}
            </ul>
          </section>`).join('\n'));
    },
  }],
  build: { rollupOptions: { input: {
    storefront: fileURLToPath(new URL('./index.html', import.meta.url)),
    gallery: fileURLToPath(new URL('./rack-builds/index.html', import.meta.url)),
  } } },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8787',
    },
  },
});
