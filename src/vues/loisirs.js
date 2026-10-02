/* La neige, la plage et l'eau. Découpé de src/vues.js le 2 octobre 2026,
   docs/plan-decoupage-vues.md. */

import { esc } from "../horloge.js";
import { liste } from "../ecritures.js";
import * as Neige from "../neige.js";
import * as Plage from "../plage.js";
import * as VigiEau from "../vigieau.js";
import * as Eau from "../eau.js";
import { cleHeure } from "../horloge.js";
import { angleFleche, TRACE_FLECHE } from "../fleche.js";
import * as Vig from "../vigilance.js";
import { conseilsHTML } from "../conseils.js";

/* La feuille de la neige, jalon 16, lot 3 : les stations à une heure de
   route, regroupées sous leur domaine, décidé par Jérôme le 30 septembre 2026.
   Pour chacune, la durée de trajet, la neige au sommet et au pied, la neige
   fraîche des 72 dernières heures, les chutes prévues sur sept jours,
   l'isotherme zéro et les rafales au sommet. */
export function vueNeige(ctx, rendre) {
  const titre = "La neige", sous = ctx?.commune || "";
  const nz = Neige.etatNeige(ctx);
  if (!nz) {
    Neige.chargerNeige(ctx, cleHeure()).then(() => rendre()).catch(() => {});
    return { titre, sous, corps: `<div class="carte"><p class="note">Lecture des stations…</p></div>` };
  }
  if (!nz.proches.length) {
    return { titre, sous, corps: `<div class="carte"><p class="note">Aucune station de ski à une heure de route.</p></div>` };
  }
  if (!nz.resumes.length) {
    return { titre, sous, corps: `<div class="carte"><p class="note">La neige a besoin du réseau.</p></div>` };
  }
  const cm = v => `${Math.round(v)} cm`;
  const valeurs = s => `<dl class="ng-val">`
    + `<dt>Au sommet, ${s.sommet} m</dt><dd>${cm(s.haut.sol)}</dd>`
    + `<dt>Au pied, ${s.pied} m</dt><dd>${cm(s.bas.sol)}</dd>`
    + `<dt>Fraîche, 72 heures</dt><dd>${cm(s.haut.fraiche72)}</dd>`
    + `<dt>Chutes, 7 jours</dt><dd>${cm(s.haut.chutes.slice(0, 7).reduce((a, c) => a + c.cm, 0))}</dd>`
    + `<dt>Isotherme zéro</dt><dd>${s.haut.iso.toLocaleString("fr-FR")} m</dd>`
    + `<dt>Rafales au sommet</dt><dd>${s.haut.rafales} km/h</dd></dl>`;
  /* Sous le titre d'un domaine, ses propres chiffres s'intitulent « Ensemble
     du domaine » : répéter son nom le disait deux fois. */
  const entete = (s, nom = s.nom) => `<div class="ng-tete"><b>${esc(nom)}</b>`
    + `<span>${s.minutes} min de route${s.estime ? ", estimées" : ""}</span></div>`;
  /* Les domaines d'abord, chacun avec ses stations ; un domaine proche porte
     aussi ses propres chiffres, pris sur son emprise entière. */
  const membres = new Map();
  for (const s of nz.resumes) if (s.domaine) (membres.get(s.domaine) || membres.set(s.domaine, []).get(s.domaine)).push(s);
  const vus = new Set();
  const cartes = [];
  for (const s of nz.resumes) {
    if (vus.has(s.nom)) continue;
    const dom = s.domaine || (membres.has(s.nom) ? s.nom : null);
    if (dom) {
      if (vus.has(dom)) continue;
      vus.add(dom);
      const tete = nz.resumes.find(x => x.nom === dom);
      const liste = membres.get(dom) || [];
      liste.forEach(x => vus.add(x.nom));
      cartes.push(`<div class="carte ng-dom"><h3>${esc(dom)}</h3>`
        + (tete ? entete(tete, "Ensemble du domaine") + valeurs(tete) : "")
        + liste.map(x => `<div class="ng-st">${entete(x)}${valeurs(x)}</div>`).join("") + `</div>`);
    } else {
      vus.add(s.nom);
      cartes.push(`<div class="carte ng-seule">${entete(s)}${valeurs(s)}</div>`);
    }
  }
  const notable = Neige.chuteNotable(nz.resumes);
  const tete = `<div class="carte retenir"><div class="conseils">${conseilsHTML([
    ...(notable ? [{ i: "neige", g: 6, t: notable.phrase }] : []),
    { i: "neige", g: 1, t: Neige.phraseNeige(nz.resumes) }])}</div></div>`;
  return { titre, sous, corps: tete + cartes.join("")
    + `<p class="note">Stations : OpenSkiMap, © contributeurs OpenStreetMap, licence ODbL. `
    + `Neige : prévision calculée à l'altitude du pied et du sommet de chaque station. `
    + `Durées de route : OSRM.</p>` };
}

