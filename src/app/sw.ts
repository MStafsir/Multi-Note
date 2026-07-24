import type { PrecacheEntry } from 'serwist';
import { Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope {
    __SW_MANIFEST: (string | PrecacheEntry)[];
  }
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
});

serwist.addPrecacheRule({
  url: /\/api\/nodes/,
  strategy: 'staleWhileRevalidate',
});

serwist.addPrecacheRule({
  url: /\/api\/upload/,
  strategy: 'networkOnly',
});

serwist.addEventListeners();
