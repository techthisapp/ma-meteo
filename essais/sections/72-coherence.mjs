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
  etat.profilPluie = "debut";
  const [c3, p3] = await ctxReponse(() => METEO_NUE(), { ...FAIN, accueilcompact: true });
  await reposer(p3, 2500);
  const lire = () => p3.evaluate(() => {
    const d = document.querySelector("#ecran details.compact-plus");
    const vu = sel => [...document.querySelectorAll(sel)].some(x => x.checkVisibility());
    /* Version 208 : les mesures en petit, visibles repliées, et le bouton
       qui dit ce qu'il agrandit. */
    return { resume: d?.querySelector("summary")?.getAttribute("aria-label") || "", ouvert: d?.open ?? null,
      mini: vu("#ecran .mini-mesures .mm-c") ? document.querySelectorAll("#ecran .mini-mesures .mm-c").length : 0,
      bouton: [...(d?.querySelectorAll(".mm-plus > span") || [])].filter(x => x.checkVisibility()).map(x => x.textContent).join(""),
      tuiles: vu("#ecran .tuile"), demain: vu('#ecran [data-bloc="suite"]'), bande: vu("#ecran #bande"),
      portes: vu("#ecran .porte"), dansPli: !!d?.querySelector(".tuiles") && !!d?.querySelector('[data-bloc="suite"]') };
  });
  /* Version 205 : la pluie de l'heure sans sa phrase ni sa légende, la
     phrase de la bande tue, les portes en une liste d'une colonne. */
  const resserre = await p3.evaluate(() => {
    const vu = sel => [...document.querySelectorAll(sel)].some(x => x.checkVisibility());
    const portes = [...document.querySelectorAll("#ecran .portes .porte")].map(x => Math.round(x.getBoundingClientRect().left));
    return { pluie: vu("#ecran .pp-c"), phrase: vu("#ecran .bande-phrase"), legende: vu("#ecran .pp-legende"), sous: vu("#ecran .pp-sous"),
      colonnes: new Set(portes).size, n: portes.length };
  });
  ok("l'accueil compact resserre la pluie de l'heure, tait la phrase de la bande et range les portes en liste",
    resserre.pluie && !resserre.phrase && !resserre.legende && !resserre.sous && resserre.n >= 3 && resserre.colonnes === 1, JSON.stringify(resserre));
  const replie = await lire();
  await p3.locator("#ecran details.compact-plus > summary").click();
  const deplie = await lire();
  ok("l'accueil compact montre les mesures en petit, et un appui les agrandit en tuiles avec les conseils de demain",
    replie.resume === "Agrandir les mesures du jour et demain" && replie.ouvert === false && !replie.tuiles && !replie.demain
    && replie.mini >= 6 && replie.bouton === "Mesures du jour et demain"
    && replie.bande && replie.portes && replie.dansPli && deplie.tuiles && deplie.demain && deplie.mini === 0 && deplie.bouton === "Réduire",
    JSON.stringify({ replie, deplie }));
  /* Version 209 : l'accueil en plein ciel. Les cartes sont de verre sombre,
     le titre se réduit au défilement et la barre de tête prend la
     température en petit. */
  const verre = await p3.evaluate(async () => {
    /* La page part du haut : un contrôle précédent a pu la laisser défilée. */
    window.scrollTo({ top: 0, behavior: "instant" });
    await new Promise(z => setTimeout(z, 300));
    const c = document.querySelector("#ecran .ecran-corps .carte");
    const st = getComputedStyle(c);
    const flou = (st.backdropFilter || st.webkitBackdropFilter || "none") !== "none";
    const vu = el => Number(getComputedStyle(el).opacity);
    const t = document.querySelector(".plein-titre");
    /* Version 223 : l'en-tête au centre, le lieu en grand ; au repos, le
       grand titre entier et sans date, la ligne courte cachée. */
    const lieu = document.getElementById("ecLieu").getBoundingClientRect();
    const r = { flou, fond: st.backgroundColor, bord: st.borderTopWidth,
      centre: Math.round(lieu.left + lieu.width / 2 - window.innerWidth / 2),
      date: getComputedStyle(t.querySelector(":scope > i")).display,
      ligneRepos: vu(document.getElementById("ecLigne")), titreRepos: vu(t.querySelector(".bd-deg")),
      bouton: (() => { const n = document.getElementById("navLieu").getBoundingClientRect();
        return n.left <= lieu.left + 4 && n.right >= lieu.right - 4 && n.top <= lieu.top + 2 && n.bottom >= lieu.bottom - 2; })() };
    /* Version 224 : à mi-course, aucune ligne encore visible du grand titre
       ne passe sous l'en-tête, ligne courte comprise. */
    r.chevauche = [];
    for (const y of [80, 140, 200, 260]) {
      window.scrollTo({ top: y, behavior: "instant" });
      await new Promise(z => setTimeout(z, 250));
      const l = document.getElementById("ecLigne");
      const bas = (vu(l) > 0.05 ? l : document.getElementById("ecLieu")).getBoundingClientRect().bottom;
      for (const e of t.querySelectorAll(".bd-deg, .bd-etat > *, .pt-rep")) {
        if (vu(e) > 0.05 && e.getBoundingClientRect().top < bas) r.chevauche.push(`${y}:${e.className}`);
      }
    }
    window.scrollTo({ top: 400, behavior: "instant" });
    await new Promise(z => setTimeout(z, 300));
    /* Au défilement : le lieu reste, la ligne courte paraît, le grand titre
       s'efface, les blocs passent dessous en fondu. */
    const lieu2 = document.getElementById("ecLieu").getBoundingClientRect();
    Object.assign(r, { lieuFixe: Math.abs(lieu2.top - lieu.top) < 1, ligne: document.getElementById("ecLigne").textContent,
      ligneVue: vu(document.getElementById("ecLigne")), titreCache: vu(t.querySelector(".bd-deg")),
      fondu: /transparent/.test(document.querySelector("#ecran .ecran-corps").style.maskImage || document.querySelector("#ecran .ecran-corps").style.webkitMaskImage || "") });
    window.scrollTo({ top: 0, behavior: "instant" });
    await new Promise(z => setTimeout(z, 200));
    return r;
  });
  /* Version 210, recette contre la maquette : la barre d'onglets en verre
     sombre, les étiquettes des cartes en petites capitales. */
  const recette = await p3.evaluate(() => {
    const o = getComputedStyle(document.querySelector(".onglets")).backgroundColor;
    const e = document.querySelector("#ecran .pp-etiq, #ecran .bande-tete h3");
    const court = document.querySelector("#ecran .bande-court");
    return { onglets: o, etiquette: e ? getComputedStyle(e).textTransform : "", court: court && court.checkVisibility() ? court.textContent : "" };
  });
  ok("la recette du plein ciel suit la maquette : barre d'onglets teintée du ciel, étiquettes en petites capitales",
    /0\.62\)$/.test(recette.onglets) && recette.etiquette === "uppercase" && recette.court === "Prochaines heures",
    JSON.stringify(recette));
  ok("l'accueil en plein ciel porte des blocs teintés du ciel, sans bord, et un en-tête au lieu centré qui se réduit en une ligne au défilement",
    verre.flou && /^rgba\(\d+, \d+, \d+, 0\.56\)$/.test(verre.fond) && verre.bord === "0px" && Math.abs(verre.centre) <= 8
    && verre.date === "none" && verre.ligneRepos === 0 && verre.titreRepos === 1 && verre.bouton
    && verre.lieuFixe && /^\d+° \| \S/.test(verre.ligne) && verre.ligneVue === 1 && verre.titreCache === 0 && verre.fondu
    && verre.chevauche.length === 0,
    JSON.stringify(verre));

  /* Version 227 : « À venir » au format de l'accueil. Le même ciel fixe,
     l'en-tête réduit d'emblée, la liste sous lui, les blocs teintés, les
     journées séparées par un simple filet. */
  await p3.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await p3.locator('[data-onglet="semaine"]').click();
  await p3.waitForTimeout(800);
  const avenir = await p3.evaluate(() => {
    const e = document.getElementById("ecran");
    const ligne = document.getElementById("ecLigne");
    const carte = e.querySelector(".ecran-corps .carte");
    const we = e.querySelector(".sem-j.sem-we");
    return { ciel: e.classList.contains("ecran-ciel") && !!e.querySelector(".plein-accueil #ciTemps"),
      ligne: ligne.textContent, ligneVue: Number(getComputedStyle(ligne).opacity),
      sous: carte ? Math.round(carte.getBoundingClientRect().top - ligne.getBoundingClientRect().bottom) : null,
      fond: carte ? getComputedStyle(carte).backgroundColor : "",
      jour: we ? getComputedStyle(we).backgroundColor : "aucun" };
  });
  ok("« À venir » prend le format de l'accueil : ciel fixe, en-tête réduit, blocs teintés, journées sans fond",
    avenir.ciel && /^\d+° \| \S/.test(avenir.ligne) && avenir.ligneVue === 1 && avenir.sous >= 4
    && /^rgba\(\d+, \d+, \d+, 0\.56\)$/.test(avenir.fond) && /rgba\(0, 0, 0, 0\)|aucun/.test(avenir.jour),
    JSON.stringify(avenir));
  await p3.locator('[data-onglet="accueil"]').click();
  await p3.waitForTimeout(500);

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
  etat.profilPluie = "sec";
};
