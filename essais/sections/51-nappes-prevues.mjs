/* Les nappes prévues de la carte. Section écrite le 3 octobre 2026 pour le
   jalon 19, lot 5 ; elle part d'un état neuf préparé par essais/banc.mjs. La
   grille fabriquée est décrite dans `prevueCorps` des faux services. */
import { FAIN } from "../faux-services.mjs";

export const titre = "Les nappes prévues";
export const avecPage = false;

export default async T => {
  const { ok, etat, ouvrirCarte, reposer, appuiLong } = T;
  const [, p] = await ouvrirCarte({ ...FAIN, pluiecarte: false, foudrecarte: false, vigicarte: false }, 0, { sansFond: true });
  await reposer(p, 1500);

  /* Les fenêtres de la nuit et du matin, et les champs fixes, sur une série
     écrite à la main : de 9 h à 9 h le surlendemain. */
  const fixes = await p.evaluate(async () => {
    const P = await import("/src/prevue.js");
    const N = await import("/src/nappe.js");
    const n = N.COLS * N.RANGS;
    const t0 = Date.parse("2026-08-18T07:00:00Z") / 1000;
    const time = Array.from({ length: 36 }, (_, k) => t0 + k * 3600);
    const hp = k => (9 + k) % 24;
    const d = Array.from({ length: n }, () => ({ hourly: { time,
      temperature_2m: time.map((_, k) => (hp(k) === 5 && k > 12 ? -3 : 10)),
      precipitation: time.map((_, k) => (k < 30 ? 1 : 100)),
      snowfall: time.map(() => 0), wind_speed_10m: time.map(() => 10), wind_direction_10m: time.map(() => 0),
      wind_gusts_10m: time.map(() => 20), pressure_msl: time.map(() => 1013),
      cloud_cover: time.map((_, k) => ([22, 23, 0, 1].includes(hp(k)) ? 40 : 100)),
      visibility: time.map((_, k) => (hp(k) === 7 && k > 12 ? 250 : 30000)),
      freezing_level_height: time.map((_, k) => 2000 - k * 10) } }));
    const l = P.lire(d, Date.parse("2026-08-18T07:20:00Z"));
    const f = P.fenetres(l.temps);
    return { pluie24: l.fixes.pluie24[0], gel: l.fixes.gel[0], ciel: l.fixes.cielNuit[0], brouillard: l.fixes.brouillard[0],
      limite: l.fixes.limite[0], nuit: f.nuit.map(k => hp(k)).join(","), matin: f.matin.map(k => hp(k)).join(","),
      vue3: P.vue(l, 3).vent[0] };
  });
  ok("les champs fixes se tirent des bonnes fenêtres : 24 h de pluie, la nuit de 18 h à 10 h, le ciel de 22 h à 2 h, le matin de 5 h à 10 h",
    fixes.pluie24 === 24 && fixes.gel === -3 && fixes.ciel === 40 && fixes.brouillard === 250 && fixes.limite === 1470
    && fixes.nuit === "18,19,20,21,22,23,0,1,2,3,4,5,6,7,8,9" && fixes.matin === "5,6,7,8,9" && fixes.vue3 === 10,
    JSON.stringify(fixes));

  /* Le panneau porte les neuf nappes nouvelles, chacune nommée. */
  const tuiles = await p.evaluate(() => ["caVentMoy", "caRafales", "caPluie24", "caNeige24", "caLimite", "caPression", "caGel",
    "caCielNuit", "caBrouillard"].map(id => document.getElementById(id)?.querySelector("span")?.textContent || null));
  ok("le panneau porte les neuf nappes prévues, chacune nommée", tuiles.every(Boolean), JSON.stringify(tuiles));
  /* Toute nappe du panneau est une nappe que les réglages gardent. */
  const gardees = await p.evaluate(async () => {
    const R = await import("/src/reglages.js"), G = await import("/src/vues/carte-gabarit.js");
    return G.NAPPES_CARTE.map(n => n.cle).filter(c => !R.NAPPES.includes(c));
  });
  ok("toute nappe du panneau est gardée par les réglages", gardees.length === 0, gardees.join(" "));

  /* La pression : une lecture de la grille prévue, une nappe, des isobares
     tous les quatre hectopascals, la légende en hectopascals. Une autre nappe
     prévue ne relit rien. */
  const peindre = async id => {
    await p.locator("#caCouches").click();
    await p.waitForTimeout(150);
    await p.locator(`#${id}`).click();
    await p.locator("#caCouches").click();
    await reposer(p, 1500);
  };
  await peindre("caPression");
  const pression = await p.evaluate(async () => {
    const C = await import("/src/carte.js");
    return { traits: C.derniersTraits.n, niveaux: C.derniersTraits.niveaux.join(","),
      titre: document.getElementById("caLegTitre").textContent,
      grads: [...document.querySelectorAll("#caGrads span")].map(x => x.textContent).join(" ") };
  });
  /* Trois graduations seulement : à quatre chiffres, cinq se touchaient. */
  ok("la pression se peint avec ses isobares tous les quatre hectopascals, la légende en hectopascals",
    etat.appelsPrevue.length === 1 && pression.traits >= 5 && pression.niveaux.split(",").every(v => (Number(v) - 1012) % 4 === 0)
    && pression.titre === "Pression, maintenant (hPa)" && pression.grads === "985 1013 1040",
    JSON.stringify({ appels: etat.appelsPrevue.length, ...pression }));

  /* Le gel : le trait de zéro degré passe dans le nord-est ; la Bretagne
     sous la pluie et les Alpes sous la neige se lisent sur leurs nappes, et
     la bulle d'un point dit la valeur avec son unité. */
  await peindre("caGel");
  const gel = await p.evaluate(async () => {
    const C = await import("/src/carte.js");
    return { niveaux: C.derniersTraits.niveaux.join(","), traits: C.derniersTraits.n };
  });
  const valeurs = await p.evaluate(async () => {
    const P = await import("/src/prevue.js"), N = await import("/src/nappe.js");
    const d = await P.charger(), v = P.vue(d, 0);
    return { pluieBretagne: N.valeurA(v.pluie24, 48.2, -3), pluieLyon: N.valeurA(v.pluie24, 45.7, 4.8),
      neigeAlpes: N.valeurA(v.neige24, 45.2, 6.6), brouillard: N.valeurA(v.brouillard, 47, 4) };
  });
  ok("le gel trace le zéro degré, et la pluie, la neige et le brouillard tombent où la grille les met",
    gel.niveaux === "0" && gel.traits === 1 && valeurs.pluieBretagne > 20 && valeurs.pluieLyon === 0
    && valeurs.neigeAlpes > 8 && valeurs.brouillard < 1000 && etat.appelsPrevue.length === 1,
    JSON.stringify({ gel, valeurs, appels: etat.appelsPrevue.length }));

  await peindre("caPluie24");
  const b = await p.locator("#caToile").boundingBox();
  await p.locator("#caIci").click();
  await reposer(p, 800);
  await appuiLong(p, b.x + b.width * 0.5, b.y + b.height * 0.5 + 60);
  await p.waitForTimeout(800);
  await reposer(p, 1200);
  /* La recherche se fait ici, sur le texte que le banc a normalisé : dans la
     page, « 24 h » porte une espace insécable. */
  const lignes = await p.evaluate(() => [...document.querySelectorAll("#caBulle .cb-l")].map(x => x.textContent));
  const ligne = lignes.find(t => /Pluie sur 24 h/.test(t)) || "";
  ok("la bulle d'un point dit la valeur de la nappe prévue avec son unité",
    /^Pluie sur 24 h, cumul prévu : \d+ mm$/.test(ligne), JSON.stringify(lignes));
};
