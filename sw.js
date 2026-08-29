/* Agent de service. Il sert la coque hors ligne et ne met jamais en cache une
   réponse d'API : une prévision périmée servie sans le dire vaut moins qu'un
   message d'indisponibilité. */

const VERSION = "ma-meteo-v38";
const COQUE = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./src/app.js",
  "./src/horloge.js",
  "./src/previsions.js",
  "./src/reglages.js",
  "./src/icones.js",
  "./src/conseils.js",
  "./src/ruban.js",
  "./src/ecritures.js",
  "./src/vues.js",
  "./src/astres.js",
  "./src/feu.js",
  "./src/relief.js",
  "./src/temps.js",
  "./src/vigilance.js",
  "./src/ensemble.js",
  "./src/justesse.js",
  "./src/parapluie.js",
  "./src/reponse.js",
  "./src/activites.js",
  "./src/beautemps.js",
  "./icones/icone.svg",
  "./icones/icone-192.png",
  "./icones/icone-512.png",
];

self.addEventListener("install", ev => {
  ev.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(COQUE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", ev => {
  ev.waitUntil(
    caches.keys()
      .then(l => Promise.all(l.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", ev => {
  const u = new URL(ev.request.url);
  if (ev.request.method !== "GET") return;
  // Les domaines de données ne passent jamais par le cache de l'agent.
  if (u.origin !== self.location.origin) return;

  /* La coque suit le réseau d'abord, le cache en secours : une correction
     déployée doit arriver sans attendre l'expiration d'un cache. */
  ev.respondWith(
    fetch(ev.request)
      .then(r => {
        if (r.ok) {
          const copie = r.clone();
          caches.open(VERSION).then(c => c.put(ev.request, copie)).catch(() => {});
        }
        return r;
      })
      .catch(() => caches.match(ev.request).then(r => r || caches.match("./index.html"))),
  );
});
