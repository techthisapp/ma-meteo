/* Réserve. Deux vues écrites et contrôlées, non branchées.

   Elles lisent les jeux archivés de Météo-France sur data.gouv.fr par
   `vigilance.js` et `postes.js`, dont le schéma est vérifié et documenté dans
   ces deux modules. Sondé le 19 août 2026, le dernier bulletin de vigilance
   datait du 5 août et les relevés de pluie du 22 juin, les fichiers du seau
   n'ayant pas été modifiés depuis le 24 juin.

   Le jour où la synchronisation reprend, il suffit de déplacer ces deux vues
   dans `vues.js`, de rétablir les appels à `Vigilance.charger` et
   `Postes.charger` dans `app.js`, et de remettre les deux entrées dans la table
   `VUES` et dans les tuiles. */

import { nombreFr, esc } from "./horloge.js";
import * as P from "./previsions.js";
import * as Reglages from "./reglages.js";
import { ALEA, COULEUR_NOM, GESTE } from "./vigilance.js";

export function vueVigilanceArchivee(ctx) {
  const { vigilance } = ctx;
  const g = Reglages.lire();
  const source = `<p class="note">Source : jeu « Vigilance météorologique archivée » de `
    + `Météo-France sur data.gouv.fr. C'est une archive, non un flux en temps réel : son `
    + `alimentation est irrégulière et le bulletin peut avoir plusieurs jours de retard. `
    + `Pour la vigilance en vigueur, se reporter à vigilance.meteofrance.fr.</p>`;

  if (vigilance.etat === "indisponible") {
    return {
      titre: "Vigilance", sous: g.commune || "",
      corps: `<div class="carte"><p class="vide">La source de vigilance n'est pas `
        + `atteignable pour le moment.</p></div>${source}`,
    };
  }

  const lot = (vigilance.lignes || []).filter(v => v.couleur > 1);
  if (!lot.length) {
    return {
      titre: "Vigilance", sous: g.commune || "",
      corps: `<div class="carte"><p class="vide">Aucune vigilance sur le département `
        + `dans le dernier bulletin publié.</p></div>${source}`,
    };
  }

  const dateBulletin = vigilance.jour
    ? new Date(`${vigilance.jour}T12:00`).toLocaleDateString("fr-FR",
        { weekday: "long", day: "numeric", month: "long" })
    : null;

  /* L'âge du bulletin est dit avant son contenu, non après : lire « canicule
     orange » puis découvrir deux écrans plus bas que le bulletin a quinze jours
     serait une tromperie. */
  const avis = vigilance.etat === "perime"
    ? `<div class="carte" style="border-left:3px solid var(--v3)">`
      + `<p style="font-size:14px;line-height:1.5"><b>Bulletin périmé.</b> Il date du `
      + `${esc(dateBulletin)}, soit ${vigilance.age} jour${vigilance.age > 1 ? "s" : ""}. `
      + `Il ne dit rien du temps d'aujourd'hui.</p></div>`
    : "";

  const bloc = v => {
    const quand = v.echeance === "J" ? "Le jour du bulletin" : "Le lendemain";
    const alea = (v.phenomenes || []).map(p =>
      `<p class="vg-l v-${p.couleur}"><i class="vg-p"></i><span>`
      + `<b>${esc(ALEA[p.id] || `phénomène ${p.id}`)}, ${esc(COULEUR_NOM[p.couleur] || "")}</b>`
      + `${GESTE[p.id] ? esc(GESTE[p.id]) : ""}</span></p>`).join("");
    return `<div class="carte"><div class="carte-tete"><h3>${esc(quand)}</h3>`
      + `<em>${esc(COULEUR_NOM[v.couleur] || "")}</em></div>`
      + (alea || `<p class="vide">Aucun aléa au-dessus du vert.</p>`) + `</div>`;
  };

  const texte = lot.map(v => v.texte).find(Boolean);
  const emis = lot.map(v => v.emis_le).find(Boolean);

  return {
    titre: "Vigilance",
    sous: dateBulletin ? `Bulletin du ${dateBulletin}` : (g.commune || ""),
    corps: avis + lot.map(bloc).join("")
      + (texte ? `<div class="carte"><div class="carte-tete"><h3>Bulletin départemental</h3></div>`
        + texte.split("\n").map(l => `<p style="font-size:14px;line-height:1.5;margin-bottom:8px">${esc(l)}</p>`).join("")
        + `</div>` : "")
      + (emis ? `<p class="note">Émis le ${esc(String(emis).replace("T", " à ").replace("Z", " UTC"))}.</p>` : "")
      + source,
  };
}



/* ---------- Mesure contre modèle ---------- */