/* La feuille de la plage, jalon 15, lot 3 : les plages à une heure de route,
   quatre au plus, espacées de cinq kilomètres. Pour chacune, l'eau, les
   vagues, le vent, l'air et l'indice UV, et les marées : les heures des
   pleines et basses mers, et le marnage. Les hauteurs rapportées au niveau
   moyen de la mer, moins deux mètres, plus un, déroutaient ; l'écart entre
   les deux se lit d'un coup. */
export function vuePlage(ctx, rendre) {
  const titre = "La plage", sous = ctx?.commune || "";
  const pz = Plage.etatPlage(ctx);
  if (!pz) {
    Plage.chargerPlage(ctx, cleHeure()).then(() => rendre()).catch(() => {});
    return { titre, sous, corps: `<div class="carte"><p class="note">Lecture des plages…</p></div>` };
  }
  if (!pz.proches.length) return { titre, sous, corps: `<div class="carte"><p class="note">Aucune plage à une heure de route.</p></div>` };
  if (!pz.resumes.length) return { titre, sous, corps: `<div class="carte"><p class="note">La mer a besoin du réseau.</p></div>` };
  const fr = v => String(v).replace(".", ",");
  const carte = p => {
    const m = p.mer, a = p.air;
    const lieu = p.commune || (p.departement ? Vig.nomDe(p.departement) : "") || "";
    const suite = m.marees.slice(0, 2).map((x, i) => {
      const nom = x.type === "haute" ? "pleine mer" : "basse mer";
      return `${i ? nom : nom[0].toUpperCase() + nom.slice(1)} ${x.heure}`;
    }).join(", ");
    const h = m.marees.find(x => x.type === "haute"), b = m.marees.find(x => x.type === "basse");
    const marnage = h && b ? `${fr(Math.round((h.hauteur - b.hauteur) * 10) / 10)} m` : "";
    return `<div class="carte pl-pl"><div class="ng-tete"><b>${esc(p.nom)}</b>`
      + `<span>${p.minutes} min de route${p.estime ? ", estimées" : ""}</span></div>`
      + (lieu ? `<p class="pl-lieu">${esc(lieu)}</p>` : "")
      + `<dl class="ng-val">`
      + (m.eau !== null ? `<dt>Eau</dt><dd>${fr(m.eau)}°</dd>` : "")
      + (m.vagues !== null ? `<dt>Vagues</dt><dd>${m.vagues < 0.3 ? "mer calme" : `${fr(m.vagues)} m${m.periode ? `, toutes les ${m.periode} s` : ""}`}</dd>` : "")
      /* Le vent et sa direction au niveau de la plage, avec la flèche qui montre
         où il va ; sans rapport au rivage, dont l'orientation manque. */
      + (a ? `<dt>Vent</dt><dd>${Number.isFinite(a.direction) ? `<svg class="pl-fl" viewBox="0 0 14 14" aria-hidden="true">`
          + `<g transform="rotate(${angleFleche(a.direction)} 7 7)">${TRACE_FLECHE}</g></svg>` : ""}`
        + `${a.vent} km/h${Number.isFinite(a.direction) ? `, ${Plage.ventDe(a.direction)}` : ""}</dd>`
        + `<dt>Air, au plus chaud</dt><dd>${a.max}°</dd>`
        + `<dt>Indice UV</dt><dd>${a.uv}</dd>` : "")
      + (suite ? `<dt>Marées</dt><dd>${esc(suite)}</dd>` : "")
      + (marnage ? `<dt>Marnage</dt><dd>${marnage}</dd>` : "")
      + (p.creneau ? `<dt>Baignade</dt><dd>${p.creneau.de !== undefined
        ? `conseillée ${p.creneau.jour === "demain" ? "demain " : ""}de ${p.creneau.de} h à ${p.creneau.a} h`
        : `déconseillée, ${esc(p.creneau.motif)}`}</dd>` : "")
      + (Plage.qualiteDe(p.qualite) ? `<dt>Qualité de l'eau</dt><dd class="${p.qualite === 4 ? "pl-alerte" : ""}">`
        + `${Plage.qualiteDe(p.qualite)}, saison ${Plage.SAISON}</dd>` : "")
      + `</dl>`
      + (Plage.ficheDe(p.fiche) ? `<a class="pl-fiche" href="${Plage.ficheDe(p.fiche)}" target="_blank" rel="noopener">`
        + `Derniers prélèvements et interdictions, sur le site du ministère</a>` : "")
      + `</div>`;
  };
  const creneau = Plage.phraseCreneau(pz.resumes[0].creneau);
  const tete = `<div class="carte retenir"><div class="conseils">${conseilsHTML([
    { i: "goutte", g: 1, t: Plage.phrasePlage(pz.resumes) },
    ...(creneau ? [{ i: "soleil", g: 1, t: creneau }] : [])])}</div></div>`;
  return { titre, sous, corps: tete + pz.resumes.map(carte).join("")
    + `<p class="note">Plages et qualité de l'eau : eaux de baignade déclarées à la Commission européenne, `
    + `classement de la saison ${Plage.SAISON} établi sur quatre saisons de prélèvements ; `
    + `le drapeau du jour se voit sur place. Mer : Open-Meteo, `
    + `modèle de vagues ; marées estimées d'après la hauteur de la mer, heure par heure, à quelques minutes près. `
    + `Durées de route : OSRM.</p>` };
}

