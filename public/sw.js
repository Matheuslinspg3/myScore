self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Intencionalmente sem cache de respostas: dados financeiros sempre usam a rede.
