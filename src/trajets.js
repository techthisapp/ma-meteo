/* Les durées de route en voiture, par le service public de calcul
   d'itinéraire OSRM : une seule requête pour toute une liste de destinations.
   Le serveur public est une démonstration à la charge limitée ; les modules
   qui l'emploient gardent ses réponses et ne l'interrogent qu'une fois par
   commune. Écrit pour les plages, jalon 15 ; la neige, jalon 16, a sa propre
   version, antérieure, à raccorder ici. */

const OSRM = "https://router.project-osrm.org/table/v1/driving/";

export function adresseOsrm(g, pts) {
  const liste = [[g.lon, g.lat], ...pts.map(p => [p.lon, p.lat])]
    .map(([lo, la]) => `${lo.toFixed(5)},${la.toFixed(5)}`).join(";");
  return `${OSRM}${liste}?sources=0&annotations=duration`;
}

/* La durée en minutes vers chaque destination, null si la route manque. Lève
   une erreur si le service ne répond pas. */
export async function dureesMinutes(g, pts, fetcheur = fetch) {
  const r = await fetcheur(adresseOsrm(g, pts));
  if (!r.ok) throw new Error(`osrm ${r.status}`);
  const d = await r.json();
  const durees = d?.durations?.[0];
  if (d?.code !== "Ok" || !Array.isArray(durees)) throw new Error("osrm sans durées");
  return pts.map((_, k) => (durees[k + 1] == null ? null : Math.round(durees[k + 1] / 60)));
}
