/* La cohérence des chiffres de l'accueil et l'accueil compact, version 199,
   audit d'usage du 13 octobre 2026. Section écrite le 13 octobre 2026 ; elle part d'un état
   neuf préparé par essais/banc.mjs. */
import { FAIN } from "../faux-services.mjs";

export const titre = "La cohérence des chiffres";
export const avecPage = false;

export default async T => {
  const { etat, ok, ctxReponse, METEO_NUE, reposer } = T;
  const tuile = (p, nom) => p.evaluate(n => {
    const t = [...document.querySelectorAll("#ecran .tuile")].find(b => b.querySelector("i")?.textContent === n);
    return t ? `${t.querySelector("b").textContent.replace(/\s+/g, " ")} | ${t.querySelector("em").textContent.replace(/\s+/g, " ")}` : "absente";
  }, nom);
  const ciel = p => p.evaluate(() => ({ heros: document.querySelector(".bd-ciel")?.textContent || "",
    maint: document.querySelector(".bh-maint")?.getAttribute("aria-label") || "" }));

  /* Une averse qui commence dans vingt minutes : la tuile la dit, le ciel du
     moment reste le sien. */
  etat.profilPluie = "debut";
  const [c1, p1] = await ctxReponse(() => METEO_NUE());
  await reposer(p1, 2500);
  const debut = { tuile: await tuile(p1, "Pluie"), ...(await ciel(p1)) };
  ok("une pluie annoncée dans l'heure se dit dans la tuile de la pluie, sans changer le ciel du moment",
    debut.tuile === "09 h 20 | pluie modérée annoncée" && !/pluie/i.test(debut.heros) && !/pluie/i.test(debut.maint.split(",")[1] || ""),
    JSON.stringify(debut));

  /* La même liste des lieux que l'accueil : la température et les bornes du
     lieu affiché sont celles du grand chiffre. */
  await p1.locator("#navLieu").click();
  await reposer(p1, 1500);
  const lieux = await p1.evaluate(() => {
    const r = document.querySelector('.co-l[aria-current="true"]');
    return { deg: r?.querySelector("[data-deg]")?.textContent || "", bornes: r?.querySelector("[data-bornes]")?.textContent || "",
      heros: document.querySelector(".bd-deg")?.textContent.replace(/\s+/g, "") || "",
      jour: document.querySelector(".bd-bornes")?.textContent.replace(/ aujourd'hui$/, "") || "" };
  });
  ok("la liste des lieux reprend la température et les bornes de l'accueil pour le lieu affiché",
    lieux.deg === lieux.heros && lieux.deg !== "" && lieux.bornes.endsWith(lieux.jour) && lieux.jour !== "",
    JSON.stringify(lieux));
  await c1.close();

  /* Une averse en cours : le ciel du moment, la colonne « Maint. » et la
     tuile la disent. */
  etat.profilPluie = "encours";
  const [c2, p2] = await ctxReponse(() => METEO_NUE());
  await reposer(p2, 2500);
  const encours = { tuile: await tuile(p2, "Pluie"), ...(await ciel(p2)) };
  ok("une pluie en cours se dit dans le ciel du moment, la colonne « Maint. » et la tuile",
    encours.tuile === "En cours | pluie faible maintenant" && /pluie/i.test(encours.heros) && /pluie/i.test(encours.maint.split(",")[1] || ""),
    JSON.stringify(encours));

  /* La tuile du ciel porte sa valeur ; la porte de l'air porte le pollen à
     côté de sa jauge. */
  const autres = await p2.evaluate(() => {
    const a = document.querySelector('[data-info="air"]');
    const pol = a?.querySelector("[data-pollen-porte]");
    return { pol: pol ? `${pol.textContent} ${pol.className}` : "", txt: a?.querySelector(".porte-txt")?.textContent || "" };
  });
  const tuileCiel = await tuile(p2, "Ciel");
  ok("la tuile du ciel porte sa couverture, la porte de l'air son pollen en pastille",
    /^\d+ % \| de nuages au plus$/.test(tuileCiel)
    && /^\S+ (au pic pastille ton-pic|en saison pastille ton-saison)$/.test(autres.pol) && /^Air [a-zé ]+$/.test(autres.txt),
    JSON.stringify({ tuileCiel, ...autres }));
  await c2.close();
  etat.profilPluie = "sec";

  /* L'accueil compact, version 199 : les tuiles et les conseils de demain
     se replient derrière un bouton, l'essentiel reste. */
  const [c3, p3] = await ctxReponse(() => METEO_NUE(), { ...FAIN, accueilcompact: true });
  await reposer(p3, 2500);
  const lire = () => p3.evaluate(() => {
    const d = document.querySelector("#ecran details.compact-plus");
    const vu = sel => [...document.querySelectorAll(sel)].some(x => x.checkVisibility());
    return { resume: d?.querySelector("summary")?.textContent || "", ouvert: d?.open ?? null,
      tuiles: vu("#ecran .tuile"), demain: vu('#ecran [data-bloc="suite"]'), bande: vu("#ecran #bande"),
      portes: vu("#ecran .porte"), dansPli: !!d?.querySelector(".tuiles") && !!d?.querySelector('[data-bloc="suite"]') };
  });
  const replie = await lire();
  await p3.locator("#ecran details.compact-plus > summary").click();
  const deplie = await lire();
  ok("l'accueil compact replie les tuiles et les conseils de demain derrière un bouton, et garde l'essentiel",
    replie.resume === "Mesures du jour et demain" && replie.ouvert === false && !replie.tuiles && !replie.demain
    && replie.bande && replie.portes && replie.dansPli && deplie.tuiles && deplie.demain,
    JSON.stringify({ replie, deplie }));

  /* Le réglage se fait dans la carte « Accueil » des réglages, et l'accueil
     se refait aussitôt. */
  await p3.locator("#btnReglages").click();
  await p3.waitForTimeout(600);
  await p3.locator('[data-presentation="complet"]').click();
  await p3.waitForTimeout(500);
  const complet = await p3.evaluate(() => ({ pli: !!document.querySelector("#ecran details.compact-plus"),
    tuiles: !!document.querySelector("#ecran .tuile"),
    garde: JSON.parse(localStorage.getItem("mameteo.reglages.v1") || "{}").accueilcompact,
    actif: document.querySelector("[data-presentation].actif")?.dataset.presentation }));
  ok("la présentation de l'accueil se choisit dans les réglages et se garde",
    !complet.pli && complet.tuiles && complet.garde === false && complet.actif === "complet", JSON.stringify(complet));
  await c3.close();
};
