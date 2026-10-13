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

  /* La justesse récente, version 197 : les prévisions passées se lisent en
     temps universel et se rangent à l'heure de Paris. */
  ok("les prévisions passées se rangent à l'heure de Paris, une valeur par échéance",
    await p0.evaluate(async () => {
      const J = await import("/src/justesse.js");
      const h = { time: ["2026-08-17T13:00"], temperature_2m: [17], precipitation: [0.4] };
      for (let n = 1; n <= 7; n++) { h[`temperature_2m_previous_day${n}`] = [18 + n]; h[`precipitation_previous_day${n}`] = [n === 2 ? 1 : 0]; }
      return JSON.stringify(J.lirePassees({ hourly: h }));
    }) === JSON.stringify({ "2026-08-17T15": { t0: 17, mm0: 0.4, t: [19, 20, 21, 22, 23, 24, 25], mm: [0, 1, 0, 0, 0, 0, 0] } }));

  /* Sans clé, la justesse récente se juge sur le relevé d'Open-Meteo, 17 °C
     face aux 18,4 °C annoncés un jour avant. */
  const justesseRecente = async p => {
    await p.evaluate(() => document.getElementById("btnReglages").click());
    await p.waitForFunction(() => !/Lecture des cinq/.test(document.getElementById("rgJustesseIci")?.textContent || "x"), null, { timeout: 8000 }).catch(() => {});
    return p.evaluate(() => {
      const ici = document.getElementById("rgJustesseIci");
      return { note: ici?.querySelector(".note")?.textContent || "",
        lignes: [...(ici?.querySelectorAll(".rangee") || [])].map(r => r.innerText.replace(/\s+/g, " ").trim()),
        journal: document.querySelector("#rgJustesse .rg-journal")?.textContent || "" };
    });
  };
  const sansCle = await justesseRecente(p0);
  ok("sans clé, la justesse récente du lieu se juge sur le relevé d'Open-Meteo",
    sansCle.note === "Ici, ces cinq derniers jours, relevé d'Open-Meteo, sans station de Météo-France."
    && sansCle.lignes[0] === "À 1 jour 100 % à 2° près, trop chaude de 1,4°, pluie juste 100 % ± 1,4°"
    && sansCle.lignes.length === 5 && etat.appelsPassees.length === 1
    && /^https:\/\/previous-runs-api\.open-meteo\.com\/v1\/forecast\?latitude=47\.5&longitude=4\.3&hourly=temperature_2m,precipitation,temperature_2m_previous_day1,precipitation_previous_day1,.*previous_day7&past_days=5&forecast_days=1&timezone=GMT$/.test(etat.appelsPassees[0]),
    `${JSON.stringify(sansCle)} ; ${etat.appelsPassees.join(" ")}`);
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

  /* La mesure du moment, version 192, sous les bornes du jour. */
  const mesure = await p1.evaluate(() => document.querySelector(".pt-temps .bd-mesure")?.textContent || "");
  ok("la dernière mesure de la station se dit sous la température, avec la pluie et son âge",
    /^18° mesurés à Semur en Auxois, pluie 0,2 mm, il y a 1[23] min$/.test(mesure)
    && etat.appelsMesure.length >= 1 && etat.appelsMesure.every(u => /infrahoraire-6m\?apikey=[^&]+&id_station=21603001&format=json/.test(u)),
    `${mesure} ; ${etat.appelsMesure.join(" ")}`);
  ok("la mesure se nomme et se date en mots, et se tait au-delà d'une heure et demie",
    await p1.evaluate(async () => {
      const O = await import("/src/observations.js");
      const m = { t: 6.8, rr: 0, quand: Date.now() - 75 * 60000, station: { nom: "DIJON-LONGVIC" } };
      return [O.nomPropre("SEMUR EN AUXOIS_SAPC"), O.nomPropre("LA CHIAPPA"), O.phraseMesure(m),
        String(O.phraseMesure({ ...m, quand: Date.now() - 100 * 60000 }))].join(" | ");
    }) === "Semur en Auxois | La Chiappa | 6,8° mesurés à Dijon-Longvic, il y a 1 h 15 | null");
  const pied = await p1.evaluate(() => document.querySelector(".pied-cle")?.textContent || "");
  ok("la clé qui expire dans le mois se signale sous l'accueil",
    pied === "La clé de Météo-France expire le 28 août : à renouveler sur le portail, puis dans les réglages.", pied);

  /* La justesse récente avec la clé, version 197 : la station mesure 18 °C,
     la prévision émise N jours avant en annonçait 18 + 0,4 × N ; la pluie de
     13 h est vue jusqu'à trois jours. */
  const recente = await justesseRecente(p1);
  ok("avec la clé, la justesse récente du lieu se juge sur la station, à un, deux, trois, cinq et sept jours",
    recente.note === "Ici, ces cinq derniers jours, mesures de la station de Semur en Auxois."
    && recente.lignes.join(" | ") === "À 1 jour 100 % à 2° près, pluie juste 100 % ± 0,4°"
      + " | À 2 jours 100 % à 2° près, trop chaude de 0,8°, pluie juste 100 % ± 0,8°"
      + " | À 3 jours 100 % à 2° près, trop chaude de 1,2°, pluie juste 100 % ± 1,2°"
      + " | À 5 jours 100 % à 2° près, trop chaude de 2°, pluie juste 0 % ± 2°"
      + " | À 7 jours 0 % à 2° près, trop chaude de 2,8°, pluie juste 0 % ± 2,8°",
    JSON.stringify(recente));
  const reglages = await p1.evaluate(() => {
    const j = document.getElementById("rgJustesse");
    return { cle: document.getElementById("rgCleEtat")?.textContent || "",
      station: j?.querySelector(".rg-station")?.textContent || "",
      ligne: j?.querySelector(".rg-journal ~ .rangee")?.textContent.replace(/\s+/g, " ").trim() || "" };
  });
  ok("les réglages disent la fin de la clé, la station et la justesse mesurée sur l'appareil, pluie comprise",
    reglages.cle === "valable jusqu'au 28 août 2026"
    && /^Sur cet appareil, toutes communes confondues, depuis le .*13 août\. Mesures de la station de Semur en Auxois\.$/.test(reglages.station)
    && /À 1 jour.*100 % à 2° près, 5 relevés, trop chaude de 2°, pluie juste 0 %.*± 2°/.test(reglages.ligne),
    JSON.stringify(reglages));
  await c1.close();

  /* Un service muet le dit, sans chiffres. */
  etat.passeesMuettes = true;
  const [c2, p2] = await ouvrir({ ...FAIN, lat: 47.6 });
  const muette = await justesseRecente(p2);
  ok("sans réponse du service, la justesse récente le dit et le journal reste",
    muette.note === "Justesse récente non lue : le service ne répond pas." && muette.lignes.length === 0
    && /^Sur cet appareil/.test(muette.journal), JSON.stringify(muette));
  etat.passeesMuettes = false;
  await c2.close();
};
