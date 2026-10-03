/* Agent de service. Il sert la coque hors ligne et ne met jamais en cache une
   réponse d'API : une prévision périmée servie sans le dire vaut moins qu'un
   message d'indisponibilité. */

const VERSION = "ma-meteo-v157";
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
  "./src/aide.js",
  "./src/vues/communs.js",
  "./src/vues/heures.js",
  "./src/vues/avenir.js",
  "./src/vues/vigilance.js",
  "./src/vues/astres.js",
  "./src/vues/etoiles.js",
  "./src/vues/carte.js",
  "./src/vues/carte-gabarit.js",
  "./src/vues/carte-couches.js",
  "./src/vues/carte-chronologie.js",
  "./src/vues/carte-etiquettes.js",
  "./src/vues/carte-point.js",
  "./src/vues/carte-legende.js",
  "./src/vues/lieux.js",
  "./src/vues/feuilles.js",
  "./src/vues/climat.js",
  "./src/vues/loisirs.js",
  "./src/astres.js",
  "./src/feu.js",
  "./src/relief.js",
  "./src/temps.js",
  "./src/vigilance.js",
  "./src/ensemble.js",
  "./src/scenarios.js",
  "./src/comparaison.js",
  "./src/neige.js",
  "./src/fond.js",
  "./src/point.js",
  "./src/prevue.js",
  "./src/zones-eau.js",
  "./src/stations.js",
  "./src/plage.js",
  "./src/plages.js",
  "./src/trajets.js",
  "./src/vigieau.js",
  "./src/eau.js",
  "./src/villes.js",
  "./src/justesse.js",
  "./src/parapluie.js",
  "./src/reponse.js",
  "./src/activites.js",
  "./src/beautemps.js",
  "./src/air.js",
  "./src/atmo.js",
  "./src/carte.js",
  "./src/projection.js",
  "./src/geographie.js",
  "./src/radar.js",
  "./src/foudre.js",
  "./src/nuages.js",
  "./src/feux.js",
  "./src/ciel.js",
  "./src/bande.js",
  "./src/fleche.js",
  "./src/version.js",
  "./src/typo.js",
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
  "./donnees/relief.webp",
  "./donnees/relief.json",
  "./donnees/rivieres.json",
  "./donnees/villes.json",
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
