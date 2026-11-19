import { defineConfig, loadEnv } from 'vite';
import { deliveryQuoteMiddleware } from './server/delivery-quote.mjs';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const quote = deliveryQuoteMiddleware({
    origin: env.DELIVERY_ORIGIN,
    apiKey: env.GOOGLE_MAPS_API_KEY,
  });

  return {
    plugins: [{
      name: 'rack-delivery-quote',
      configureServer(server) {
        server.middlewares.use(quote);
      },
      configurePreviewServer(server) {
        server.middlewares.use(quote);
      },
    }],
  };
});
