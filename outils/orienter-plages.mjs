/* Ajoute à src/plages.js l'orientation de chaque plage française : la
   direction de la mer vue depuis la plage, en degrés depuis le nord, ou null.
   Écrit le 2 octobre 2026 pour dire si le vent vient de la mer ou de la terre,
   point connu de CLAUDE.md : la source des eaux de baignade ne donne pas
   l'orientation du rivage.

   Usage : node outils/orienter-plages.mjs, après outils/construire-plages.py.
   Rien ne part sur le réseau : la terre est celle des départements embarqués
   dans src/geographie.js.

   La méthode. Autour de la plage, soixante-douze points sur un cercle, à un
   kilomètre et demi puis à quatre : chacun est de la terre s'il tombe dans un
   département, de la mer sinon. La direction de la mer est la moyenne des
   directions des points de mer. Les contours sont simplifiés, un point tous
   les quelques kilomètres : l'orientation n'est gardée que si elle est nette.
   La mer doit couvrir entre un cinquième et quatre cinquièmes du cercle, en
   un seul arc, aux deux rayons, et les deux directions s'accorder à trente
   degrés près. Une plage de lac ou de rivière, une crique, une presqu'île ou
   le fond d'une baie restent sans orientation.

   Les plages voisines d'une frontière littorale en sont aussi privées : le
   pays voisin, hors des départements, y passerait pour de la mer. Mesuré le
   2 octobre 2026 : Hendaye se lisait à 308 degrés, Bray-Dunes à 25, Menton
   Garavan à 111, chacune à trente ou quarante degrés du vrai. Les plages
   des pays voisins restent sans orientation. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FICHIER = path.join(RACINE, "src/plages.js");
const G = await import(path.join(RACINE, "src/geographie.js"));

const N = 72;
const RAYONS = [1.5, 4];
const FRONTIERES = [[43.36, -1.79], [43.79, 7.53], [51.08, 2.57], [42.43, 3.17]];
const LOIN_FRONTIERE_KM = 6;

const anneaux = G.codesDepartements().map(c => G.anneauxDe(c)).filter(Boolean).flat().map(r => {
  let o = 180, e = -180, s = 90, n = -90;
  for (let k = 0; k < r.length; k += 2) {
    o = Math.min(o, r[k]); e = Math.max(e, r[k]); s = Math.min(s, r[k + 1]); n = Math.max(n, r[k + 1]);
  }
  return { r, o, e, s, n };
});
const dedans = (lo, la, r) => {
  let x = false;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
    const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1];
    if ((yi > la) !== (yj > la) && lo < (xj - xi) * (la - yi) / (yj - yi) + xi) x = !x;
  }
  return x;
};
const terre = (lo, la) => anneaux.some(a => lo >= a.o && lo <= a.e && la >= a.s && la <= a.n && dedans(lo, la, a.r));
const km = (a, b, c, d) => Math.hypot((a - c) * 111.2, (b - d) * 111.2 * Math.cos(a * Math.PI / 180));
const moyenne = angles => {
  const x = angles.reduce((t, a) => t + Math.sin(a * Math.PI / 180), 0);
  const y = angles.reduce((t, a) => t + Math.cos(a * Math.PI / 180), 0);
  return (Math.atan2(x, y) * 180 / Math.PI + 360) % 360;
};

export function orientation(lat, lon) {
  if (FRONTIERES.some(([a, b]) => km(lat, lon, a, b) < LOIN_FRONTIERE_KM)) return null;
  const directions = [];
  for (const r of RAYONS) {
    const mer = [];
    for (let k = 0; k < N; k++) {
      const a = k * 360 / N, rad = a * Math.PI / 180;
      const la = lat + (r / 111.2) * Math.cos(rad);
      const lo = lon + (r / (111.2 * Math.cos(lat * Math.PI / 180))) * Math.sin(rad);
      mer.push(!terre(lo, la));
    }
    const n = mer.filter(Boolean).length;
    if (n < N * 0.2 || n > N * 0.8) return null;
    let bascules = 0;
    for (let k = 0; k < N; k++) if (mer[k] !== mer[(k + 1) % N]) bascules++;
    if (bascules !== 2) return null;
    directions.push(moyenne(mer.map((m, k) => (m ? k * 360 / N : null)).filter(a => a !== null)));
  }
  const ecart = Math.abs(((directions[0] - directions[1] + 540) % 360) - 180);
  if (ecart > 30) return null;
  return Math.round(moyenne(directions)) % 360;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const texte = fs.readFileSync(FICHIER, "utf8");
  const { PLAGES } = await import(FICHIER);
  let n = 0;
  const lignes = PLAGES.map(p => {
    const q = p.slice(0, 8);
    const o = q[1] === "FR" ? orientation(q[2], q[3]) : null;
    if (o !== null) n++;
    /* La forme de outils/construire-plages.py, une virgule suivie d'une espace,
       pour que la liste ne change que de ce champ. */
    return "  [" + [...q, o].map(v => JSON.stringify(v)).join(", ") + "]";
  });
  const debut = texte.indexOf("export const PLAGES = [");
  let tete = texte.slice(0, debut);
  const champ = "fiche du ministère « idSite:codeDept » ou null";
  if (!tete.includes("direction de la mer")) {
    tete = tete.replace(`${champ}]. */`, `${champ},\n   direction de la mer vue de la plage, en degrés depuis le nord, ou null,\n   ajoutée par outils/orienter-plages.mjs]. */`);
  }
  fs.writeFileSync(FICHIER, tete + "export const PLAGES = [\n" + lignes.join(",\n") + ",\n];\n");
  console.log(`${n} plages orientées sur ${PLAGES.length}, dont ${PLAGES.filter(p => p[1] === "FR").length} en France`);
}
