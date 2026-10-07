/* Le temps passé sur la carte. Section écrite le 7 octobre 2026, version
   179, pour la pluie des 48 et des 72 heures, reprise en version 180 pour
   toutes les nappes du passé et leur curseur de période. Elle part d'un état
   neuf préparé par essais/banc.mjs ; les grilles fabriquées sont décrites
   dans `passeeCorps` et `passeeJoursCorps` des faux services. */
import { FAIN } from "../faux-services.mjs";

export const titre = "Le temps passé";
export const avecPage = false;

export default async T => {
  const { ok, etat, ouvrirCarte, reposer } = T;
  const [, p] = await ouvrirCarte({ ...FAIN, pluiecarte: false, foudrecarte: false, vigicarte: false }, 0, { sansFond: true });
  await reposer(p, 1500);

  /* La lecture des heures : cumuls, plus forte rafale, extrêmes de
     température, sur une série écrite à la main ; une heure manquante ne
     compte pas, un point sans valeur reste vide. */
  const lu = await p.evaluate(async () => {
    const P = await import("/src/passe.js");
    const N = await import("/src/nappe.js");
    const n = N.COLS * N.RANGS;
    const time = Array.from({ length: 72 }, (_, k) => k * 3600);
    const d = Array.from({ length: n }, (_, i) => ({ hourly: { time,
      precipitation: i === 1 ? time.map(() => null) : time.map((_, k) => (k === 10 ? null : k < 24 ? 2 : 1)),
      snowfall: time.map((_, k) => (k >= 60 ? 0.5 : 0)),
      wind_gusts_10m: time.map((_, k) => (k === 5 ? 99 : k === 40 ? 70 : 20)),
      temperature_2m: time.map((_, k) => k - 30) } }));
    const h48 = P.lireHeures(d, 2), h72 = P.lireHeures(d, 3), h24 = P.lireHeures(d, 1);
    const u = new URL(P.adresseHeures());
    return { p48: h48.pluie[0], p72: h72.pluie[0], vide: Number.isNaN(h72.pluie[1]),
      neige24: h24.neige[0], raf48: h48.rafales[0], raf72: h72.rafales[0],
      chaud: h24.chaud[0], froid: h24.froid[0],
      requete: [u.searchParams.get("past_hours"), u.searchParams.get("forecast_hours"), u.searchParams.get("hourly")].join(",") };
  });
  ok("les heures donnent cumuls, plus forte rafale et extrêmes sur 24, 48 et 72 heures",
    lu.p48 === 48 && lu.p72 === 94 && lu.vide && lu.neige24 === 6 && lu.raf48 === 70 && lu.raf72 === 99
    && lu.chaud === 41 && lu.froid === 18
    && lu.requete === "72,0,precipitation,snowfall,wind_gusts_10m,temperature_2m", JSON.stringify(lu));

  /* La lecture des jours : 110 points, le jour présent laissé de côté,
     l'étalement exact sur les points de la grille lâche et entre eux. */
  const lj = await p.evaluate(async () => {
    const P = await import("/src/passe.js");
    const nl = P.RANGS_L.length * P.COLS_L.length;
    const time = Array.from({ length: 61 }, (_, k) => k * 86400);
    const d = Array.from({ length: nl }, (_, i) => ({ daily: { time,
      precipitation_sum: time.map((_, k) => (k === 60 ? 100 : i % P.COLS_L.length)),
      snowfall_sum: time.map(() => 0), wind_gusts_10m_max: time.map(() => 30),
      temperature_2m_max: time.map((_, k) => (k === 60 ? 50 : 20 + k % 3)), temperature_2m_min: time.map(() => 5) } }));
    const g = P.lireJours(d, 7);
    const u = new URL(P.adresseJours());
    return { n: nl, rangs: P.RANGS_L.join(","), cols: P.COLS_L.join(","), a0: g.pluie[0], a2: g.pluie[2], a1: g.pluie[1], fin: g.pluie[(await import("/src/nappe.js")).COLS - 1], chaud: g.chaud[0],
      requete: [u.searchParams.get("past_days"), u.searchParams.get("forecast_days"), u.searchParams.get("latitude").split(",").length].join(",") };
  });
  ok("les jours se lisent sur 110 points jusqu'à la veille et s'étalent sur la grille",
    lj.n === 110 && lj.rangs === "0,2,4,6,8,11,13,15,17,19" && lj.cols === "0,2,4,6,8,10,12,14,16,18,20" && lj.a0 === 0 && lj.a2 === 7 && Math.abs(lj.a1 - 3.5) < 1e-6 && lj.fin === 70 && lj.chaud === 22
    && lj.requete === "60,1,110", JSON.stringify(lj));

  /* Les quatre nappes au panneau, chacune dans sa famille. */
  const tuiles = await p.evaluate(() => ["caPluiePassee", "caNeigePassee", "caRafalesPassees", "caTempPassee"].map(id => {
    const b = document.getElementById(id);
    return b ? `${b.closest(".ca-fam")?.getAttribute("aria-label")}:${b.querySelector("span")?.textContent}` : null;
  }));
  ok("le panneau porte la pluie, la neige, les rafales et les extrêmes passés, chacun dans sa famille",
    tuiles.join(" | ") === "Eau:Pluie passée | Neige et montagne:Neige passée | Vent et pression:Rafales passées | Températures:Extrêmes",
    tuiles.join(" | "));

  const choisir = async id => {
    await p.locator("#caCouches").click();
    await p.waitForTimeout(150);
    await p.locator(`#${id}`).click();
    await p.locator("#caCouches").click();
    await reposer(p, 1500);
  };
  const regarder = () => p.evaluate(async () => {
    const C = await import("/src/carte.js");
    const peinte = C.derniereNappe.valeurA;
    const v = (la, lo) => (peinte ? Math.round(peinte(la, lo)) : null);
    return { titre: document.getElementById("caLegTitre").textContent,
      curseur: document.getElementById("caPeriode").hidden ? null : document.getElementById("caPerVal").textContent,
      grads: document.getElementById("caGrads").textContent,
      provence: v(43.8, 5.8), bretagne: v(48.2, -3), alpes: v(45.4, 6.4),
      replie: document.getElementById("caLegendes").classList.contains("replie"),
      garde: JSON.parse(localStorage.getItem("mameteo.reglages.v1") || "{}").periodepasse ?? null };
  });
  const glisser = async (v, id = "caPerCurseur") => {
    await p.locator(`#${id}`).fill(String(v));
    await reposer(p, 1500);
  };

  await choisir("caPluiePassee");
  const a = await regarder();
  ok("la pluie passée s'ouvre sur 48 heures, curseur sous l'échelle, d'une seule requête",
    etat.appelsPassee.length === 1 && a.titre === "Pluie tombée, 48 h (mm)" && a.curseur === "48 h"
    && a.provence === 24 && a.bretagne === 0, JSON.stringify({ appels: etat.appelsPassee.length, ...a }));

  await p.locator("#caPerVal").click();
  const replieParAppui = await p.evaluate(() => document.getElementById("caLegendes").classList.contains("replie"));
  if (replieParAppui) await p.locator("#caLegendes").click();
  await glisser(2);
  const b = { ...await regarder(), replieParAppui };
  ok("le curseur passé à 72 heures relit la même grille sans requête et ne replie pas la légende",
    etat.appelsPassee.length === 1 && b.titre === "Pluie tombée, 72 h (mm)" && b.curseur === "72 h"
    && b.bretagne === 24 && b.provence === 24 && !b.replie && !b.replieParAppui, JSON.stringify({ appels: etat.appelsPassee.length, ...b }));

  await glisser(3);
  const c = await regarder();
  ok("à une semaine, les jours se lisent d'une requête, sans le jour présent, et la période se garde",
    etat.appelsPasseeJours.length === 1 && c.titre === "Pluie tombée, 7 jours (mm)" && c.provence === 14
    && c.bretagne === 0 && c.garde === "7j", JSON.stringify({ appels: etat.appelsPasseeJours.length, ...c }));

  await glisser(5);
  const d = await regarder();
  ok("à 30 jours, la même lecture des jours sert, l'échelle s'élargit",
    etat.appelsPasseeJours.length === 1 && d.titre === "Pluie tombée, 30 jours (mm)" && d.bretagne === 115 && d.grads === "53080150300"
    && d.provence === 14, JSON.stringify({ appels: etat.appelsPasseeJours.length, ...d }));

  /* Un curseur glissé de deux mois à un jour sans attendre : la réponse
     longue, arrivée en dernier, ne prend pas la place du jour. */
  etat.retardPasseeJours = 800;
  await p.evaluate(async () => {
    const P = await import("/src/passe.js");
    P.oublier();
    const el = document.getElementById("caPerCurseur");
    for (const v of ["6", "0"]) { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); }
  });
  await p.waitForTimeout(1200);
  await reposer(p, 2000);
  etat.retardPasseeJours = 0;
  const e = { ...await regarder(), resume: await p.evaluate(() => document.getElementById("caResume").textContent) };
  ok("un curseur glissé vite garde la dernière période choisie",
    e.titre === "Pluie tombée, 24 h (mm)" && e.provence === 12 && e.bretagne === 0
    && e.resume.startsWith("Nappe pluie tombée, 24 h, 0 mm au lieu courant."), JSON.stringify(e));

  await choisir("caNeigePassee");
  const f = await regarder();
  ok("la neige passée suit la même période", f.titre === "Neige tombée, 24 h (cm)" && f.alpes === 5, JSON.stringify(f));

  await glisser(1);
  await choisir("caRafalesPassees");
  const g = await regarder();
  ok("les rafales passées donnent la plus forte de la période",
    g.titre === "Plus fortes rafales, 48 h (km/h)" && g.bretagne === 30 && g.provence === 30, JSON.stringify(g));
  await glisser(2);
  const g2 = await regarder();
  ok("la rafale d'il y a 60 heures entre à 72 heures", g2.bretagne === 95, JSON.stringify(g2));

  await choisir("caTempPassee");
  const h = await regarder();
  await p.locator('#caExtreme button[data-extreme="froid"]').click();
  await reposer(p, 1000);
  const i = await regarder();
  const boutons = await p.evaluate(() => [...document.querySelectorAll("#caExtreme button")].map(x => x.getAttribute("aria-checked")).join(","));
  ok("les extrêmes passent du plus haut au plus bas d'un appui, sans replier la légende",
    h.titre === "Plus haute température, 72 h" && i.titre === "Plus basse température, 72 h" && i.provence < h.provence
    && boutons === "false,true" && !i.replie, JSON.stringify({ h, i, boutons }));

  /* L'ancien choix de la version 179 se reprend avec sa durée. */
  const [, q] = await ouvrirCarte({ ...FAIN, pluiecarte: false, foudrecarte: false, vigicarte: false, nappe: "pluie72" }, 0, { sansFond: true });
  await reposer(q, 1500);
  const repris = await q.evaluate(() => ({
    coche: document.getElementById("caPluiePassee").getAttribute("aria-checked"),
    titre: document.getElementById("caLegTitre").textContent }));
  ok("la pluie des 72 heures choisie en version 179 revient en pluie passée sur 72 heures",
    repris.coche === "true" && repris.titre === "Pluie tombée, 72 h (mm)", JSON.stringify(repris));
};
