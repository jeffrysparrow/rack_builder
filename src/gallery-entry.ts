import { requestJson } from './config/shop';
import type { Storefront } from './config/shop';
import { captureVisit } from './visit';
import { enableRackCarousels } from './rack-carousel';

captureVisit();
enableRackCarousels();

const customRackLink = document.getElementById('gallery-custom-link');
if (customRackLink && import.meta.env.MODE !== 'storefront') {
  void requestJson<Storefront>('/api/shop').then(({ consultAvailable }) => {
    customRackLink.hidden = !consultAvailable;
  }).catch(() => { /* The gallery is useful while the contact form is unavailable. */ });
}