/* La rivière la plus proche : la hauteur en centimètres, ou en mètres au-delà
   d'un mètre ; le débit en litres par seconde, ou en mètres cubes au-delà de
   mille ; la situation du débit par rapport à la saison. */
function riviereHTML(r) {
  if (r === undefined) return `<p class="note">Lecture de la rivière…</p>`;
  if (!r) return `<p class="note">Aucune station de mesure en service à proximité.</p>`;
  const fr = v => String(v).replace(".", ",");
  const haut = r.hauteur < 1000 ? `${Math.round(r.hauteur / 10)} cm` : `${fr(Math.round(r.hauteur / 10) / 100)} m`;
  const debit = v => (v < 1000 ? `${Math.round(v)} l/s` : `${fr(Math.round(v / 100) / 10)} m³/s`);
  const s = r.situation;
  return `<p class="pl-lieu">${esc(r.station)}, à ${r.km} km</p><dl class="ng-val">`
    + `<dt>Hauteur</dt><dd>${haut}${r.tendance ? `, ${r.tendance}` : ""}</dd>`
    + (r.debit !== null ? `<dt>Débit</dt><dd>${debit(r.debit)}</dd>` : "")
    + (s ? `<dt>Pour la saison</dt><dd class="${/bas/.test(s.classe) && s.part < 0.2 ? "pl-alerte" : ""}">${esc(s.classe)}</dd>` : "")
    + `</dl>`
    + (s ? `<p class="pl-lieu">Sur les sept derniers jours, ${debit(s.debit7)} contre ${debit(s.mediane)} en médiane des ${s.annees} années `
      + `précédentes à la même date${s.plusBas === 0 ? ", le plus bas de toutes" : s.plusBas === s.annees ? ", le plus haut de toutes" : ""}.</p>`
      : r.debit === null ? `<p class="pl-lieu">Cette station ne mesure que la hauteur.</p>` : "");
}

/* L'étiage d'été, bilan de la dernière campagne dans un rayon d'environ
   trente-cinq kilomètres, et la température de l'eau quand une mesure a moins
   d'une semaine. Hors campagne, rien ne s'écrit. */
function etiageHTML(e, t) {
  const jour = d => new Date(`${d}T12:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  const parts = e ? [[e.sec, "à sec"], [e.interrompu, "à écoulement interrompu"], [e.faible, "à écoulement faible"], [e.visible, "à écoulement visible"]]
    .filter(([n]) => n > 0).map(([n, t]) => `${n} ${t}`) : [];
  return (e ? `<p class="pl-lieu">Étiage observé le ${jour(e.date)} dans un rayon d'environ 35 km, sur ${e.total} `
    + `${e.total > 1 ? "cours d'eau" : "cours d'eau"} : ${parts.join(", ")}.`
    + (e.proche ? ` Le plus proche, ${esc(e.proche.station)}, à ${e.proche.km} km : ${e.proche.ecoulement}.` : "") + `</p>` : "")
    + (t ? `<p class="pl-lieu">Eau de la rivière : ${String(t.valeur).replace(".", ",")}°, mesurée à ${esc(t.station)} le ${jour(t.date)}`
      + `${t.heure ? ` à ${t.heure.replace(":", " h ")}` : ""}.</p>` : "");
}

/* Le sol et l'arrosage : l'humidité où plongent les racines, le bilan de la
   semaine, la pluie attendue, et le conseil. */
