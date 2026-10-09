/* La prévision immédiate PIAF de Météo-France. Section écrite le 10 octobre
   2026, version 186, demande de Jérôme. Elle part d'un état neuf préparé par
   essais/banc.mjs ; le faux service est décrit dans `faux-services.mjs`, au
   voisinage de `PIAF_REF`. La clé des contrôles est une valeur d'essai. */
import { FIGE, FAIN, amorceGardee, PIAF_TEINTE } from "../faux-services.mjs";

export const titre = "La prévision immédiate PIAF";
export const avecPage = false;

const CLE = "cle-d-essai-des-controles-de-ma-meteo";

export default async T => {
  const { nav, etat, ok, brancherRoutes, ouvrirPage, ouvrirCarte, reposer } = T;

  const accueil = async reglages => {
    etat.profilPluie = "sec"; etat.profilRepli = "sec";
    const c = await nav.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
      locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
    });
    await c.addInitScript(amorceGardee(reglages, FIGE));
    await brancherRoutes(c);
    await c.route(/api\.rainviewer\.com/, r => r.abort());
    const p = await c.newPage();
    await ouvrirPage(p);
    await reposer(p, 2500);
    return [c, p];
  };
  const encart = p => p.evaluate(() => {
    const e = document.querySelector(".pp");
    return e ? { titre: e.querySelector(".pp-tete b").textContent, sous: e.querySelector(".pp-sous")?.textContent || "",
      zone: e.querySelector(".pp-zone")?.textContent.trim() || "",
      morceaux: [...e.querySelectorAll(".pp-s")].map(b => b.dataset.genre).join(" ") } : null;
  });

  /* Sans clé, rien ne part vers le service. */
  etat.appelsPiaf.length = 0;
  const [c0, p0] = await accueil(FAIN);
  const sans = await encart(p0);
  ok("sans clé, rien ne part vers la prévision immédiate et l'encart garde ses modèles",
    etat.appelsPiaf.length === 0 && sans === null, `${etat.appelsPiaf.length} appels, encart ${JSON.stringify(sans)}`);

  /* La lecture du TIFF du service : deux bandes, nombres sur 64 bits. */
  ok("le TIFF du service se lit, bandes comprises",
    await p0.evaluate(async () => {
      const P = await import("/src/piaf.js");
      /* Entête, répertoire de onze étiquettes, quatre valeurs en deux bandes,
         puis les adresses et les tailles des deux bandes. */
      const n = 11, ifd = 8, d = ifd + 2 + n * 12 + 4, offs = d + 32, tailles = offs + 8;
      const tout = new ArrayBuffer(tailles + 8), v = new DataView(tout);
      v.setUint16(0, 0x4949); v.setUint16(2, 42, true); v.setUint32(4, ifd, true); v.setUint16(ifd, n, true);
      [[256, 3, 1, 2], [257, 3, 1, 2], [258, 3, 1, 64], [259, 3, 1, 1], [262, 3, 1, 1], [273, 4, 2, offs],
        [277, 3, 1, 1], [278, 3, 1, 1], [279, 4, 2, tailles], [284, 3, 1, 1], [339, 3, 1, 3]].forEach(([t, ty, c, x], k) => {
        const o = ifd + 2 + 12 * k;
        v.setUint16(o, t, true); v.setUint16(o + 2, ty, true); v.setUint32(o + 4, c, true);
        if (ty === 3) v.setUint16(o + 8, x, true); else v.setUint32(o + 8, x, true);
      });
      [0.5, 1.25, 2, 3.5].forEach((x, k) => v.setFloat64(d + 8 * k, x, true));
      v.setUint32(offs, d, true); v.setUint32(offs + 4, d + 16, true);
      v.setUint32(tailles, 16, true); v.setUint32(tailles + 4, 16, true);
      const g = P.lireTiff(tout);
      return g ? `${g.largeur}x${g.hauteur} ${[...g.valeurs].join(",")}` : "illisible";
    }) === "2x2 0.5,1.25,2,3.5");

  /* Le compteur des requêtes : quarante-cinq par minute, la suivante attend. */
  ok("le compteur laisse partir quarante-cinq requêtes par minute, pas une de plus",
    await p0.evaluate(async () => {
      const P = await import("/src/piaf.js");
      P.oublier();
      let t = 0;
      const horloge = () => t;
      for (let k = 0; k < 45; k++) await P.tour(horloge);
      let partie = false;
      const attente = P.tour(horloge).then(() => { partie = true; });
      await new Promise(r => setTimeout(r, 120));
      const avant = partie;
      t = 61000;
      await Promise.race([attente, new Promise(r => setTimeout(r, 1500))]);
      P.oublier();
      return `${avant} ${partie}`;
    }) === "false true");

  /* La clé se saisit dans les réglages et se retire. */
  ok("la clé se saisit dans les réglages, reste sur l'appareil et se retire",
    await p0.evaluate(async cle => {
      const dodo = m => new Promise(r => setTimeout(r, m));
      document.getElementById("btnReglages").click();
      await dodo(500);
      const champ = document.getElementById("rgCle");
      if (!champ) return "champ absent";
      champ.value = cle;
      document.getElementById("rgCleOk").click();
      const etat1 = document.getElementById("rgCleEtat").textContent;
      const garde = JSON.parse(localStorage.getItem("mameteo.reglages.v1") || "{}").clepiaf === cle;
      const vide = champ.value === "";
      document.getElementById("rgCleNon").click();
      const etat2 = document.getElementById("rgCleEtat").textContent;
      const ote = !JSON.parse(localStorage.getItem("mameteo.reglages.v1") || "{}").clepiaf;
      return `${etat1} ${garde} ${vide} ${etat2} ${ote}`;
    }, CLE) === "enregistrée true true aucune true");
  await c0.close();

  /* Avec la clé, la suite de l'encart vient de PIAF. */
  etat.appelsPiaf.length = 0;
  const [c1, p1] = await accueil({ ...FAIN, clepiaf: CLE });
  const avec = await encart(p1);
  const cov = etat.appelsPiaf.filter(u => /GetCoverage/.test(u));
  ok("avec la clé, l'encart annonce la pluie que PIAF prévoit, et le dit",
    avec && avec.titre === "Pluie modérée vers 11 h" && /d'après la prévision immédiate de Météo-France/.test(avec.sous)
    && avec.zone === "prévue",
    JSON.stringify(avec));
  ok("le point se demande au quart d'heure, sur la dernière prévision servie, la clé dans l'adresse",
    cov.length >= 8 && cov.every(u => /___2026-08-18T06\.45\.00Z_PT15M/.test(u) && /GetCoverage\?apikey=/.test(u)
      && /subset=time\(2026-08-18T\d\d:(00|15|30|45):00Z\)/.test(decodeURIComponent(u))),
    `${cov.length} requêtes ; ${cov[0] || ""}`);
  await c1.close();

  /* La clé se place en tête de l'adresse : en dernière place, la passerelle
     du vrai service abîme le paramètre qui la précède. */
  /* La carte : avec la clé, les échéances de PIAF suivent le radar au pas
     de cinq minutes, sans mesure du déplacement. */
  /* Sans pluie annoncée à l'accueil, le sens d'arrivée ne s'y mesure pas :
     toute image de mesure viendrait de la carte. */
  etat.profilPiaf = "sec";
  etat.appelsPiaf.length = 0; etat.appelsRadar.length = 0;
  const [, q] = await ouvrirCarte({ ...FAIN, clepiaf: CLE }, 0, { sansFond: true });
  await reposer(q, 1500);
  const piste = await q.evaluate(() => document.getElementById("caPiste").getAttribute("aria-valuemax"));
  const mesure = etat.appelsRadar.filter(u => /\/obs9\//.test(u)).length;
  ok("avec la clé, la piste porte les échéances de PIAF au pas de cinq minutes, sans mesurer le déplacement",
    Number(piste) === 12 + 35 + 12 && mesure === 0, `${piste} cadres, ${mesure} tuiles de mesure`);

  const vu = await q.evaluate(async teinte => {
    const p = document.getElementById("caPiste");
    const dodo = m => new Promise(r => setTimeout(r, m));
    for (let k = 0; k < 6; k++) p.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await dodo(1500);
    const cv = document.getElementById("caToile"), ctx = cv.getContext("2d");
    let n = 0, vus = 0;
    for (let y = 80; y < cv.height - 200; y += 60) {
      for (let x = 40; x < cv.width - 40; x += 60) {
        const d = ctx.getImageData(x, y, 1, 1).data;
        vus++;
        if (Math.abs(d[0] - teinte[0]) < 40 && Math.abs(d[1] - teinte[1]) < 40 && Math.abs(d[2] - teinte[2]) < 40) n++;
      }
    }
    return { heure: document.getElementById("caHeure").textContent, part: n / vus };
  }, PIAF_TEINTE);
  const cartes = etat.appelsPiaf.filter(u => /GetMap/.test(u));
  ok("une échéance de PIAF se peint sur la carte depuis une seule image de la France",
    vu.heure === "09 h 30" && vu.part > 0.5 && cartes.length >= 1
    && cartes.every(u => /GetMap\?apikey=/.test(u) && /bbox=41,-6,51\.5,10\.5/.test(u) && /time=2026-08-18T\d\d:\d\d:00Z$/.test(u)),
    `${JSON.stringify(vu)} ; ${cartes.length} images ; ${cartes[0] || ""}`);
  etat.profilPiaf = "tard";
};
