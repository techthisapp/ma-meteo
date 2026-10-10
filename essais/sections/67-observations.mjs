/* Les observations des stations de Météo-France et la justesse mesurée,
   jalon 6. Section écrite le 10 octobre 2026, version 187. Elle part d'un
   état neuf préparé par essais/banc.mjs ; le faux service est décrit dans
   `faux-services.mjs`, au voisinage de `OBS_LISTE`. */
import { FIGE, FAIN, amorceGardee } from "../faux-services.mjs";

export const titre = "Les observations et la justesse mesurée";
export const avecPage = false;

/* Une clé d'essai à la forme de celles du portail : trois parties, la
   deuxième porte la date d'expiration, dix jours après l'heure figée. */
const enB64 = o => Buffer.from(JSON.stringify(o)).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const CLE = `entete.${enB64({ exp: Math.floor(FIGE / 1000) + 10 * 86400 })}.signature-d-essai`;

/* Cinq lignes du journal, à 15 h les cinq jours avant l'heure figée, notées
   à un jour : 20 °C annoncés, pas de pluie. La station mesure 18 °C et
   0,4 mm à cette heure. */
const JOURNAL = { v: 1, lignes: [13, 14, 15, 16, 17].map(j => ({
  l: "47.500,4.300", c: `2026-08-${j}T15`, e: 24, t: 20, mm: 0, pb: 10, le: `2026-08-${j - 1}T15` })) };

export default async T => {
  const { nav, etat, ok, brancherRoutes, ouvrirPage, reposer } = T;
  const ouvrir = async reglages => {
    const c = await nav.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
      locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
    });
    await c.addInitScript(amorceGardee(reglages, FIGE));
    await c.addInitScript(j => {
      if (!sessionStorage.getItem("seme")) { localStorage.setItem("mameteo.justesse.v1", j); sessionStorage.setItem("seme", "1"); }
    }, JSON.stringify(JOURNAL));
    await brancherRoutes(c);
    await c.route(/api\.rainviewer\.com/, r => r.abort());
    const p = await c.newPage();
    await ouvrirPage(p);
    await reposer(p, 2500);
    return [c, p];
  };

  /* Le choix de la station, sur la liste écrite à la main. */
  const [c0, p0] = await ouvrir(FAIN);
  ok("la station retenue est la plus proche à moins de vingt kilomètres et de deux cents mètres d'altitude",
    await p0.evaluate(async liste => {
      const O = await import("/src/observations.js");
      const l = O.lireListe(liste);
      const a = O.stationDe(l, 47.5, 4.3, 291), b = O.stationDe(l, 47.54, 4.33, 950), c = O.stationDe(l, 46.5, 3.0, 300);
      /* Au pied de la crête : la crête est à quelques centaines de mètres, mais
         six cents mètres plus haut ; Semur, plus loin, est à la bonne hauteur. */
      const d = O.stationDe(l, 47.535, 4.33, 291);
      return `${l.length} ${a && a.id} ${a && a.km} ${b && b.id} ${c} ${d && d.id}`;
    }, (await import("../faux-services.mjs")).OBS_LISTE) === "3 21603001 3.2 21999001 null 21603001");

  ok("le paquet se lit en degrés et à l'heure de Paris",
    await p0.evaluate(async () => {
      const O = await import("/src/observations.js");
      const m = O.lirePaquet([{ geo_id_insee: "21603001", validity_time: "2026-08-17T13:00:00Z", t: 291.15, rr1: 0.4 },
        { geo_id_insee: "21000000", validity_time: "2026-08-17T13:00:00Z", t: 300, rr1: 0 }], "21603001");
      return JSON.stringify(m);
    }) === JSON.stringify({ "2026-08-17T15": { t: 18, rr1: 0.4 } }));

  ok("sans clé, rien ne part vers les observations",
    etat.appelsObs.length === 0, `${etat.appelsObs.length} appels`);
  await c0.close();

  /* Avec la clé : le journal reçoit les mesures, et les réglages les
     montrent. */
  etat.appelsObs.length = 0;
  const [c1, p1] = await ouvrir({ ...FAIN, clepiaf: CLE });
  await p1.waitForTimeout(800);
  const lignes = await p1.evaluate(() => JSON.parse(localStorage.getItem("mameteo.justesse.v1")).lignes
    .filter(l => l.c.endsWith("T15") && l.e === 24 && l.c < "2026-08-18").map(l => `${l.c.slice(8, 10)}:${l.o}:${l.ro}:${l.st}`).join(" "));
  ok("avec la clé, les lignes du journal reçoivent la mesure de la station",
    lignes === "13:18:0.4:21603001 14:18:0.4:21603001 15:18:0.4:21603001 16:18:0.4:21603001 17:18:0.4:21603001"
    && etat.appelsObs.some(u => /liste-stations\?apikey=/.test(u))
    && etat.appelsObs.some(u => /paquet\/horaire\?id-departement=21&format=json&apikey=/.test(u)),
    `${lignes} ; ${etat.appelsObs.join(" ")}`);

  const pied = await p1.evaluate(() => document.querySelector(".pied-cle")?.textContent || "");
  ok("la clé qui expire dans le mois se signale sous l'accueil",
    pied === "La clé de Météo-France expire le 28 août : à renouveler sur le portail, puis dans les réglages.", pied);

  const reglages = await p1.evaluate(async () => {
    document.getElementById("btnReglages").click();
    await new Promise(r => setTimeout(r, 600));
    const cartes = [...document.querySelectorAll(".carte")];
    const j = cartes.find(c => /Justesse des prévisions/.test(c.textContent));
    return { cle: document.getElementById("rgCleEtat")?.textContent || "",
      station: j?.querySelector(".rg-station")?.textContent || "",
      ligne: j?.querySelector(".rangee")?.textContent.replace(/\s+/g, " ").trim() || "" };
  });
  ok("les réglages disent la fin de la clé, la station et la justesse mesurée, pluie comprise",
    reglages.cle === "valable jusqu'au 28 août 2026"
    && reglages.station === "Mesures de la station de SEMUR EN AUXOIS."
    && /À 1 jour.*100 % à 2° près, 5 relevés, trop chaude de 2°, pluie juste 0 %.*± 2°/.test(reglages.ligne),
    JSON.stringify(reglages));
  await c1.close();
};
