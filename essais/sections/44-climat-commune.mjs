/* Le climat de la commune. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */
import { FAIN, amorce, archiveMax } from "../faux-services.mjs";

export const titre = "Le climat de la commune";
export const avecPage = true;

export default async T => {
  const { nav, etat, ok, brancherRoutes, ouvrirPage, txt, txtDe, ctxReponse,
    METEO_NUE, reposer } = T;
  const ouvrirClimat = async p => {
    await p.locator('[data-feuille="climat"]').click();
    await reposer(p, 3300);
    return p.evaluate(() =>
      [...document.querySelectorAll("#feuille-corps .rangee")].map(r => ({
        nom: r.querySelector(".rangee-txt b")?.textContent.trim() || "",
        sous: r.querySelector(".rangee-txt span")?.textContent.replace(/\s+/g, " ").trim() || "",
        val: r.querySelector(".rangee-val")?.textContent.replace(/\s+/g, " ").trim() || "",
      })));
  };

  etat.appelsArchive.length = 0;
  const [ctxClimat, pgClimat] = await ctxReponse(METEO_NUE);

  /* L'archive longue pèse cent soixante-six kilooctets : elle ne se lit pas au
     chargement de l'application, mais à l'ouverture de la feuille. */
  ok("l'archive n'est pas lue tant que la feuille n'est pas ouverte",
    etat.appelsArchive.length === 0, `${etat.appelsArchive.length} appels`);

  const lignesClimat = await ouvrirClimat(pgClimat);

  ok("la feuille du climat s'ouvre depuis l'accueil",
    (await txtDe(pgClimat, "#feuille-titre")).startsWith("Le climat d'ici"),
    await txtDe(pgClimat, "#feuille-titre"));

  /* Deux lectures et pas davantage : l'archive longue, qui s'arrête à la fin de
     l'année écoulée, et la série récente, qui part du 1er décembre d'avant pour
     qu'un hiver à cheval sur le changement d'année soit entier. */
  /* Depuis le jalon 14, une troisième lecture s'y ajoute, la semaine de la
     comparaison : les lectures se distinguent par leurs dates, non par leur
     ordre d'arrivée. */
  const debutDe = u => new URL(u).searchParams.get("start_date");
  const lectureLongue = () => etat.appelsArchive.filter(u => debutDe(u) === "1950-01-01");
  const lectureRecente = () => etat.appelsArchive.filter(u => debutDe(u) === "2025-12-01");
  await pgClimat.waitForTimeout(800);
  ok("elle lit l'archive longue puis la série récente",
    lectureLongue().length === 1 && lectureRecente().length === 1,
    `${etat.appelsArchive.length} appels : ${etat.appelsArchive.map(debutDe).join(", ")}`);
  ok("l'archive longue va de 1950 à la fin de l'année écoulée",
    (() => {
      const q = new URL(lectureLongue()[0]).searchParams;
      if (q.get("start_date") !== "1950-01-01") return `début ${q.get("start_date")}`;
      if (q.get("end_date") !== "2025-12-31") return `fin ${q.get("end_date")}`;
      return q.get("daily") === "temperature_2m_max,temperature_2m_min,precipitation_sum"
        ? "" : `colonnes ${q.get("daily")}`;
    })() === "", lectureLongue()[0] || "");
  ok("la série récente part du 1er décembre d'avant et s'arrête aujourd'hui",
    (() => {
      const q = new URL(lectureRecente()[0]).searchParams;
      if (q.get("start_date") !== "2025-12-01") return `début ${q.get("start_date")}`;
      return q.get("end_date") === "2026-08-18" ? "" : `fin ${q.get("end_date")}`;
    })() === "", lectureRecente()[0] || "");

  /* Jalon 14, lot 1 : la comparaison dans le temps, dans la feuille du climat.
     La semaine du 18 août 2026 va du lundi 17 au dimanche 23 ; l'an dernier par
     défaut, ses mêmes dates en 2025, sept jours lus et pas davantage. */
  await pgClimat.locator("#clComparer .cj-l").first().waitFor({ timeout: 8000 }).catch(() => {});
  const cmpDit = await pgClimat.evaluate(() => {
    const c = document.querySelector("#clComparer");
    return { vue: !!c && !c.hidden, annees: c ? c.querySelectorAll(".cmp-annee option").length : 0,
      defaut: c?.querySelector(".cmp-annee")?.value || "", graphe: !!c?.querySelector("svg.cmp"),
      phrase: c?.querySelector(".cj-l")?.dataset.phrase || "" };
  });
  /* Depuis le 29 septembre 2026, la comparaison s'ouvre sur les 7 derniers jours,
     du 11 au 17 août, jusqu'à hier : les deux années se lisent dans l'archive. */
  const lecturePeriode = (a, d0, d1) => etat.appelsArchive.filter(u => debutDe(u) === `${a}-${d0}`
    && new URL(u).searchParams.get("end_date") === `${a}-${d1}`);
  ok("la feuille du climat compare les 7 derniers jours aux mêmes jours de l'an dernier, dans l'archive",
    cmpDit.vue && cmpDit.defaut === "2025" && cmpDit.annees === 2026 - 1940 && cmpDit.graphe
    && /^(Plus chauds que les|Plus frais que les|Semblables aux) mêmes 7 jours de 2025, /.test(cmpDit.phrase)
    && lecturePeriode(2025, "08-11", "08-17").length === 1 && lecturePeriode(2026, "08-11", "08-17").length === 1,
    JSON.stringify(cmpDit));
  await pgClimat.locator("#clComparer .cmp-annee").selectOption("2003");
  await pgClimat.waitForFunction(() => /jours de 2003,/.test(document.querySelector("#clComparer .cj-l")?.dataset.phrase || ""),
    null, { timeout: 8000 }).catch(() => {});
  const cmp2003 = await pgClimat.evaluate(() => document.querySelector("#clComparer .cj-l")?.dataset.phrase || "");
  ok("une autre année se choisit, et se lit pour ses dates seulement",
    /mêmes 7 jours de 2003, /.test(cmp2003) && lecturePeriode(2003, "08-11", "08-17").length === 1, cmp2003);

  /* Le choix de la période : les 30 derniers jours, du 19 juillet au 17 août, se
     lisent dans l'archive pour les deux années ; les 7 prochains jours, du 19 au
     25 août, dans la prévision pour cette année. Jamais de période à cheval. */
  const phraseCmp = () => pgClimat.evaluate(() => document.querySelector("#clComparer .cj-l")?.dataset.phrase || "");
  await pgClimat.locator("#clComparer .cmp-p-temps").selectOption("30p");
  await pgClimat.waitForFunction(() => /mêmes 30 jours de 2003,/.test(document.querySelector("#clComparer .cj-l")?.dataset.phrase || ""),
    null, { timeout: 8000 }).catch(() => {});
  const cmp30 = await phraseCmp();
  /* Le contexte de la feuille du climat a son propre faux service de prévision,
     qui ne consigne pas ses requêtes : la page les écoute elle-même. */
  const prevuesClimat = [];
  const ecouteClimat = r => { const u = r.url(); if (u.includes("api.open-meteo.com/v1/forecast") && u.includes("start_date=")) prevuesClimat.push(u); };
  pgClimat.on("request", ecouteClimat);
  await pgClimat.locator("#clComparer .cmp-p-temps").selectOption("7f");
  await pgClimat.waitForFunction(() => /mêmes 7 jours de 2003,/.test(document.querySelector("#clComparer .cj-l")?.dataset.phrase || "")
    && /prévision/.test(document.querySelector("#clComparer .note")?.textContent || ""), null, { timeout: 8000 }).catch(() => {});
  const cmp7f = await phraseCmp();
  pgClimat.off("request", ecouteClimat);
  const prevu7 = prevuesClimat.filter(u => new URL(u).searchParams.get("start_date") === "2026-08-19"
    && new URL(u).searchParams.get("end_date") === "2026-08-25");
  await pgClimat.locator("#clComparer .cmp-p-temps").selectOption("7p");
  await pgClimat.waitForTimeout(600);
  ok("une période passée se lit dans l'archive jusqu'à hier, une période à venir dans la prévision dès demain",
    /mêmes 30 jours de 2003, /.test(cmp30) && lecturePeriode(2003, "07-19", "08-17").length === 1
    && lecturePeriode(2026, "07-19", "08-17").length === 1
    && /mêmes 7 jours de 2003, /.test(cmp7f) && prevu7.length === 1 && lecturePeriode(2003, "08-19", "08-25").length === 1,
    JSON.stringify({ cmp30, cmp7f, prevu: prevu7.length }));

  /* Jalon 14, lot 2 : la comparaison entre lieux, dans un contexte à part où
     trois lieux sont suivis. Les trois se lisent ensemble, en une requête ; une
     pastille retire un lieu, et la requête suivante n'en porte plus que deux. */
  const ctxLieux = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await ctxLieux.addInitScript(amorce(FAIN));
  await ctxLieux.addInitScript(() => {
    const r = JSON.parse(localStorage.getItem("mameteo.reglages.v1") || "{}");
    const ici = { commune: r.commune, lat: r.lat, lon: r.lon, codePostal: r.codePostal };
    r.suivies = [ici, { commune: "Paris", lat: 48.8566, lon: 2.3522 }, { commune: "Lecci", lat: 41.6795, lon: 9.3186 }];
    localStorage.setItem("mameteo.reglages.v1", JSON.stringify(r));
  });
  await brancherRoutes(ctxLieux);
  const pgLieux = await ctxLieux.newPage();
  await ouvrirPage(pgLieux);
  await reposer(pgLieux, 2250);
  etat.appelsLieux.length = 0;
  const archiveAvantLieux = etat.appelsArchive.length;
  await ouvrirClimat(pgLieux);
  await pgLieux.locator("#clLieux .cj-l").first().waitFor({ timeout: 8000 }).catch(() => {});
  const lieuxDit = await pgLieux.evaluate(() => ({
    phrase: document.querySelector("#clLieux .cj-l")?.dataset.phrase || "",
    lignes: document.querySelectorAll("#clLieux .cmp-tab tbody tr").length,
    puces: [...document.querySelectorAll("#clLieux .cmp-puce")].map(b => `${b.textContent}${b.classList.contains("choisie") ? "*" : ""}`),
    traces: document.querySelectorAll("#clLieux svg.cmp-lieux polyline").length,
  }));
  const latsDe = u => new URL(u).searchParams.get("latitude").split(",").length;
  const archivesLieux = () => etat.appelsArchive.slice(archiveAvantLieux).filter(u => latsDe(u) > 1);
  const premiereLieux = archivesLieux()[0] || "";
  await pgLieux.locator("#clLieux .cmp-puce", { hasText: "Paris" }).click();
  await pgLieux.waitForFunction(() => document.querySelectorAll("#clLieux .cmp-tab tbody tr").length === 2, null, { timeout: 8000 }).catch(() => {});
  const lieuxApres = await pgLieux.evaluate(() => ({
    phrase: document.querySelector("#clLieux .cj-l")?.dataset.phrase || "",
    lignes: document.querySelectorAll("#clLieux .cmp-tab tbody tr").length,
  }));
  const archivesApres = archivesLieux().length;
  await pgLieux.locator("#clLieux .cmp-p-lieux").selectOption("7f");
  await pgLieux.waitForFunction(() => /ces 7 prochains jours/.test(document.querySelector("#clLieux .cj-l")?.dataset.phrase || ""),
    null, { timeout: 8000 }).catch(() => {});
  const lieuxAvenir = await pgLieux.evaluate(() => document.querySelector("#clLieux .cj-l")?.dataset.phrase || "");
  await ctxLieux.close();
  ok("la feuille du climat compare les 7 derniers jours entre lieux suivis, en une requête à l'archive",
    lieuxDit.lignes === 3 && lieuxDit.traces === 3 && lieuxDit.puces.join(" ") === "Paris* Lecci*"
    && /^Lecci le plus chaud ces 7 derniers jours, [\d,]+° en moyenne au plus chaud ; Paris le plus arrosé, 35 mm\.$/.test(lieuxDit.phrase)
    && premiereLieux && latsDe(premiereLieux) === 3 && new URL(premiereLieux).searchParams.get("start_date") === "2026-08-11",
    JSON.stringify({ lieuxDit, premiereLieux }));
  ok("une pastille retire un lieu, et la comparaison se refait sans lui",
    lieuxApres.lignes === 2 && /^Lecci le plus chaud ces 7 derniers jours, /.test(lieuxApres.phrase)
    && archivesApres === 2, JSON.stringify({ lieuxApres, archivesApres }));
  ok("entre lieux, une période à venir se lit dans la prévision",
    /^\S+ le plus chaud ces 7 prochains jours, /.test(lieuxAvenir)
    && etat.appelsLieux.some(u => new URL(u).searchParams.get("start_date") === "2026-08-19" && latsDe(u) === 2), lieuxAvenir);

  /* Le percentile, recalculé ici à partir de la formule de la charge : toutes les
     journées à onze jours du 18 août, de 1950 à 2025, comparées au maximum que la
     semaine affiche pour aujourd'hui. */
  const attenduClimat = (() => {
    const rangDe = (an, mois, jour) => {
      const c = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
      const b = (an % 4 === 0 && an % 100 !== 0) || an % 400 === 0;
      return c[mois - 1] + jour - 1 + (mois > 2 && b ? 1 : 0);
    };
    const centre = Math.floor(rangDe(2026, 8, 18) / 5) * 5 + 2;
    const ech = [];
    let recMax = -99, recMaxAn = 0, recMin = 99, recMinAn = 0;
    const parAn = new Map();
    for (let an = 1950; an <= 2025; an++) {
      const b = (an % 4 === 0 && an % 100 !== 0) || an % 400 === 0;
      const nj = b ? 366 : 365;
      for (let r = 0; r < nj; r++) {
        const M = archiveMax(an, r);
        const e = Math.abs(r - centre);
        if (Math.min(e, 366 - e) <= 5) ech.push(M);
        if (r === rangDe(an, 8, 18)) {
          if (M > recMax) { recMax = M; recMaxAn = an; }
          const mn = Math.round((M - 8) * 10) / 10;
          if (mn < recMin) { recMin = mn; recMinAn = an; }
        }
        let a = parAn.get(an); if (!a) parAn.set(an, a = [0, 0]);
        a[0] += (M + (M - 8)) / 2; a[1]++;
      }
    }
    ech.sort((x, y) => x - y);
    const q = [];
    for (let k = 0; k <= 100; k += 10) q.push(Math.round(ech[Math.round(k / 100 * (ech.length - 1))] * 10) / 10);
    const annees = [...parAn.keys()].sort((a, b) => a - b).map(y => parAn.get(y)[0] / parAn.get(y)[1]);
    const moy = l => l.reduce((a, b) => a + b, 0) / l.length;
    return { q, mediane: q[5], recMax, recMaxAn, recMin, recMinAn,
      annees, montee: moy(annees.slice(-30)) - moy(annees.slice(0, 30)) };
  })();

  const maxSemaine = await pgClimat.evaluate(async () => {
    const P = await import("/src/previsions.js");
    const i = P.iJour();
    const c = P.chargeCourante();
    const h = P.jourHoraire(c.daily.time[i]);
    return h ? h.tx : c.daily.temperature_2m_max[i];
  });

  ok("le maximum comparé est celui que la semaine affiche",
    lignesClimat[0]?.val.startsWith(`${Math.round(maxSemaine)}°`),
    `${JSON.stringify(lignesClimat[0])} contre ${maxSemaine}`);

  /* Le percentile attendu se calcule ici, dans la suite, et non en demandant au
     module de se juger lui-même : une garde qui appellerait `percentile` pour
     savoir ce que `percentile` doit rendre ne tomberait sous aucune faute. */
  const percentileAttendu = (() => {
    const q = attenduClimat.q, v = maxSemaine;
    if (v <= q[0]) return 0;
    if (v >= q[q.length - 1]) return 100;
    for (let k = 0; k < q.length - 1; k++) {
      if (v >= q[k] && v <= q[k + 1]) {
        const l = q[k + 1] - q[k];
        return (k + (l > 0 ? (v - q[k]) / l : 0)) * 10;
      }
    }
    return null;
  })();
  ok("le percentile du jour est celui de la distribution de l'archive",
    Math.abs(Math.round(percentileAttendu)
      - Number((lignesClimat[0]?.val.match(/(\d+)\s*%/) || [0, 0])[1])) <= 1,
    `attendu ${percentileAttendu?.toFixed(1)}, écrit « ${lignesClimat[0]?.val} »`);

  ok("la médiane écrite est celle des mêmes dates",
    lignesClimat[1]?.val === `${Math.round(attenduClimat.mediane)}°`
    && /18 août de 1950 à 2025/.test(lignesClimat[1]?.sous || ""),
    JSON.stringify(lignesClimat[1]));

  /* Les records portent la date exacte et non la fenêtre : un record du 18 août
     est un fait du 18 août. */
  ok("les records de la date portent leur valeur et leur année",
    lignesClimat[2]?.val === `${Math.round(attenduClimat.recMax)}° ${attenduClimat.recMaxAn}`
    && lignesClimat[3]?.val === `${Math.round(attenduClimat.recMin)}° ${attenduClimat.recMinAn}`,
    `${lignesClimat[2]?.val} | ${lignesClimat[3]?.val}`);

  /* Le 18 août, l'été porte soixante-dix-neuf journées : c'est lui qui se
     compare. Le 10 septembre, l'automne n'en porterait que dix, et c'est l'été
     qui se comparerait encore. */
  ok("la saison comparée est celle qui porte trente journées",
    await pgClimat.evaluate(async () => {
      const C = await import("/src/climat.js");
      const cas = [[8, 18, "ete", true], [9, 10, "ete", false], [12, 5, "automne", false],
        [1, 15, "hiver", true], [3, 2, "hiver", false]];
      for (const [m, j, cle, enCours] of cas) {
        const r = C.saisonDite(m, j);
        if (r.saison.cle !== cle || r.enCours !== enCours) {
          return `${j}/${m} rend ${r.saison.cle} ${r.enCours}`;
        }
      }
      return "";
    }) === "");

  ok("la saison se compare à la normale de 1991 à 2020",
    /1991 à 2020/.test(lignesClimat[4]?.sous || "")
    && /normale/.test(lignesClimat[5]?.sous || "")
    && /mm$/.test(lignesClimat[5]?.val || ""),
    `${lignesClimat[4]?.sous} | ${lignesClimat[5]?.sous} ${lignesClimat[5]?.val}`);

  /* Une bande par année, du bleu au rouge dans le sens du temps : la charge fait
     monter la température de deux centièmes par an, la dernière année est donc la
     plus chaude de la série. */
  const bandesDit = await pgClimat.evaluate(async e => {
    const attendu = JSON.parse(e);
    const cv = document.getElementById("clToile");
    if (!cv) return "aucune toile de bandes";
    const x = cv.getContext("2d");
    const teinte = (r, g, b) => {
      const [u, v, w] = [r, g, b].map(z => z / 255);
      const mx = Math.max(u, v, w), mn = Math.min(u, v, w), d = mx - mn;
      if (d < 1e-6) return null;
      let h = mx === u ? ((v - w) / d) % 6 : mx === v ? (w - u) / d + 2 : (u - v) / d + 4;
      h *= 60; if (h < 0) h += 360;
      return h;
    };
    const lu = f => {
      const d = x.getImageData(Math.round(cv.width * f), Math.round(cv.height / 2), 1, 1).data;
      return teinte(d[0], d[1], d[2]);
    };
    const g = lu(0.02), dr = lu(0.98);
    if (g === null || dr === null) return "une bande n'est pas peinte";
    /* Le bleu tourne autour de deux cent quatorze degrés de roue, le rouge autour
       de huit : la première année est froide, la dernière chaude. */
    if (Math.abs(g - 214) > 30) return `la première bande n'est pas bleue, teinte ${g.toFixed(0)}`;
    if (Math.abs(dr - 8) > 30) return `la dernière bande n'est pas rouge, teinte ${dr.toFixed(0)}`;
    const ans = [...document.querySelectorAll(".cl-ans span")].map(s => s.textContent);
    if (ans.join(",") !== "1950,2025") return `bornes ${ans.join(",")}`;
    const note = document.querySelector("#clBandes .note").textContent;
    const m = note.match(/de ([\d,]+)°/);
    if (!m) return `note ${note}`;
    const ecrit = Number(m[1].replace(",", "."));
    return Math.abs(ecrit - Math.abs(attendu.montee)) <= 0.1 ? ""
      : `montée écrite ${ecrit}, attendue ${attendu.montee.toFixed(2)}`;
  }, JSON.stringify({ montee: attenduClimat.montee }));
  ok("les bandes vont du bleu au rouge et disent leur montée", bandesDit === "", bandesDit);

  /* La réserve garde l'archive : rouvrir la feuille ne redemande que la série
     récente, laquelle porte l'année en cours et change tous les jours. */
  await pgClimat.evaluate(() => document.getElementById("feuille-fermer").click());
  await pgClimat.waitForTimeout(400);
  const avantReouverture = etat.appelsArchive.length;
  await ouvrirClimat(pgClimat);
  ok("rouvrir la feuille ne redemande pas l'archive longue",
    etat.appelsArchive.length - avantReouverture <= 1
    && !etat.appelsArchive.slice(avantReouverture).some(u => u.includes("1950-01-01")),
    etat.appelsArchive.slice(avantReouverture).join(" | "));

  ok("la réserve ne garde pas plus de six communes",
    await pgClimat.evaluate(async () => {
      const C = await import("/src/climat.js");
      for (let k = 0; k < 9; k++) C.poser(`4${k}.00,3.00`, { v: 1, blocs: [], annees: [] }, 2025);
      const n = Object.keys(JSON.parse(localStorage.getItem("mameteo.climat.v1"))).length;
      return n <= C.COMMUNES_GARDEES ? "" : `${n} communes gardées`;
    }) === "");
  await ctxClimat.close();

  /* Sans archive, la feuille le dit et ne montre aucune section vide. */
  etat.archiveMuette = true;
  etat.appelsArchive.length = 0;
  const [ctxSansArchive, pgSansArchive] = await ctxReponse(METEO_NUE);
  await pgSansArchive.locator('[data-feuille="climat"]').click();
  await reposer(pgSansArchive, 2250);
  ok("sans archive, la feuille le dit et ne montre pas de section vide",
    await pgSansArchive.evaluate(() => {
      const t = document.getElementById("feuille-corps").innerText;
      if (!/besoin du réseau/.test(t)) return `corps « ${t.slice(0, 60)} »`;
      const vus = ["clRecords", "clSaison", "clBandes"].filter(i => !document.getElementById(i).hidden);
      return vus.length ? `sections montrées : ${vus.join(", ")}` : "";
    }) === "");
  await ctxSansArchive.close();
  etat.archiveMuette = false;
};
