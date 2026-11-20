import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { rackPhotos, rackPhotoSource } from './src/config/gallery.ts';

function photoMarkup(photo, eager = false) {
  const { src, srcSet, width, height } = rackPhotoSource(photo);
  const sizes = eager ? '(max-width: 720px) 100vw, 52vw' : '(max-width: 580px) 100vw, (max-width: 960px) 50vw, 33vw';
  return `<img src="${src}" srcset="${srcSet}" sizes="${sizes}" width="${width}" height="${height}" alt="${photo.alt}" ${eager ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"'}>`;
}

export default defineConfig({
  plugins: [{
    name: 'tote-rack-static-photos',
    transformIndexHtml(html) {
      return html.replace('<!-- storefront-hero -->', photoMarkup(rackPhotos[0], true))
        .replace('<!-- photo-hero -->', photoMarkup(rackPhotos[2], true))
        .replace('<!-- photo-cards -->', () => rackPhotos.map((photo) =>
          `<figure class="photo-card"><a href="/racks/${photo.slug}-1440.webp">${photoMarkup(photo)}</a><figcaption>${photo.title}</figcaption></figure>`).join('\n'));
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
