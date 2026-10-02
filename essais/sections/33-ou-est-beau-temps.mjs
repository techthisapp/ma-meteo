/* Où est le beau temps. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */
import { METEO } from "../faux-services.mjs";

export const titre = "Où est le beau temps";
export const avecPage = true;

export default async T => {
  const { ok, txt, txtDe, ctxReponse, REGL_BEAU, reposer } = T;
  const [ctxBeau, pgBeau, urlsBeau] = await ctxReponse(
    () => JSON.parse(JSON.stringify(METEO)), REGL_BEAU);

  const lignesBeau = (p, ou) => p.evaluate(sel =>
    [...document.querySelectorAll(`${sel} .rangee`)].map(r => ({
      nom: r.querySelector(".rangee-txt b").textContent.trim(),
      sous: r.querySelector(".rangee-txt span").textContent,
      val: r.querySelector(".rangee-val").textContent.replace(/\s+/g, " ").trim(),
      ici: r.classList.contains("bt-ici"),
    })), ou);

  await pgBeau.locator('[data-feuille="beautemps"]').click();
  await pgBeau.waitForTimeout(900);

  ok("la feuille s'ouvre sur la question du lieu",
    (await txtDe(pgBeau, "#feuille-titre")).startsWith("Où est le beau temps"),
    await txtDe(pgBeau, "#feuille-titre"));

  const beauJour = await lignesBeau(pgBeau, "#btLieux");
  ok("les lieux suivis sont classés du plus beau au moins beau",
    beauJour.map(l => l.nom).join(",") === "Nordville,Fain-lès-Moutiers,Sudville",
    beauJour.map(l => l.nom).join(","));
  /* Le même jeu de lieux trié sur la température sortirait dans l'ordre inverse :
     c'est ce que ce contrôle interdit. */
  ok("le classement ne suit pas la température, qui va ici en sens contraire",
    await pgBeau.evaluate(async () => {
      const B = await import("/src/beautemps.js");
      const P = await import("/src/previsions.js");
      const l = [{ lat: 47.5, lon: 4.3 }, { lat: 48.2, lon: 4.3 }, { lat: 46.9, lon: 4.3 }];
      const { liste } = await P.journees(l);
      const cl = B.classer(l, liste, 0);
      const chaud = [...cl].sort((a, b) => b.tmax - a.tmax);
      return cl[0] === chaud[0] ? "le premier du classement est aussi le plus chaud" : "";
    }) === "");
  /* L'ensoleillement compte en part de la durée du jour, non en heures : cinq
     heures de soleil sont une belle journée en décembre et une journée grise en
     juin. C'est la seule chose que la durée du jour décide. */
  ok("le même ensoleillement vaut plus sur une journée courte",
    await pgBeau.evaluate(async () => {
      const B = await import("/src/beautemps.js");
      const commun = { pluie: 0, tmax: 22 };
      const hiver = B.score({ ...commun, soleil: 5, jour: 9 });
      const ete = B.score({ ...commun, soleil: 5, jour: 14 });
      return hiver > ete ? "" : `hiver ${hiver.toFixed(1)}, été ${ete.toFixed(1)}`;
    }) === "");
  ok("chaque rangée porte sa durée d'ensoleillement",
    beauJour.every(l => /^\d+(,\d)? h de soleil$/.test(l.val)),
    JSON.stringify(beauJour.map(l => l.val)));
  ok("chaque rangée porte la température du maximum",
    beauJour.every(l => /\d+°/.test(l.sous)),
    JSON.stringify(beauJour.map(l => l.sous)));
  /* La pluie s'écrit quand il en tombe, et rien quand il n'en tombe pas : « 0 mm »
     se lit comme une mesure alors que c'est une absence, et la rangée porte déjà
     sa distance et sa direction. */
  ok("la pluie ne s'écrit que s'il en tombe",
    await pgBeau.evaluate(async () => {
      const B = await import("/src/beautemps.js");
      const sec = B.journeeTxt({ tmax: 21, pluie: 0 });
      const mouille = B.journeeTxt({ tmax: 21, pluie: 3.4 });
      if (/mm/.test(sec)) return `une journée sèche dit « ${sec} »`;
      if (!/3,4 mm/.test(mouille)) return `une journée mouillée dit « ${mouille} »`;
      return "";
    }) === "");
  /* Le lieu courant porte son repère : c'est la rangée à laquelle les autres se
     comparent, et sans elle le classement ne dit pas s'il faut bouger. */
  ok("le lieu courant porte son repère, et lui seul",
    await pgBeau.locator("#btLieux .bt-ici").count() === 1
    && beauJour.find(l => l.ici)?.nom === "Fain-lès-Moutiers",
    JSON.stringify(beauJour.map(l => [l.nom, l.ici])));
  ok("le repère est un symbole, non un mot ajouté au nom",
    await pgBeau.locator("#btLieux .bt-ici .bt-repere").count() === 1);

  // La journée se choisit, et la charge d'essai retourne le classement d'un jour
  // à l'autre : un sélecteur qui ne serait pas lu laisserait le même ordre.
  await pgBeau.locator('[data-jour="1"]').click();
  await pgBeau.waitForTimeout(300);
  const beauDemain = await lignesBeau(pgBeau, "#btLieux");
  ok("le sélecteur de journée change le classement",
    beauDemain.map(l => l.nom).join(",") === "Sudville,Fain-lès-Moutiers,Nordville",
    beauDemain.map(l => l.nom).join(","));
  ok("le sélecteur marque la journée montrée",
    await pgBeau.locator('.bt-jours button.actif').count() === 1
    && (await txtDe(pgBeau, ".bt-jours button.actif")).trim() === "Demain",
    await txtDe(pgBeau, ".bt-jours button.actif"));
  await pgBeau.locator('[data-jour="0"]').click();
  await pgBeau.waitForTimeout(300);

  /* La grille coûte une requête de soixante-neuf points. Elle ne part pas à
     l'ouverture de la feuille : celle-ci se lit d'abord sur les lieux connus. */
  const appelsBeau = () => urlsBeau.filter(u => u.includes("sunshine_duration"));
  ok("la grille ne part pas d'elle-même",
    appelsBeau().length === 1 && appelsBeau()[0].split("latitude=")[1].split("&")[0].split(",").length === 3,
    appelsBeau().map(u => u.split("latitude=")[1].split("&")[0].split(",").length).join(","));
  ok("la carte des cent kilomètres n'est pas là avant qu'on la demande",
    await pgBeau.locator("#btGrille:not([hidden])").count() === 0);

  await pgBeau.locator("#btLarge").click();
  await reposer(pgBeau, 1800);

  ok("l'appui élargit la lecture à la grille, en un seul appel",
    appelsBeau().length === 2
    && appelsBeau()[1].split("latitude=")[1].split("&")[0].split(",").length === 69,
    appelsBeau().length + " appels");
  const grille = await lignesBeau(pgBeau, "#btGrille");
  ok("la grille montre cinq points, plus celui d'ici",
    grille.length === 6 && grille.filter(l => l.ici).length === 1,
    `${grille.length} rangées, ${grille.filter(l => l.ici).length} repère`);
  /* Ici garde sa rangée alors qu'elle n'est pas dans les cinq premières : c'est la
     référence, et sans elle les cinq points ne se comparent à rien. */
  ok("ici garde sa rangée hors du haut du classement",
    grille[grille.length - 1].ici, JSON.stringify(grille.map(l => l.ici)));
  /* Le point le plus ensoleillé de la grille est aussi le plus arrosé. Un
     classement qui suivrait l'ensoleillement seul le mettrait en tête. */
  ok("le point le plus ensoleillé, mais pluvieux, n'est pas en tête",
    await pgBeau.evaluate(async () => {
      const B = await import("/src/beautemps.js");
      const P = await import("/src/previsions.js");
      const g = B.grille({ lat: 47.5, lon: 4.3 });
      const { liste } = await P.journees(g);
      const cl = B.classer(g, liste, 0);
      const soleil = [...cl].sort((a, b) => b.soleil - a.soleil)[0];
      if (soleil.pluie < 5) return "le plus ensoleillé n'est pas le point arrosé";
      if (cl[0] === soleil) return "le plus ensoleillé est en tête malgré sa pluie";
      return "";
    }) === "");
  /* L'ensoleillement porte le score, ce que le seul classement des trois lieux ne
     montre pas : la charge d'essai y fait varier le soleil et la température
     ensemble. Une rangée de la grille les sépare, tous ses points ayant la même
     latitude, donc la même température et la même pluie, et ne différant que par
     le soleil. */
  ok("à pluie et température égales, le plus ensoleillé passe devant",
    await pgBeau.evaluate(async () => {
      const B = await import("/src/beautemps.js");
      const P = await import("/src/previsions.js");
      const g = B.grille({ lat: 47.5, lon: 4.3 });
      const { liste } = await P.journees(g);
      const cl = B.classer(g, liste, 0);
      const rangee = cl.filter(l => Math.abs(l.lat - cl[0].lat) < 0.001);
      if (rangee.length < 3) return "la rangée de grille est trop courte";
      if (new Set(rangee.map(l => l.tmax)).size !== 1) return "la rangée n'a pas une seule température";
      for (let i = 1; i < rangee.length; i++) {
        if (rangee[i].soleil > rangee[i - 1].soleil + 1e-9) return "un point moins ensoleillé passe devant";
      }
      return "";
    }) === "");
  /* Les cinq points montrés sont cinq endroits distincts. Sans distance minimale,
     ce sont les cinq mailles voisines du même coin de la grille : un seul endroit
     écrit cinq fois, à deux dixièmes d'heure de soleil près. */
  ok("deux points montrés ne sont jamais voisins",
    await pgBeau.evaluate(async () => {
      const B = await import("/src/beautemps.js");
      const P = await import("/src/previsions.js");
      const g = B.grille({ lat: 47.5, lon: 4.3 });
      const { liste } = await P.journees(g);
      const cl = B.classer(g, liste, 0);
      const m = B.retenir(cl);
      if (m.length !== B.SEUILS_BEAU.montres) return `${m.length} points retenus`;
      if (m[0] !== cl[0]) return "le meilleur point n'est plus en tête";
      for (let i = 0; i < m.length; i++) {
        for (let k = i + 1; k < m.length; k++) {
          const d = B.km(m[i], m[k]);
          if (d < B.SEUILS_BEAU.ecartMontres) return `deux points à ${d.toFixed(1)} km`;
        }
      }
      return "";
    }) === "");
  ok("le verdict dit où aller",
    /^Mieux à \d+ km (au|à l')/.test(await txtDe(pgBeau, ".bt-verdict")),
    await txtDe(pgBeau, ".bt-verdict"));
  /* Un écart trop faible ne fait pas partir : sans ce seuil, la feuille enverrait
     à trente kilomètres pour un quart d'heure de soleil. */
  ok("un écart trop faible laisse le beau temps ici",
    await pgBeau.evaluate(async () => {
      const B = await import("/src/beautemps.js");
      const e = B.SEUILS_BEAU.ecartUtile;
      const ici = { ici: true, score: 60 };
      const petit = { score: 60 + e - 0.5 }, grand = { score: 60 + e + 0.5 };
      if (B.mieuxQuIci([petit, ici], ici)) return "un écart sous le seuil fait partir";
      if (!B.mieuxQuIci([grand, ici], ici)) return "un écart au-dessus du seuil ne fait pas partir";
      return "";
    }) === "");
  /* Les points montrés sont nommés par l'interface adresse, et eux seuls :
     soixante-neuf géocodages inverses pour six rangées lues coûteraient soixante
     appels pour rien. */
  const inverses = () => urlsBeau.filter(u => u.includes("api-adresse") && u.includes("/reverse/"));
  ok("les points de la grille sont nommés",
    grille.filter(l => l.nom === "Grenoble").length >= 5,
    JSON.stringify(grille.map(l => l.nom)));
  /* Le centre de la grille est le lieu courant : son nom est déjà dans les
     réglages, et l'aller-retour vers l'interface adresse le remplacerait par
     celui que le géocodage inverse rend, qui peut être celui de la commune
     voisine. */
  ok("la rangée d'ici porte le nom du lieu courant",
    grille.find(l => l.ici)?.nom === "Fain-lès-Moutiers",
    grille.find(l => l.ici)?.nom);
  ok("seuls les points montrés sont nommés",
    inverses().length > 0 && inverses().length <= 12, `${inverses().length} appels`);
  ok("un point nommé garde sa distance et sa direction",
    grille.filter(l => !l.ici).every(l => /^à \d+ km (au |à l')\S+ · \d+°/.test(l.sous)),
    JSON.stringify(grille.map(l => l.sous)));

  /* La grille elle-même : cent kilomètres de rayon, vingt-deux de pas, le centre
     marqué une fois. Un point hors du disque coûterait de la donnée pour un lieu
     que personne n'irait chercher. */
  ok("la grille tient dans son rayon et porte un seul centre",
    await pgBeau.evaluate(async () => {
      const B = await import("/src/beautemps.js");
      const c = { lat: 47.5, lon: 4.3 };
      const g = B.grille(c);
      const hors = g.filter(p => p.km > B.SEUILS_BEAU.rayon + 0.001);
      if (hors.length) return `${hors.length} points hors du rayon`;
      if (g.filter(p => p.ici).length !== 1) return "le centre n'est pas marqué une fois";
      const pas = B.SEUILS_BEAU.pas;
      // Aucun endroit du disque n'est plus loin qu'une demi-diagonale de maille.
      const demi = Math.hypot(pas, pas) / 2;
      for (const t of [[47.6, 4.4], [47.2, 3.9], [48.0, 5.0]]) {
        const p = { lat: t[0], lon: t[1] };
        const d = Math.min(...g.map(q => B.km(p, q)));
        if (d > demi + 0.5) return `un point du disque est à ${d.toFixed(1)} km de la grille`;
      }
      return "";
    }) === "");

  /* La lecture est gardée en mémoire une demi-heure. Rouvrir la feuille dans ce
     délai ne redemande rien : sans cela, chaque aller-retour vers l'accueil
     coûterait un appel de plus à la source. */
  await pgBeau.locator("#feuille-fermer").click();
  await pgBeau.waitForTimeout(420);
  await pgBeau.locator('[data-feuille="beautemps"]').click();
  await pgBeau.waitForTimeout(700);
  ok("rouvrir la feuille ne redemande rien à la source",
    appelsBeau().length === 2, `${appelsBeau().length} appels`);
  ok("et les lieux y sont encore classés",
    (await lignesBeau(pgBeau, "#btLieux")).length === 3);

  await ctxBeau.close();

  /* ---------- L'air qu'on respire ---------- */
};