function solHTML(s, r) {
  if (s === undefined) return `<p class="note">Lecture du sol…</p>`;
  if (!s) return `<p class="note">L'humidité du sol a besoin du réseau.</p>`;
  const fr = v => String(v).replace(".", ",");
  return `<dl class="ng-val"><dt>Humidité du sol, 9 à 27 cm</dt><dd class="${/sec/.test(s.classe) ? "pl-alerte" : ""}">${esc(s.classe)}, ${s.humidite} %</dd>`
    + `<dt>Sept derniers jours</dt><dd>${fr(s.pluie7)} mm de pluie, ${s.eau7} mm évaporés</dd>`
    + `<dt>Pluie attendue d'ici après-demain</dt><dd>${fr(s.pluie3)} mm</dd></dl>`
    + `<p class="pl-lieu">${esc(Eau.conseilArrosage(s, r))}</p>`;
}

/* La feuille de l'eau, jalon 18, lot 2 : la restriction en vigueur, ressource
   par ressource avec son arrêté, et l'état de la nappe phréatique la plus
   proche, recalculé faute d'indicateur publié. */
export function vueEau(ctx, rendre) {
  const titre = "L'eau", sous = ctx?.commune || "";
  const ez = Eau.etatEau(ctx);
  if (!ez) {
    Eau.chargerEau(ctx, cleHeure().slice(0, 10), fetch, () => rendre()).then(() => rendre()).catch(() => {});
    return { titre, sous, corps: `<div class="carte"><p class="note">Lecture de l'eau…</p></div>` };
  }
  const r = ez.restriction, n = ez.nappe;
  const restr = !r ? `<p class="note">La restriction a besoin du réseau.</p>`
    : !r.rang ? `<p>Aucune restriction d'eau en vigueur pour la commune.</p>`
    : `<dl class="ng-val">` + r.zones.map(z => `<dt>${esc(Eau.RESSOURCES[z.type] || z.type)}</dt>`
      + `<dd class="${z.rang >= 3 ? "pl-alerte" : ""}">${esc(VigiEau.NOMS[z.niveau] || z.niveau)}</dd>`).join("") + `</dl>`
      + [...new Set(r.zones.map(z => z.arrete).filter(Boolean))].map(u => `<a class="pl-fiche" href="${esc(u)}" target="_blank" `
        + `rel="noopener">L'arrêté en vigueur${r.zones[0].fin ? `, jusqu'au ${new Date(`${r.zones[0].fin}T12:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}` : ""}</a>`).join("")
      + `<a class="pl-fiche" href="https://vigieau.gouv.fr" target="_blank" rel="noopener">Les usages permis, sur VigiEau</a>`;
  const nappe = !n ? `<p class="note">Aucun piézomètre suivi depuis quinze ans à moins de cent kilomètres.</p>`
    : `<dl class="ng-val"><dt>État</dt><dd>${esc(n.classe)}</dd><dt>Tendance sur une semaine</dt><dd>${esc(n.tendance)}</dd></dl>`
      + `<p class="pl-lieu">Plus haute que ${n.plusBasses} des ${n.annees} années comparables, au ${new Date(`${n.fin}T12:00`)
        .toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}. Piézomètre ${esc(n.station)}, à ${n.km} km.</p>`;
  const conseil = r && r.rang ? [{ i: "goutte", g: r.rang >= 2 ? 4 : 1, t: `Restriction d'eau : ${r.niveau.toLowerCase()}.` }] : [];
  return { titre, sous, corps: (conseil.length ? `<div class="carte retenir"><div class="conseils">${conseilsHTML(conseil)}</div></div>` : "")
    + `<div class="carte"><h3>Restrictions</h3>${restr}</div>`
    + `<div class="carte"><h3>Nappe phréatique</h3>${nappe}</div>`
    + `<div class="carte"><h3>Rivière</h3>${riviereHTML(ez.riviere)}${etiageHTML(ez.etiage, ez.temperature)}</div>`
    + `<div class="carte"><h3>Le sol et l'arrosage</h3>${solHTML(ez.sol, ez.restriction)}</div>`
    + `<p class="note">Restrictions : VigiEau, pour les particuliers. Nappe, rivière, étiage observé par le réseau ONDE et température de l'eau : `
    + `mesures des réseaux nationaux, Hub'eau. Sol : humidité et évaporation estimées par Open-Meteo ; `
    + `l'état compare les trente derniers jours aux mêmes jours de chaque année depuis 1995, sur le principe de `
    + `l'indicateur du BRGM.</p>` };
}
