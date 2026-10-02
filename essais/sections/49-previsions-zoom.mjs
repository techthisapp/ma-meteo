/* Les prévisions des villes selon le zoom. Section écrite le 3 octobre 2026
   pour le jalon 19, lot 3 ; elle part d'un état neuf préparé par
   essais/banc.mjs. */
import { FAIN } from "../faux-services.mjs";

export const titre = "Les prévisions selon le zoom";
export const avecPage = false;

export default async T => {
  const { ok, etat, ouvrirCarte, reposer } = T;
  const [, p] = await ouvrirCarte({ ...FAIN, previcarte: true, pluiecarte: false, foudrecarte: false, vigicarte: false }, 0);
  await p.evaluate(async () => (await import("/src/fond.js")).charger());
  await reposer(p, 2500);
  await p.waitForTimeout(800);
  await reposer(p, 1500);

  /* Les étiquettes visibles : leur ville, sa population d'après le fond, le
     nom écrit, et les chevauchements. */
  const lire = () => p.evaluate(async () => {
    const F = await import("/src/fond.js");
    const v = F.villesChargees() || [];
    const vis = [...document.querySelectorAll(".ca-pv-ville:not([hidden])")];
    const r = vis.map(e => e.getBoundingClientRect());
    let heurts = 0;
    for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++)
      if (r[i].left < r[j].right && r[j].left < r[i].right && r[i].top < r[j].bottom && r[j].top < r[i].bottom) heurts++;
    const noms = vis.map(e => e.dataset.ville);
    const dits = F.derniersNoms().poses.filter(x => x.type === "ville").map(x => x.nom);
    return { n: vis.length, heurts, villes: noms.map(n => [n, v.find(x => x.nom === n)?.pop || 0]),
      nommees: vis.every(e => e.querySelector("small")?.textContent === e.dataset.ville),
      doubles: dits.filter(n => noms.includes(n)) };
  });
  const pays = await lire();
  ok("sur le pays entier, les grandes villes portent leur prévision et leur nom, sans chevauchement",
    pays.n >= 8 && pays.heurts === 0 && pays.nommees && pays.villes.every(([, pop]) => pop >= 50000)
    && pays.doubles.length === 0, JSON.stringify(pays));

  /* Au zoom d'un département, autour de Fain : plus d'étiquettes, de plus
     petites villes. */
  await p.locator("#caIci").click();
  await reposer(p, 1500);
  await p.waitForTimeout(800);
  await reposer(p, 1500);
  const pres = await lire();
  ok("au zoom d'un département, les prévisions gagnent les petites villes, sans chevauchement",
    pres.n >= 12 && pres.n <= 30 && pres.heurts === 0 && pres.nommees
    && pres.villes.some(([, pop]) => pop > 0 && pop < 15000) && pres.doubles.length === 0,
    JSON.stringify({ n: pres.n, heurts: pres.heurts, villes: pres.villes.slice(0, 8), doubles: pres.doubles }));

  /* Le retour au pays entier ne redemande rien : chaque ville se garde une
     heure, et une requête ne porte que les villes qui manquent. */
  await p.locator('[data-onglet="carte"]').click();
  await reposer(p, 1500);
  await p.waitForTimeout(800);
  await reposer(p, 1000);
  const lats = etat.appelsVilles.map(u => new URL(u).searchParams.get("latitude").split(",")
    .map((la, i) => `${la},${new URL(u).searchParams.get("longitude").split(",")[i]}`));
  const toutes = lats.flat();
  ok("une ville n'est demandée qu'une fois, et une requête porte cinquante villes au plus",
    etat.appelsVilles.length >= 2 && new Set(toutes).size === toutes.length && lats.every(l => l.length <= 50),
    JSON.stringify({ appels: lats.map(l => l.length), doublons: toutes.length - new Set(toutes).size }));
};
