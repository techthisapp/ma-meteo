/* Le point touché et la recherche d'une commune sur la carte, jalon 19,
   lot 4, demandes de Jérôme du 2 octobre 2026. Les modules de la carte
   partagent l'objet d'état décrit dans src/vues/carte.js.

   Un toucher bref ouvre une bulle sur le point : le nom de la commune, le
   temps qu'il y fait, la valeur de la nappe choisie, la vigilance et la
   restriction d'eau. « Voir la prévision » ouvre ce lieu en consultation,
   sans changer la commune suivie ; le bandeau de consultation propose ensuite
   de le suivre ou de revenir. La loupe cherche une commune par son nom,
   centre la carte sur elle et ouvre sa bulle. */

import { esc } from "../horloge.js";
import { icoTemps, icoCiel, tempsDe } from "../icones.js";
import * as Reglages from "../reglages.js";
import * as Vig from "../vigilance.js";
import * as Point from "../point.js";
import * as NappeCarte from "../nappe.js";
import { cardinal } from "../previsions.js";
import * as Carte from "../carte.js";
import * as Fond from "../fond.js";
import { NAPPES_CARTE } from "./carte-gabarit.js";

/* Le zoom auquel la recherche ouvre une commune : ses alentours proches. */
export const ZOOM_RECHERCHE = 9.5;

const fr = v => String(v).replace(".", ",");

