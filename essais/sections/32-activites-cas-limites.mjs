/* Les activités, cas limites. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */
import { METEO } from "../faux-services.mjs";

export const titre = "Les activités, cas limites";
export const avecPage = true;

export default async T => {
  const { ok, txt, ctxReponse } = T;
  const meteoAct = patch => () => {
    const d = JSON.parse(JSON.stringify(METEO));
    patch(d);
    return d;
  };

  const ouvrirActivites = async p => {
    await p.locator('[data-feuille="activites"]').click();
    await p.waitForTimeout(500);
    return p.evaluate(() =>
      [...document.querySelectorAll("#feuille-corps .rangee")].map(r => ({
        nom: r.querySelector(".rangee-txt b").textContent,
        quand: r.querySelector(".rangee-val b").textContent,
        detail: r.querySelector(".rangee-txt span").textContent,
        sans: r.classList.contains("act-sans"),
      })));
  };

  /* Une charge entièrement mouillée. Une activité sans créneau favorable le dit et
     ne propose rien : rendre le premier créneau à défaut ferait conseiller de
     courir sous la pluie. */
  const [ctxTrempe, pgTrempe] = await ctxReponse(meteoAct(d => {
    d.hourly.precipitation = d.hourly.precipitation.map(() => 1.5);
    d.hourly.precipitation_probability = d.hourly.precipitation_probability.map(() => 95);
  }));
  const trempe = await ouvrirActivites(pgTrempe);
  ok("sans créneau favorable, chaque activité le dit et ne propose rien",
    trempe.filter(a => a.nom !== "Arroser").every(a =>
      a.quand === "Aucun créneau" && a.sans && a.detail.length > 10),
    JSON.stringify(trempe.map(a => [a.nom, a.quand])));
  /* L'arrosage a besoin d'une soirée sèche. N'en trouver aucune sur deux journées
     veut dire qu'il pleut, et le jardin est alors arrosé. */
  ok("sous la pluie, l'arrosage dit que la pluie s'en charge",
    trempe.find(a => a.nom === "Arroser").quand === "La pluie s'en charge",
    trempe.find(a => a.nom === "Arroser").quand);
  ok("et chacune dit pourquoi, non seulement qu'il n'y en a pas",
    trempe.filter(a => a.quand === "Aucun créneau").every(a => /pluie|mouill|vent|sèche|intérieur/i.test(a.detail)),
    JSON.stringify(trempe.filter(a => a.quand === "Aucun créneau").map(a => a.detail)));
  await ctxTrempe.close();

  /* Le lavage attend que douze heures sèches le suivent. Une matinée sèche
     suivie d'une averse de l'après-midi ne convient pas : la première averse
     défait le travail, et c'est la seule condition de cette activité. */
  const [ctxAverse, pgAverse] = await ctxReponse(meteoAct(d => {
    for (let k = 0; k < d.hourly.time.length; k++) {
      if (/^2026-08-18T1[5-7]/.test(d.hourly.time[k])) d.hourly.precipitation[k] = 1.5;
    }
  }));
  const averse = await ouvrirActivites(pgAverse);
  /* La charge d'essai porte aussi une pluie de nuit le 19 août, de trois à cinq
     heures : le premier lavage possible tombe donc après elle, au matin suivant. */
  ok("une averse de l'après-midi repousse le lavage au delà d'elle",
    averse.find(a => a.nom === "Laver la voiture").quand === "demain 07 h à 21 h",
    averse.find(a => a.nom === "Laver la voiture").quand);
  await ctxAverse.close();

  /* Le bilan d'arrosage suit l'évapotranspiration et la pluie, non la pluie
     seule. Les deux contextes ne diffèrent que par l'évapotranspiration : même
     pluie tombée, deux verdicts contraires. */
  const arrosageDe = async et0 => {
    const [c, p] = await ctxReponse(meteoAct(d => {
      d.daily.et0_fao_evapotranspiration = d.daily.et0_fao_evapotranspiration.map(() => et0);
    }));
    const l = await ouvrirActivites(p);
    await c.close();
    return l.find(a => a.nom === "Arroser");
  };
  const sec7 = await arrosageDe(3.5);
  const humide7 = await arrosageDe(0.1);
  ok("un sol qui a beaucoup évaporé demande un arrosage",
    sec7.quand !== "Pas nécessaire" && /déficit/.test(sec7.detail),
    `${sec7.quand} | ${sec7.detail}`);
  ok("le même cumul de pluie, sans évaporation, n'en demande pas",
    humide7.quand === "Pas nécessaire" && /excédent/.test(humide7.detail),
    `${humide7.quand} | ${humide7.detail}`);

  /* ---------- Où est le beau temps ---------- */
};