export function vueMesure(ctx) {
  const { postes } = ctx;
  const c = P.chargeCourante();
  const g = Reglages.lire();

  const jourFr = j => new Date(`${j}T12:00`)
    .toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  const source = `<p class="note">Jeu « Données climatologiques de base, quotidiennes » de `
    + `Météo-France sur data.gouv.fr, un fichier par département. Les valeurs de code qualité `
    + `supérieur à 1 sont écartées.</p>`;

  if (postes.etat === "indisponible") {
    return {
      titre: "Mesure et modèle", sous: g.commune || "",
      corps: `<div class="carte"><p class="vide">La source des relevés n'est pas `
        + `atteignable pour le moment.</p></div>${source}`,
    };
  }
  /* Le fichier existe mais s'arrête avant la fenêtre : c'est la source qui n'est
     plus alimentée, non le poste qui se tait. Le dire ainsi évite d'accuser le
     poste d'un défaut qui n'est pas le sien. */
  if (postes.etat === "perime") {
    return {
      titre: "Mesure et modèle",
      sous: postes.poste ? `${postes.poste.libelle}, ${nombreFr(postes.poste.km)} km` : "",
      corps: `<div class="carte"><p class="vide">Les relevés publiés s'arrêtent au `
        + `${esc(jourFr(postes.etendue.fin))}. La comparaison avec la prévision des quatorze `
        + `derniers jours n'est pas possible.</p></div>${source}`,
    };
  }
  if (postes.etat !== "ok" || !c?.daily) {
    return {
      titre: "Mesure et modèle", sous: g.commune || "",
      corps: `<div class="carte"><p class="vide">Aucun poste de mesure ouvert à moins de `
        + `quarante kilomètres de la commune.</p></div>${source}`,
    };
  }

  const d = c.daily;
  const i = P.iJour();
  const lignes = [];
  let cumulM = 0, cumulP = 0, divergents = 0, jours = 0;
  let mx = 1;

  for (let k = Math.max(0, i - 14); k < i; k++) {
    const jour = d.time[k];
    const mesure = postes.pluie.has(jour) ? Number(postes.pluie.get(jour)) : null;
    const modele = Number(d.precipitation_sum[k] || 0);
    if (mesure === null) continue;
    mx = Math.max(mx, mesure, modele);
    cumulM += mesure; cumulP += modele; jours++;
    // Un écart d'un millimètre change la lecture d'une journée.
    const ecart = Math.abs(mesure - modele) >= 1;
    if (ecart) divergents++;
    lignes.push({ jour, mesure, modele, ecart });
  }

  if (!lignes.length) {
    return {
      titre: "Mesure et modèle", sous: `${postes.poste.libelle}, ${nombreFr(postes.poste.km)} km`,
      corps: `<div class="carte"><p class="vide">Le poste n'a pas encore publié de relevé sur `
        + `la fenêtre. Il publie avec deux jours de retard.</p></div>`,
    };
  }

  const corps = lignes.reverse().map(l => {
    const dm = new Date(`${l.jour}T12:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" });
    const bm = Math.max(2, (l.mesure / mx) * 74);
    const bp = Math.max(2, (l.modele / mx) * 74);
    return `<tr${l.ecart ? ' class="ecart"' : ""}><td>${esc(dm)}</td>`
      + `<td>${l.mesure >= 0.1 ? `${nombreFr(l.mesure)}` : "—"}</td>`
      + `<td>${l.modele >= 0.1 ? `${nombreFr(l.modele)}` : "—"}</td>`
      + `<td><span class="paire"><i class="m" style="width:${bm.toFixed(0)}px"></i>`
      + `<i style="width:${bp.toFixed(0)}px"></i></span></td></tr>`;
  }).join("");

  return {
    titre: "Mesure et modèle",
    sous: `${postes.poste.libelle}, ${nombreFr(postes.poste.km)} km`,
    corps: `<div class="carte"><table class="ms">`
      + `<thead><tr><th>Jour</th><th>Mesuré</th><th>Annoncé</th><th></th></tr></thead>`
      + `<tbody>${corps}</tbody></table>`
      + `<div class="ms-bilan">`
      + `<div><b>${nombreFr(cumulM)} mm</b>mesurés sur ${jours} jours</div>`
      + `<div><b>${nombreFr(cumulP)} mm</b>annoncés</div>`
      + `<div><b>${divergents}</b>jour${divergents > 1 ? "s" : ""} d'écart</div>`
      + `</div>`
      + `<p class="note">Le trait plein est la mesure au poste, le trait clair la sortie du `
      + `modèle. Une ligne teintée marque un écart d'au moins un millimètre. Le cumul concorde `
      + `souvent quand les dates ne concordent pas.</p></div>`
      + `<p class="note">Poste ${esc(postes.poste.libelle)}, numéro ${esc(postes.poste.num)}, `
      + `à ${nombreFr(postes.poste.km)} km. Données climatologiques de base de Météo-France, `
      + `sur data.gouv.fr. Les valeurs de code qualité supérieur à 1 sont écartées.</p>`,
  };
}