export function brancherPoint(E, rendre) {
  const { bloc, cv, vue } = E;
  const bulle = bloc.querySelector("#caBulle");
  const nomEl = bloc.querySelector("#caBulleNom");
  const corps = bloc.querySelector("#caBulleCorps");
  const voir = bloc.querySelector("#caBulleVoir");
  const marque = bloc.querySelector("#caBullePt");
  let ouvert = null, jeton = 0;

  const fermer = () => {
    bulle.hidden = true;
    marque.hidden = true;
    ouvert = null;
    jeton++;
  };
  E.fermerPoint = fermer;

  /* La bulle se pose au-dessus du point quand il y a la place, dessous sinon,
     sans sortir du cadre. Le point reste marqué. */
  const poserBulle = () => {
    if (!ouvert) return;
    const l = cv.clientWidth, h = cv.clientHeight;
    const p = Carte.surEcran(vue, ouvert.lat, ouvert.lon, l, h);
    /* Un point sorti du cadre ferme sa bulle : collée au bord, elle parlerait
       d'un lieu qu'on ne voit plus. */
    if (p.x < 0 || p.y < 0 || p.x > l || p.y > h) { fermer(); return; }
    marque.style.setProperty("--rx", `${p.x.toFixed(1)}px`);
    marque.style.setProperty("--ry", `${p.y.toFixed(1)}px`);
    const w = bulle.offsetWidth || 260, hb = bulle.offsetHeight || 150;
    const x = Math.max(12, Math.min(l - w - 12, p.x - w / 2));
    const dessus = p.y - hb - 16 > 8;
    const y = dessus ? p.y - hb - 16 : Math.min(h - hb - 8, p.y + 16);
    bulle.style.left = `${x.toFixed(0)}px`;
    bulle.style.top = `${Math.max(8, y).toFixed(0)}px`;
  };
  E.poserBulle = poserBulle;

  const ligne = (t, cls = "") => `<p class="cb-l${cls ? ` ${cls}` : ""}">${t}</p>`;

  /* La nappe choisie, lue sur sa grille au point touché. */
  const valeurNappe = (lat, lon) => {
    const n = NAPPES_CARTE.find(x => x.cle === E.choisie && x.champ);
    if (!n) return "";
    const grille = E.grilleDe(n);
    const v = grille ? NappeCarte.valeurA(grille[n.champ], lat, lon, n.mer === true) : null;
    return Number.isFinite(v) ? ligne(`${esc(n.nom)}, ${esc(n.porte)} : <b>${esc(n.ecrire ? n.ecrire(v) : `${Math.round(v)}${n.unite}`)}</b>`) : "";
  };

  const remplir = async (lat, lon, connu, moi) => {
    const [d, vig] = await Promise.all([Point.lirePoint(lat, lon), Vig.pays().catch(() => null)]);
    if (moi !== jeton || !cv.isConnected) return;
    const lieu = connu || d.lieu;
    ouvert.lieu = lieu;
    /* Hors de toute commune, en mer le plus souvent, le point se nomme par la
       ville la plus proche. */
    const proche = lieu?.commune ? null : Fond.villeProche(lat, lon);
    ouvert.proche = proche ? `Près de ${proche.nom}` : null;
    nomEl.textContent = lieu?.commune || ouvert.proche || "Ce point de la carte";
    const t = d.temps;
    let html = "";
    if (t && t.t !== null) {
      html += ligne(`${t.code !== null ? icoTemps(icoCiel(t.code, t.jour), "") : ""}<b>${Math.round(t.t)}°</b>`
        + (t.code !== null ? ` ${esc(tempsDe(t.code)[1].toLowerCase())}` : ""), "cb-temps");
      html += ligne(t.pluie > 0 ? `Pluie en ce moment : <b>${fr(Math.round(t.pluie * 10) / 10)} mm</b>` : "Pas de pluie en ce moment");
      if (t.vent !== null) {
        html += ligne(`Vent <b>${Math.round(t.vent)} km/h</b>${t.dir !== null ? ` du ${cardinal(t.dir)}` : ""}`
          + (t.rafales !== null && t.rafales >= 40 ? `, rafales <b>${Math.round(t.rafales)} km/h</b>` : ""));
      }
    } else {
      html += ligne("Le temps de ce point n'a pas pu être lu.", "cb-manque");
    }
    html += valeurNappe(lat, lon);
    const dep = lieu?.departement || Reglages.departementDu(lieu || {});
    const niveau = dep && vig?.niveaux ? vig.niveaux.get(dep) : null;
    if (niveau) html += ligne(niveau >= 2 ? `Vigilance <b>${esc(Vig.NIVEAUX[niveau].nom)}</b>` : "Pas de vigilance météo");
    if (d.eau) html += ligne(d.eau.rang ? `Restriction d'eau : <b>${esc(d.eau.niveau.toLowerCase())}</b>` : "Aucune restriction d'eau");
    corps.innerHTML = html;
    voir.disabled = false;
    poserBulle();
  };

  /* L'ouverture : la bulle paraît tout de suite, ses lignes arrivent ensuite. */
  const ouvrir = (lat, lon, connu = null) => {
    jeton++;
    ouvert = { lat, lon, lieu: connu };
    nomEl.textContent = connu?.commune || "…";
    corps.innerHTML = ligne("Lecture du temps de ce point…", "cb-manque");
    voir.disabled = true;
    bulle.hidden = false;
    marque.hidden = false;
    poserBulle();
    bulle.focus({ preventScroll: true });
    remplir(lat, lon, connu, jeton);
  };
  E.ouvrirPoint = (x, y) => {
    const p = Carte.depuisEcran(vue, x, y, cv.clientWidth, cv.clientHeight);
    ouvrir(p.lat, p.lon);
  };

  bloc.querySelector("#caBulleFermer").addEventListener("click", e => { e.stopPropagation(); fermer(); });
  bulle.addEventListener("pointerdown", e => e.stopPropagation());
  bulle.addEventListener("keydown", e => { if (e.key === "Escape") { fermer(); cv.focus(); } });
  /* Un appui ailleurs sur la carte referme la bulle ; le toucher qui suit en
     ouvre une autre s'il est bref. */
  cv.addEventListener("pointerdown", () => { if (ouvert) fermer(); }, { passive: true });
  /* Au clavier, Entrée sur la carte ouvre la bulle du centre de la vue. */
  cv.addEventListener("keydown", ev => {
    if (ev.key !== "Enter") return;
    ev.preventDefault();
    ouvrir(vue.lat, vue.lon);
  });

  /* « Voir la prévision » : le lieu s'ouvre en consultation, sur l'accueil. */
  voir.addEventListener("click", () => {
    if (!ouvert) return;
    const l = ouvert.lieu;
    Reglages.consulter({
      commune: l?.commune || ouvert.proche || "Point de la carte", codePostal: l?.codePostal ?? null, departement: l?.departement ?? null,
      lat: Number.isFinite(l?.lat) ? l.lat : Math.round(ouvert.lat * 1000) / 1000,
      lon: Number.isFinite(l?.lon) ? l.lon : Math.round(ouvert.lon * 1000) / 1000,
    });
    rendre({ accueil: true });
  });

  /* ---------- La recherche ---------- */

  const loupe = bloc.querySelector("#caChercher");
  const boite = bloc.querySelector("#caRecherche");
  const champ = bloc.querySelector("#caRechercheChamp");
  const liste = bloc.querySelector("#caRechercheListe");
  let trouves = [], attente = null, demande = 0;
  const montrer = v => {
    boite.hidden = !v;
    loupe.setAttribute("aria-expanded", v ? "true" : "false");
    if (v) { E.fermerPanneau?.(); champ.value = ""; liste.innerHTML = ""; champ.focus(); }
  };
  loupe.addEventListener("click", e => { e.stopPropagation(); montrer(boite.hidden); });
  boite.addEventListener("pointerdown", e => e.stopPropagation());
  cv.addEventListener("pointerdown", () => { if (!boite.hidden) montrer(false); }, { passive: true });
  champ.addEventListener("keydown", e => { if (e.key === "Escape") { montrer(false); loupe.focus(); } });
  champ.addEventListener("input", () => {
    clearTimeout(attente);
    const q = champ.value;
    attente = setTimeout(async () => {
      const moi = ++demande;
      trouves = await Reglages.chercherCommune(q);
      if (moi !== demande || !cv.isConnected) return;
      liste.innerHTML = trouves.length
        ? trouves.map((c, k) => `<li><button type="button" data-k="${k}"><b>${esc(c.commune)}</b>`
          + `<span>${esc([c.codePostal, (c.contexte || "").split(",")[1]?.trim()].filter(Boolean).join(", "))}</span></button></li>`).join("")
        : (q.trim().length >= 2 ? `<li class="cr-vide">Aucune commune trouvée</li>` : "");
    }, 250);
  });
  liste.addEventListener("click", e => {
    const b = e.target.closest("[data-k]");
    if (!b) return;
    const c = trouves[Number(b.dataset.k)];
    if (!c) return;
    montrer(false);
    Object.assign(vue, Carte.borner({ lat: c.lat, lon: c.lon, z: ZOOM_RECHERCHE }));
    E.revoir();
    ouvrir(c.lat, c.lon, c);
  });
}
