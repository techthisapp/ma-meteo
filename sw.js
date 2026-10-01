/* Agent de service. Il sert la coque hors ligne et ne met jamais en cache une
   réponse d'API : une prévision périmée servie sans le dire vaut moins qu'un
   message d'indisponibilité. */

const VERSION = "ma-meteo-v123";
const DELAI_RESEAU = 3000;
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
  "./src/scenarios.js",
  "./src/comparaison.js",
  "./src/neige.js",
  "./src/stations.js",
  "./src/plage.js",
  "./src/plages.js",
  "./src/trajets.js",
  "./src/vigieau.js",
  "./src/eau.js",
  "./src/villes.js",
  /* Importés par la neige, jalon 16 : la distance des postes, et le réseau
     qu'elle emploie. Absents de la coque, ils faisaient casser l'application
     hors connexion, ce que la garde de la coque a relevé. */
  "./src/postes.js",
  "./src/reseau.js",
  "./src/justesse.js",
  "./src/parapluie.js",
  "./src/reponse.js",
  "./src/activites.js",
  "./src/beautemps.js",
  "./src/air.js",
  "./src/atmo.js",
  "./src/carte.js",
  "./src/geographie.js",
  "./src/radar.js",
  "./src/foudre.js",
  "./src/nuages.js",
  "./src/feux.js",
  "./src/ciel.js",
  "./src/bande.js",
  "./src/fleche.js",
  "./src/version.js",
  "./src/nappe.js",
  "./src/vent.js",
  "./src/deplacement.js",
  "./src/pluieproche.js",
  "./src/climat.js",
  "./icones/icone.svg",
  "./icones/icone-180.png",
  "./icones/icone-192.png",
  "./icones/icone-512.png",
  "./icones/icone-maskable-512.png",
  /* Le ciel des étoiles se lit à la demande, mais doit rester lisible hors
     connexion même si l'écran n'a jamais été ouvert en ligne. */
  "./donnees/ciel.json",
];

/* Un téléchargement incomplet fait échouer l'installation : l'agent précédent
   reste en place avec sa copie entière. L'échec avalé activait une version à
   la copie partielle, qui effaçait l'ancienne. Les fichiers se demandent sans
   le cache du navigateur, que GitHub garde dix minutes : sans quoi la copie
   d'une version neuve pouvait se remplir de fichiers anciens. Audit du
   1er octobre 2026, constats 3.1 et 3.6. */
self.addEventListener("install", ev => {
  ev.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(COQUE.map(u => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
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
     déployée doit arriver sans attendre l'expiration d'un cache. Le réseau se
     demande sans le cache du navigateur : GitHub sert les fichiers pour dix
     minutes, et un simple `fetch` repassait par ce cache, si bien qu'une
     version publiée restait invisible jusqu'à dix minutes, relevé le
     23 septembre 2026. Le serveur répond d'un « inchangé » quand rien n'a
     bougé, ce qui ne coûte presque rien. */
  /* Audit du 1er octobre 2026, constats 3.2 à 3.4. Le réseau a trois
     secondes pour répondre ; au-delà, ou en cas d'échec, la copie est servie,
     sans quoi un réseau à une barre retenait le lancement jusqu'à l'abandon du
     système. Seule une navigation reçoit la page en secours : un module ou un
     fichier de données qui la recevait échouait sur une erreur
     incompréhensible. Une adresse à paramètres, comme la recherche de
     version, n'entre pas dans la copie, qui grossissait à chaque retour au
     premier plan. */
  const navigation = ev.request.mode === "navigate";
  const reseau = fetch(ev.request, { cache: "no-cache" })
    .then(r => {
      if (r.ok && !r.redirected && !u.search) {
        const copie = r.clone();
        const ecrit = caches.open(VERSION).then(c => c.put(ev.request, copie)).catch(() => {});
        try { ev.waitUntil(ecrit); } catch { /* l'évènement est déjà clos */ }
      }
      return r;
    });
  reseau.catch(() => {});
  ev.respondWith((async () => {
    try {
      return await Promise.race([reseau, new Promise((_, non) => setTimeout(() => non(new Error("délai")), DELAI_RESEAU))]);
    } catch { /* réseau lent ou absent */ }
    const copie = await caches.match(ev.request, { ignoreSearch: navigation });
    if (copie) return copie;
    if (navigation) {
      const page = await caches.match("./index.html");
      if (page) return page;
    }
    return reseau;
  })());
});
