/* Les bulletins d'estimation du risque d'avalanche de Météo-France. Section
   écrite le 10 octobre 2026, version 189. Elle part d'un état neuf préparé
   par essais/banc.mjs ; le faux service est décrit dans `faux-services.mjs`,
   au voisinage de `BRA_MASSIFS`. */
import { FIGE, FAIN, amorceGardee, BRA_BELLEDONNE, BRA_HORS, BRA_MASSIFS } from "../faux-services.mjs";

export const titre = "Les bulletins d'avalanche";
export const avecPage = false;

const CLE = "cle-d-essai-des-controles-de-ma-meteo";
/* Deux stations près de Grenoble, en Belledonne, et une dans le Jura, hors
   des massifs des bulletins. */
const STATIONS = [{ nom: "Chamrousse", lat: 45.12, lon: 5.88 }, { nom: "Les Sept-Laux", lat: 45.26, lon: 6.03 },
  { nom: "Métabief", lat: 46.77, lon: 6.35 }];

export default async T => {
  const { nav, etat, ok, brancherRoutes, ouvrirPage, reposer } = T;
  const ouvrir = async reglages => {
    const c = await nav.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
      locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
    });
    await c.addInitScript(amorceGardee(reglages, FIGE));
    await brancherRoutes(c);
    await c.route(/api\.rainviewer\.com/, r => r.abort());
    const p = await c.newPage();
    await ouvrirPage(p);
    await reposer(p, 1500);
    return [c, p];
  };

  const [c0, p0] = await ouvrir(FAIN);
  /* La lecture du bulletin, sur l'exemple du document de Météo-France. */
  ok("le bulletin se lit : risque par altitude, maximum, tendance, pentes et résumé",
    await p0.evaluate(async xml => {
      const A = await import("/src/avalanche.js");
      const b = A.lireBulletin(xml);
      return [b.massif, b.risque1, b.risque2, b.altitude, b.maxi, b.maxiJ2, b.pentes.join(","), b.resume].join(" | ");
    }, BRA_BELLEDONNE) === "Belledonne | 2 | 3 | 2100 | 3 | 2 | NE,S,NW | Départs spontanés : quelques coulées en pentes raides.");

  ok("hors saison, le message du service se lit comme tel",
    await p0.evaluate(async xml => {
      const A = await import("/src/avalanche.js");
      const b = A.lireBulletin(xml);
      return b ? `${b.horsSaison} ${/début novembre/.test(b.message)}` : "illisible";
    }, BRA_HORS) === "true true");

  ok("le risque et les pentes se disent en mots",
    await p0.evaluate(async xml => {
      const A = await import("/src/avalanche.js");
      const b = A.lireBulletin(xml);
      const un = A.phraseRisque({ ...b, risque2: null });
      return [A.phraseRisque(b), un, A.phrasePentes(b)].join(" | ");
    }, BRA_BELLEDONNE) === "Risque marqué au-dessus de 2100 m, limité plus bas | Risque limité, 2 sur 5 | "
      + "Pentes les plus dangereuses : nord-est, sud, nord-ouest");

  ok("une station se range dans le massif qui la contient, ou dans aucun",
    await p0.evaluate(async ([geo, st]) => {
      const A = await import("/src/avalanche.js");
      const l = A.lireMassifs(geo);
      return st.map(s => A.massifDe(l, s.lat, s.lon)?.nom || "aucun").join(",");
    }, [BRA_MASSIFS, STATIONS]) === "Belledonne,Belledonne,aucun");

  ok("sans clé, aucun bulletin ne se demande",
    await p0.evaluate(async st => (await import("/src/avalanche.js")).charger(st), STATIONS) === null
    && etat.appelsBra.length === 0, `${etat.appelsBra.length} appels`);
  await c0.close();

  /* Avec la clé : un seul bulletin pour les deux stations de Belledonne, et
     la carte de la feuille de la neige. */
  etat.appelsBra.length = 0;
  const [c1, p1] = await ouvrir({ ...FAIN, clepiaf: CLE });
  const carte = await p1.evaluate(async st => {
    const A = await import("/src/avalanche.js"), V = await import("/src/vues/loisirs.js");
    const e = await A.charger(st);
    const div = document.createElement("div");
    div.innerHTML = V.avalancheHTML(st, () => {});
    return { massifs: e.massifs.map(m => m.massif).join(","), fort: A.risqueFort(e),
      texte: div.textContent.replace(/\s+/g, " ").trim(), classe: div.firstElementChild?.className };
  }, STATIONS);
  ok("avec la clé, la feuille de la neige porte le bulletin du massif des stations, une fois",
    carte.massifs === "Belledonne" && carte.classe === "carte av av-r3"
    && carte.texte.startsWith("Risque d'avalanche, Belledonne3 sur 5Risque marqué au-dessus de 2100 m, limité plus bas.")
    && /Surlendemain : limité, 2 sur 5\./.test(carte.texte) && /Pentes les plus dangereuses : nord-est, sud, nord-ouest\./.test(carte.texte)
    && etat.appelsBra.filter(u => /massif\/BRA/.test(u)).length === 1 && etat.appelsBra.some(u => /liste-massifs\?apikey=/.test(u)),
    `${JSON.stringify(carte)} ; ${etat.appelsBra.join(" ")}`);

  ok("un risque marqué ne remonte pas à l'accueil ; un risque fort, si",
    carte.fort === null && await p1.evaluate(async () => {
      const A = await import("/src/avalanche.js");
      const f = A.risqueFort({ massifs: [{ massif: "Vanoise", b: { horsSaison: false, maxi: 4 } }, { massif: "Belledonne", b: { horsSaison: false, maxi: 3 } }] });
      return `${f.massif} ${f.maxi}`;
    }) === "Vanoise 4");
  await c1.close();

  /* Hors saison, une ligne le dit. */
  etat.braHors = true;
  const [c2, p2] = await ouvrir({ ...FAIN, clepiaf: CLE });
  const hors = await p2.evaluate(async st => {
    const A = await import("/src/avalanche.js"), V = await import("/src/vues/loisirs.js");
    await A.charger(st);
    const div = document.createElement("div");
    div.innerHTML = V.avalancheHTML(st, () => {});
    return div.textContent.replace(/\s+/g, " ").trim();
  }, STATIONS);
  etat.braHors = false;
  ok("hors saison, la feuille dit que les bulletins reprennent début novembre",
    hors === "Risque d'avalancheHors saison : les bulletins de Belledonne reprennent début novembre.", hors);
  await c2.close();
};
