/* L'écran de questions. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */

export const titre = "L'écran de questions";
export const avecPage = true;

export default async T => {
  const { pg, ok, appelsHoraire, txt, onglet } = T;
  await pg.locator('[data-onglet="accueil"]').click();
  await pg.waitForTimeout(400);
  ok("l'accueil porte la porte de l'écran de questions, sous les mesures du jour",
    await pg.evaluate(() => {
      const b = document.querySelector('[data-feuille="activites"]');
      const m = document.querySelector(".bd-mesures");
      if (!b || !m) return "un élément manque";
      if (b.dataset.feuille !== "activites") return "la porte n'ouvre pas la feuille";
      if (m.compareDocumentPosition(b) !== Node.DOCUMENT_POSITION_FOLLOWING) {
        return "la porte n'est pas sous les mesures";
      }
      return "";
    }) === "");
  /* Les deux portes se lisent comme une paire, quand et où. Elles se suivent, ont
     le même gabarit, et la seconde ne se range pas ailleurs sur la page. */
  ok("les trois portes se suivent et partagent leur gabarit",
    await pg.evaluate(() => {
      const cles = ["activites", "beautemps", "air"];
      /* Les portes seules : la tuile de l'air ouvre la même feuille que la porte
         « L'air qu'on respire », et la précéderait dans la page. */
      const p = cles.map(c => document.querySelector(`.porte[data-feuille="${c}"]`));
      if (p.some(x => !x)) return "une porte manque";
      for (let i = 1; i < p.length; i++) {
        if (p[i - 1].nextElementSibling !== p[i]) return `${cles[i]} ne suit pas ${cles[i - 1]}`;
      }
      if (p.some(x => !x.classList.contains("porte"))) return "gabarits différents";
      const l = p.map(x => x.getBoundingClientRect().width);
      if (Math.max(...l) - Math.min(...l) > 1) return `largeurs ${l.join(" et ")}`;
      return "";
    }) === "");
  await pg.locator('[data-feuille="activites"]').click();
  await pg.waitForTimeout(500);

  const lignesAct = async p => p.evaluate(() =>
    [...document.querySelectorAll("#feuille-corps .rangee")].map(r => ({
      nom: r.querySelector(".rangee-txt b").textContent,
      quand: r.querySelector(".rangee-val b").textContent,
      detail: r.querySelector(".rangee-txt span").textContent,
      sans: r.classList.contains("act-sans"),
    })));
  const act = await lignesAct(pg);
  ok("les six activités sont là, dans l'ordre",
    act.map(a => a.nom).join(" | ")
      === "Courir | Rouler à vélo | Étendre le linge | Aérer pour rafraîchir | Arroser | Laver la voiture",
    act.map(a => a.nom).join(" | "));
  ok("chacune porte un créneau daté et ce qui le décide",
    act.every(a => a.quand.trim() && a.detail.trim()),
    JSON.stringify(act.map(a => [a.quand, a.detail])));

  /* Le créneau annoncé doit tenir contre la série, recalculée à part par le
     contrôle : c'est la seule façon de savoir que le moteur ne rend pas le
     premier créneau venu. */
  ok("le créneau de la course est sec et dans ses bornes de ressenti et d'ultraviolet",
    await pg.evaluate(async () => {
      const A = await import("/src/activites.js");
      const P = await import("/src/previsions.js");
      const s = P.serieHoraire(0, A.FENETRE, 8);
      const c = A.ACTIVITES.find(x => x.cle === "courir").creneau(s, [...Array(s.n).keys()]);
      if (!c) return "aucun créneau";
      const S = A.SEUILS_ACT;
      for (let i = c[0]; i < c[1]; i++) {
        if ((s.mm[i] || 0) >= 0.1) return `pluie à ${s.heure[i]} h`;
        if (s.res[i] < S.courirFroid || s.res[i] > S.courirChaud) return `ressenti ${s.res[i]}`;
        if (s.uv[i] >= S.courirUv) return `UV ${s.uv[i]}`;
      }
      return "";
    }) === "");
  /* Les deux activités qu'on décide de faire soi-même restent dans les heures où
     l'on sort. Sans cette borne, une nuit calme et sèche donnait « 17 h à 03 h » :
     c'est vrai du vent, et personne ne roule à trois heures du matin. */
  ok("les créneaux d'effort restent dans les heures où l'on sort",
    await pg.evaluate(async () => {
      const A = await import("/src/activites.js");
      const P = await import("/src/previsions.js");
      const s = P.serieHoraire(0, A.FENETRE, 8);
      const S = A.SEUILS_ACT;
      for (const cle of ["courir", "velo"]) {
        const c = A.ACTIVITES.find(x => x.cle === cle).creneau(s, [...Array(s.n).keys()]);
        if (!c) continue;
        for (let i = c[0]; i < c[1]; i++) {
          if (s.heure[i] < S.effort[0] || s.heure[i] >= S.effort[1]) {
            return `${cle} à ${s.heure[i]} h`;
          }
        }
      }
      return "";
    }) === "");
  /* Douze heures sèches après le lavage : sans elles, la première averse défait
     le travail, et c'est la seule condition de cette activité. */
  ok("le créneau du lavage porte ses douze heures sèches",
    await pg.evaluate(async () => {
      const A = await import("/src/activites.js");
      const P = await import("/src/previsions.js");
      const s = P.serieHoraire(0, A.FENETRE, 8);
      const c = A.ACTIVITES.find(x => x.cle === "voiture").creneau(s, [...Array(s.n).keys()]);
      if (!c) return "aucun créneau";
      for (let j = c[0]; j <= c[0] + A.SEUILS_ACT.lavageSec; j++) {
        if ((s.mm[j] || 0) >= 0.1) return `pluie ${j - c[0]} heures après`;
      }
      return "";
    }) === "");
  /* La colonne d'évapotranspiration est demandée à la source, et la signature des
     colonnes entre dans la clé du cache : une charge écrite sans elle ne doit pas
     être servie au code qui la lit. */
  ok("l'évapotranspiration est demandée en horaire et en quotidien",
    appelsHoraire.some(u => /hourly=[^&]*et0_fao_evapotranspiration/.test(u))
    && appelsHoraire.some(u => /daily=[^&]*et0_fao_evapotranspiration/.test(u)),
    appelsHoraire.length + " requêtes");
  ok("la signature des colonnes entre dans la clé du cache",
    await pg.evaluate(() => {
      const c = JSON.parse(localStorage.getItem("mameteo.previsions.v1") || "null");
      /* La clé porte la signature des colonnes, le jeton de la règle de lecture
         du temps sensible, puis celui du recalage des heures sur l'heure de
         Paris : trois raisons distinctes de ne pas servir une charge écrite par
         une version d'avant. */
      return c && /\|[0-9a-z]+c\|apaise1\|recale1$/.test(c.cle) ? "" : `clé ${c ? c.cle : "absente"}`;
    }) === "");
  await pg.locator("#feuille-fermer").click();
  await pg.waitForTimeout(400);
};
