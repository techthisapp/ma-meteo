/* Les scénarios. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */
import { METEO, ENSEMBLE, FAIN, amorce } from "../faux-services.mjs";

export const titre = "Les scénarios";
export const avecPage = true;

export default async T => {
  const { nav, ok, brancherRoutes, ouvrirPage, ouvrirLeTemps, phrasesConseils,
    onglet, reposer } = T;
  /* La marge d'une prévision. La source rend quarante scénarios sous un autre
     point d'entrée : leur dispersion est la marge, et elle s'élargit avec
     l'échéance. La charge d'essai la reproduit, d'une demi-largeur qui vaut
     `0,5 + L / 20` à l'heure `L` après maintenant, plafonnée à six. */
  const ctxSc = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await ctxSc.addInitScript(amorce(FAIN));
  await brancherRoutes(ctxSc);
  const pgSc = await ctxSc.newPage();
  const appelsScPage = [];
  pgSc.on("request", r => {
    if (r.url().startsWith("https://ensemble-api.open-meteo.com")) appelsScPage.push(r.url());
  });
  await ouvrirPage(pgSc);
  await reposer(pgSc, 2700);

  /* La requête. Un modèle, sept jours, deux grandeurs, et la seule commune
     affichée : l'aperçu des lieux suivis n'en demande pas, la charge d'ensemble
     étant cinq fois celle d'une prévision.

     Trois heures de garde. L'ensemble tourne toutes les trois heures et sa
     dispersion bouge lentement : la relire à chaque heure comme la prévision
     déterministe coûterait quatre fois la bande passante pour la même marge. Une
     seconde ouverture ne redemande donc rien. */
  /* Depuis le jalon 13, deux requêtes : les scénarios horaires d'ICON, pour le
     ruban, et les scénarios quotidiens des deux modèles, pour la confiance de La
     semaine, demandés ensemble en une seule. Chacune une seule fois. */
  const horairesSc = () => appelsScPage.filter(u => /[?&]hourly=/.test(u));
  const quotidiensSc = () => appelsScPage.filter(u => /[?&]daily=/.test(u));
  ok("les scénarios sont demandés une seule fois, pour la commune affichée",
    horairesSc().length === 1 && quotidiensSc().length === 1 && appelsScPage.length === 2,
    `${horairesSc().length} horaire, ${quotidiensSc().length} quotidienne, ${appelsScPage.length} en tout`);
  const uSc = horairesSc()[0] || "";
  const uScJ = quotidiensSc()[0] || "";
  ok("les deux modèles se demandent ensemble, sur quinze jours",
    uScJ.includes("models=icon_seamless,ecmwf_ifs025") && uScJ.includes("forecast_days=15")
    && uScJ.includes("daily=temperature_2m_max"), uScJ);
  await pgSc.reload({ waitUntil: "networkidle" });
  await reposer(pgSc, 2250);
  ok("une seconde ouverture sous garde ne les redemande pas",
    appelsScPage.length === 2, `${appelsScPage.length} requêtes après rechargement`);
  /* La liste des grandeurs est comparée en entier, non par inclusion : une
     grandeur demandée pour rien coûterait quarante kilooctets de charge brute à
     chaque lecture, et l'indice ultraviolet, dont la source rend des colonnes
     vides, se serait glissé là sans que rien ne le dise. */
  ok("la requête porte le modèle, la portée et les grandeurs exactes",
    uSc.includes("models=icon_seamless") && uSc.includes("forecast_days=7")
    && decodeURIComponent(new URL(uSc || "https://x/").searchParams.get("hourly") || "")
      === "temperature_2m,wind_speed_10m,wind_gusts_10m,precipitation", uSc);

  /* La charge brute pèse cent trente-neuf kilooctets pour quarante membres et
     quatre grandeurs. Elle n'est ni gardée ni transportée telle quelle : cinq
     nombres par heure et par grandeur suffisent à tout ce qui s'affiche, et c'est
     eux que la réserve locale porte. */
  ok("la charge gardée est réduite à ses quantiles, non aux membres",
    await pgSc.evaluate(() => {
      const c = JSON.parse(localStorage.getItem("mameteo.ensemble.v1") || "null");
      if (!c?.d) return "aucune charge gardée";
      const cols = [];
      const plat = (o, prefixe) => {
        for (const k of Object.keys(o)) {
          const v = o[k];
          if (v && !Array.isArray(v) && typeof v === "object") plat(v, `${prefixe}${k}.`);
          else cols.push(prefixe + k);
        }
      };
      plat(c.d, "");
      const membres = cols.filter(x => /member/.test(x));
      if (membres.length) return `${membres.length} colonnes de membres gardées`;
      const bornes = ["mini", "bas", "med", "haut", "maxi"];
      const surplus = cols.filter(x => !["time", "membres", "pluie"].includes(x)
        && !bornes.includes(x.split(".").pop()));
      return surplus.length ? `colonnes en trop : ${surplus.join(", ")}` : "";
    }) === "", await pgSc.evaluate(() => {
      const d = JSON.parse(localStorage.getItem("mameteo.ensemble.v1") || "{}").d || {};
      return `${Object.keys(d).join(", ")} | q : ${Object.keys(d.q || {}).join(", ")}`;
    }));
  /* Le plafond suit le nombre de grandeurs encadrées : six kilooctets chacune,
     plus quatre pour les heures et le comptage de pluie. Mesuré, trois grandeurs
     tiennent en seize kilooctets. Une grandeur ajoutée sans que la réduction
     suive se verrait ici. */
  ok("elle reste proportionnée au nombre de grandeurs encadrées",
    await pgSc.evaluate(async () => {
      const E = await import("/src/ensemble.js");
      const n = Object.keys(E.chargeCourante()?.q || {}).length;
      const o = (localStorage.getItem("mameteo.ensemble.v1") || "").length;
      return n && o <= 6 * 1024 * n + 4096 ? "" : `${o} octets pour ${n} grandeurs`;
    }) === "", await pgSc.evaluate(() =>
      `${(localStorage.getItem("mameteo.ensemble.v1") || "").length} octets`));

  /* Les quantiles encadrent toujours la médiane, et l'étendue encadre les
     quartiles. Un tri à l'envers, ou un quantile pris sur une série non triée,
     se verrait ici et nulle part ailleurs. */
  ok("la fourchette encadre toujours la médiane, sur chaque grandeur",
    await pgSc.evaluate(async () => {
      const E = await import("/src/ensemble.js");
      const c = E.chargeCourante();
      if (!c) return "aucun ensemble";
      for (const [cle, q] of Object.entries(c.q)) {
        for (let i = 0; i < c.time.length; i++) {
          if (q.med[i] === null) continue;
          if (!(q.mini[i] <= q.bas[i] && q.bas[i] <= q.med[i]
            && q.med[i] <= q.haut[i] && q.haut[i] <= q.maxi[i])) {
            return `${cle} à ${c.time[i]} : `
              + `${q.mini[i]}/${q.bas[i]}/${q.med[i]}/${q.haut[i]}/${q.maxi[i]}`;
          }
        }
      }
      return "";
    }) === "");
  /* Résumer n'est pas encadrer. Quatre grandeurs sont résumées en quantiles ;
     trois seulement portent une bande, la pluie disant ce qu'elle a à dire en
     mots. L'indice ultraviolet n'a aucun scénario du côté de la source. */
  ok("quatre grandeurs sont résumées, trois seulement sont encadrées",
    await pgSc.evaluate(async () => {
      const E = await import("/src/ensemble.js");
      return `${Object.keys(E.chargeCourante()?.q || {}).sort().join(",")}`
        + ` | ${[...E.ENCADREES].sort().join(",")}`;
    }) === "mm,raf,t,v | raf,t,v",
    await pgSc.evaluate(async () => {
      const E = await import("/src/ensemble.js");
      return `${Object.keys(E.chargeCourante()?.q || {}).join(",")} | ${E.ENCADREES.join(",")}`;
    }));
  ok("la dispersion s'élargit avec l'échéance, sur chaque grandeur",
    await pgSc.evaluate(async () => {
      const E = await import("/src/ensemble.js");
      const c = E.chargeCourante();
      const e = (cle, t) => {
        const i = c.time.indexOf(t);
        return i < 0 ? null : Math.round((c.q[cle].maxi[i] - c.q[cle].mini[i]) * 10) / 10;
      };
      for (const cle of Object.keys(c.q)) {
        const proche = e(cle, "2026-08-18T12:00"), loin = e(cle, "2026-08-22T12:00");
        if (proche === null || loin === null) return `${cle} : heure absente`;
        if (!(loin > proche * 2)) return `${cle} : ${proche} près, ${loin} loin`;
      }
      return "";
    }) === "");

  /* L'enveloppe, peinte dans le groupe mobile de la voie de température, sous les
     courbes et au-dessus du lavis de nuit. Elle suit donc le glissement sans
     travail supplémentaire. */
  await ouvrirLeTemps(pgSc);
  await pgSc.waitForTimeout(700);
  ok("l'enveloppe est peinte dans la voie de température",
    await pgSc.locator('.mg-v[data-cle="t"] .mg-sc-q path').count() >= 1
    && await pgSc.locator('.mg-v[data-cle="t"] .mg-sc-e path').count() >= 1);
  ok("elle glisse avec le dessin", await pgSc.evaluate(() =>
    !!document.querySelector('.mg-v[data-cle="t"] .mg-sc-q')?.closest("g.mg-mob")));
  ok("elle passe sous les courbes et au-dessus du lavis de nuit",
    await pgSc.evaluate(() => {
      const g = document.querySelector('.mg-v[data-cle="t"] svg.mg-s g.mg-mob');
      if (!g) return "aucun groupe mobile";
      const rang = e => [...g.children].indexOf(e.closest("g.mg-mob > *") || e);
      const kids = [...g.querySelectorAll("*")];
      const iNuit = kids.findIndex(e => e.classList.contains("mg-nuit"));
      const iEnv = kids.findIndex(e => e.classList.contains("mg-sc-e"));
      const iCourbe = kids.findIndex(e => e.tagName === "polyline");
      if (iNuit < 0 || iEnv < 0 || iCourbe < 0) return "élément manquant";
      return iNuit < iEnv && iEnv < iCourbe ? ""
        : `nuit ${iNuit}, enveloppe ${iEnv}, courbe ${iCourbe}`;
    }) === "");
  /* Deux bandes grises sous une courbe ne se lisent pas seules : elles passent
     pour un effet de dessin. La phrase de la voie dit ce qu'elles portent, et
     nomme l'écart le plus large de la fenêtre, non celui de l'heure en cours qui
     vaut un demi-degré. */
  await pgSc.locator('.mg-b[data-voie="t"]').click();
  await pgSc.waitForTimeout(500);
  const phraseSc = await pgSc.locator('.mg-v[data-cle="t"] .mg-l').textContent();
  ok("la voie dit ce que l'ombre porte",
    /L'ombre porte les 40 scénarios de la source, écartés de \d+ degrés? au plus large vers/
      .test(phraseSc), phraseSc);
  ok("l'écart nommé est celui de la fenêtre", await pgSc.evaluate(() => {
    const t = document.querySelector('.mg-v[data-cle="t"] .mg-l').textContent.replace(/[\u00A0\u202F]/g, " ");
    const m = t.match(/écartés de (\d+) degrés? au plus large vers ([^.]+)\./);
    if (!m) return "phrase absente";
    // Fenêtre de 05 h à demain 05 h : l'écart le plus large tombe à sa fin.
    return Number(m[1]) >= 1 && Number(m[1]) <= 4 && /demain/.test(m[2])
      ? "" : `${m[1]} degrés vers ${m[2]}`;
  }) === "", phraseSc);

  /* La voie du vent porte la sienne, posée sur la rafale et non sur le vent
     moyen : c'est la rafale qui décide, c'est elle que la règle des faits
     marquants regarde et que le maximum de la voie marque, et le vent moyen est
     déjà tracé en aire pleine sous laquelle une bande n'aurait pas paru. */
  await pgSc.locator('.mg-b[data-voie="v"]').click();
  await pgSc.waitForTimeout(500);
  ok("la voie du vent porte son enveloppe",
    await pgSc.locator('.mg-v[data-cle="v"] .mg-sc-q path').count() >= 1
    && await pgSc.locator('.mg-v[data-cle="v"] .mg-sc-e path').count() >= 1);
  ok("elle est posée sur la rafale, non sur le vent moyen",
    await pgSc.evaluate(() => {
      const svg = document.querySelector('.mg-v[data-cle="v"] svg.mg-s');
      const q = svg.querySelector(".mg-sc-q path");
      const traits = [...svg.querySelectorAll("polyline")];
      if (!q || traits.length < 2) return "élément manquant";
      /* Les deux tracés se distinguent par leur hauteur moyenne : la rafale
         recouvre le vent moyen, son centre est donc plus haut dans la voie. */
      const centre = e => e.getBBox().y + e.getBBox().height / 2;
      const cs = traits.map(centre).sort((a, b) => a - b);
      const raf = cs[0], moy = cs[cs.length - 1];
      const c = centre(q);
      return Math.abs(c - raf) < Math.abs(c - moy) ? ""
        : `bande centrée à ${c.toFixed(0)}, rafale à ${raf.toFixed(0)}, vent à ${moy.toFixed(0)}`;
    }) === "");
  const phraseV = await pgSc.locator('.mg-v[data-cle="v"] .mg-l').textContent();
  ok("la voie du vent dit ce que son ombre porte",
    /L'ombre porte les 40 scénarios de la source, écartés de \d+ km\/h au plus large vers/
      .test(phraseV), phraseV);
  /* La pluie ne s'encadre pas : ses scénarios sont presque tous à zéro et
     quelques-uns à quelques dixièmes, une bande de zéro à un demi-millimètre est
     muette là où le comptage parle. Sa part est réduite et gardée, elle n'est pas
     peinte en bande. */
  ok("la voie de la pluie ne porte pas d'enveloppe",
    await pgSc.locator('.mg-v[data-cle="mm"] .mg-sc-q').count() === 0
    && await pgSc.locator('.mg-v[data-cle="mm"] .mg-sc-e').count() === 0);
  ok("l'indice ultraviolet non plus, la source n'en rendant aucun scénario",
    await pgSc.locator('.mg-v[data-cle="uv"] .mg-sc-q').count() === 0
    && await pgSc.evaluate(async () => {
      const E = await import("/src/ensemble.js");
      return !("uv" in (E.chargeCourante()?.q || {}));
    }));
  ok("la part des scénarios mouillés est gardée",
    await pgSc.evaluate(async () => {
      const E = await import("/src/ensemble.js");
      const p = E.chargeCourante()?.pluie;
      return Array.isArray(p) && p.every(x => x === null || (x >= 0 && x <= 100))
        && p.some(x => x !== null);
    }));
  /* Ce que le comptage ajoute est la quantité, non une seconde probabilité. La
     mesure a tranché : la probabilité de la source et la part des scénarios
     s'accordent à dix points près sur quatre-vingt-douze pour cent des heures, et
     rien ne dit lequel tombe le plus juste là où ils divergent. La voie parle donc
     de millimètres, et ne pose pas deux probabilités côte à côte. */
  const phraseMm = await pgSc.evaluate(() => {
    const v = document.querySelector('.mg-v[data-cle="mm"] .mg-l');
    return v ? v.textContent : "";
  });
  ok("la voie de la pluie dit l'étalement des quantités",
    /Sur les 40 scénarios, la moitié (donnent moins de [\d,]+ mm|n'en donnent aucune) vers /
      .test(phraseMm) && /le plus arrosé [\d,]+ mm\.$/.test(phraseMm.trim()), phraseMm);
  ok("elle ne pose pas une seconde probabilité à côté de la première",
    (phraseMm.match(/%/g) || []).length === 1, phraseMm);

  /* La fourchette écrite sur l'accueil. Elle ne se dit que là où elle a de la
     matière : à l'heure en cours la dispersion vaut un demi-degré et la phrase
     serait creuse, à trois jours elle vaut cinq degrés et change la décision.

     Le contexte assèche la charge et calme le vent : sur la charge d'essai, les
     deux lignes de pluie et celle des rafales occupent les trois places du bloc
     et évincent la fourchette, ce qui est le bon comportement du plafond mais ne
     permet pas de l'éprouver. */
  const ctxFourch = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await ctxFourch.addInitScript(amorce(FAIN));
  await brancherRoutes(ctxFourch);
  await ctxFourch.route(/https:\/\/api\.open-meteo\.com/, route => {
    const u = route.request().url();
    const d = JSON.parse(JSON.stringify(METEO));
    d.hourly.precipitation = d.hourly.precipitation.map(() => 0);
    d.hourly.precipitation_probability = d.hourly.precipitation_probability.map(() => 0);
    d.hourly.wind_gusts_10m = d.hourly.wind_gusts_10m.map(() => 12);
    d.hourly.wind_speed_10m = d.hourly.wind_speed_10m.map(() => 8);
    d.hourly.uv_index = d.hourly.uv_index.map(() => 1);
    if (u.includes("current=")) {
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" }); return;
    }
    /* AROME s'écarte ici de deux degrés du modèle global, sous le seuil : un écart
       ordinaire entre deux modèles n'est pas un désaccord, et la règle doit se
       taire dessus. */
    if (u.includes("models=meteofrance_arome")) {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        hourly: { time: d.hourly.time.slice(),
          temperature_2m: d.hourly.temperature_2m.map(v => v + 2) } }) }); return;
    }
    if (u.includes("hourly=")) {
      route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ hourly: d.hourly }) }); return;
    }
    delete d.hourly;
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
  });
  const pgFourch = await ctxFourch.newPage();
  await ouvrirPage(pgFourch);
  await reposer(pgFourch, 2400);
  const cjF = await phrasesConseils(pgFourch, "#ecran .cj-l");
  /* Depuis le 27 septembre 2026, l'accueil ne parle que de demain : la fourchette
     d'après-demain s'écrit dans La semaine, au volet de la journée. */
  await pgFourch.locator('[data-onglet="semaine"]').click();
  await pgFourch.waitForTimeout(600);
  const semF = await pgFourch.evaluate(() => [...document.querySelectorAll("#ecran .md-sc")]
    .map(e => e.textContent).filter(t => /de -?\d+ à -?\d+° au plus chaud/.test(t)));
  await pgFourch.locator('[data-onglet="accueil"]').click();
  await pgFourch.waitForTimeout(600);
  ok("la fourchette des scénarios s'écrit là où elle a de la matière",
    cjF.some(x => /^Scénarios partagés sur le maximum, de -?\d+ à -?\d+°\.$/.test(x.trim())) || semF.length > 0,
    (cjF.join(" | ") || "aucune ligne") + ` ; La semaine : ${semF.length}`);
  /* Elle parle de la journée de son bloc, non de l'heure en cours : la dispersion
     de maintenant vaut un demi-degré et n'a rien à dire. */
  ok("elle se pose dans un bloc qui suit, non dans celui du jour",
    await pgFourch.evaluate(() => {
      const dans = c => [...document.querySelectorAll(
        `#ecran .section[data-bloc="${c}"] .cj-l`)].some(e => /Scénarios partagés/.test((e.dataset.phrase || e.textContent)));
      /* Jamais dans le bloc du jour. Dans celui de demain seulement si demain a
         la matière d'une fourchette ; celle d'après-demain est dans La semaine. */
      return !dans("jour");
    }));
  /* Deux degrés d'écart entre modèles ne sont pas un désaccord : c'est
     l'ordinaire, et une phrase qui le dirait tous les jours ne dirait rien. */
  ok("un écart ordinaire entre modèles ne fait pas parler la règle du désaccord",
    !cjF.some(x => /ne s'accordent pas/.test(x)), cjF.join(" | "));
  await ctxFourch.close();

  /* Le désaccord entre modèles. Trois voix, toutes déjà chargées et aucune requête
     nouvelle : le modèle global, AROME par-dessus lui sur les trois premiers
     jours, et la médiane des scénarios d'ICON.

     Sur la charge d'essai les trois se confondent, AROME rendant la même série que
     le modèle global et les membres étant posés symétriquement autour d'elle : la
     règle s'y tait, ce qui est le bon comportement et se contrôle plus bas. Ici
     AROME est décalé de six degrés, et la phrase doit nommer les deux extrêmes. */
  const ctxDesac = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await ctxDesac.addInitScript(amorce(FAIN));
  await brancherRoutes(ctxDesac);
  await ctxDesac.route(/https:\/\/api\.open-meteo\.com/, route => {
    const u = route.request().url();
    const d = JSON.parse(JSON.stringify(METEO));
    d.hourly.precipitation = d.hourly.precipitation.map(() => 0);
    d.hourly.precipitation_probability = d.hourly.precipitation_probability.map(() => 0);
    d.hourly.wind_gusts_10m = d.hourly.wind_gusts_10m.map(() => 12);
    d.hourly.wind_speed_10m = d.hourly.wind_speed_10m.map(() => 8);
    d.hourly.uv_index = d.hourly.uv_index.map(() => 1);
    if (u.includes("current=")) {
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" }); return;
    }
    if (u.includes("models=meteofrance_arome")) {
      const a = { time: d.hourly.time.slice(), temperature_2m: d.hourly.temperature_2m.map(v => v + 6) };
      route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ hourly: a }) }); return;
    }
    if (u.includes("hourly=")) {
      route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ hourly: d.hourly }) }); return;
    }
    delete d.hourly;
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
  });
  /* Les scénarios suivent AROME et non le modèle global : les trois voix ne se
     réduisent donc pas à deux, et retirer celle du modèle global fait tomber
     l'écart à zéro. C'est ce qui rend cette voix nécessaire. */
  await ctxDesac.route(/ensemble-api\.open-meteo\.com/, r => {
    const e = JSON.parse(JSON.stringify(ENSEMBLE));
    for (const c of Object.keys(e.hourly)) {
      if (c.startsWith("temperature_2m")) e.hourly[c] = e.hourly[c].map(v => v + 6);
    }
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(e) });
  });
  const pgDesac = await ctxDesac.newPage();
  await ouvrirPage(pgDesac);
  await reposer(pgDesac, 2400);
  const cjD = await phrasesConseils(pgDesac, "#ecran .cj-l");
  const ligneD = cjD.find(x => /ne s'accordent pas/.test(x)) || "";
  ok("le désaccord entre modèles se dit, avec ses extrêmes et son échéance",
    /^Les modèles ne s'accordent pas vers .+, de -?\d+ à -?\d+ degrés\.$/.test(ligneD.trim()),
    ligneD || cjD.join(" | ") || "aucune ligne");
  ok("les extrêmes nommés encadrent les six degrés d'écart posés", (() => {
    const m = ligneD.match(/de (-?\d+) à (-?\d+) degrés/);
    if (!m) return false;
    const e = Number(m[2]) - Number(m[1]);
    return e >= 5 && e <= 7;
  })(), ligneD);
  ok("elle passe devant la fourchette des scénarios",
    await pgDesac.evaluate(() => {
      const l = [...document.querySelectorAll('#ecran .section[data-bloc="suite"] .cj-l')]
        .map(e => e.dataset.phrase || e.textContent);
      const d = l.findIndex(x => /ne s'accordent pas/.test(x));
      const f = l.findIndex(x => /Scénarios partagés/.test(x));
      return d >= 0 && (f < 0 || d < f);
    }));
  await ctxDesac.close();

  /* Une source d'ensemble muette ne prive de rien : la prévision déterministe est
     déjà à l'écran, et l'enveloppe ne paraît simplement pas. */
  const ctxMuet = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await ctxMuet.addInitScript(amorce(FAIN));
  await brancherRoutes(ctxMuet);
  await ctxMuet.route(/ensemble-api\.open-meteo\.com/, r => r.abort());
  const pgMuet = await ctxMuet.newPage();
  await ouvrirPage(pgMuet);
  await reposer(pgMuet, 2250);
  await ouvrirLeTemps(pgMuet);
  await pgMuet.waitForTimeout(700);
  ok("sans scénarios, la voie de température se dessine quand même",
    await pgMuet.locator('.mg-v[data-cle="t"] polyline').count() >= 3
    && await pgMuet.locator('.mg-v[data-cle="t"] .mg-sc-q').count() === 0);
  ok("et sa phrase ne parle pas d'une ombre absente",
    !/ombre/.test(await pgMuet.locator('.mg-v[data-cle="t"] .mg-l').textContent()),
    await pgMuet.locator('.mg-v[data-cle="t"] .mg-l').textContent());
  await ctxMuet.close();

  /* Le journal de justesse. Rien ne s'affiche : deux mois de couples entre ce qui
     était annoncé et ce qui a été relevé permettront de dire, au jalon 6, à quelle
     distance la prévision tombe. La donnée ne se rattrape pas après coup, d'où
     cette amorce livrée avant tout ce qui l'exploitera. */
  const jr = await pgSc.evaluate(() =>
    JSON.parse(localStorage.getItem("mameteo.justesse.v1") || "null"));
  ok("le journal de justesse est écrit", !!jr && Array.isArray(jr.lignes) && jr.lignes.length > 0,
    jr ? `${jr.lignes.length} lignes` : "aucun journal");
  ok("chaque ligne porte son lieu, son heure visée, son échéance et sa valeur",
    (jr?.lignes || []).every(l => typeof l.l === "string" && /^\d{4}-\d\d-\d\dT\d\d$/.test(l.c)
      && typeof l.e === "number" && typeof l.t === "number" && typeof l.le === "string"),
    JSON.stringify((jr?.lignes || [])[0] || {}));
  /* Les heures visées sont les extrêmes de la journée : une prévision se juge sur
     eux, non sur une heure quelconque. */
  ok("il ne vise que les heures extrêmes des journées",
    (jr?.lignes || []).every(l => ["06", "15"].includes(l.c.slice(11, 13))),
    [...new Set((jr?.lignes || []).map(l => l.c.slice(11, 13)))].join(", "));
  ok("une même heure visée n'est notée qu'une fois par échéance",
    (() => {
      const vus = new Set();
      for (const l of jr?.lignes || []) {
        const k = `${l.l}|${l.c}|${l.e}`;
        if (vus.has(k)) return `doublon sur ${k}`;
        vus.add(k);
      }
      return "";
    })() === "");
  /* Les heures visées déjà passées portent leur relevé : la charge horaire garde
     deux journées écoulées, au delà l'heure aurait disparu de la source et la
     comparaison n'aurait plus de terme. */
  ok("une heure visée passée porte son relevé", await pgSc.evaluate(async () => {
    const J = await import("/src/justesse.js");
    const P = await import("/src/previsions.js");
    const j = J.lire();
    const avant = j.lignes.length;
    // Une ligne d'hier, notée à six heures d'échéance, que le relevé doit remplir.
    j.lignes.push({ l: "47.500,4.300", c: "2026-08-17T15", e: 6, t: 20, mm: 0, pb: 0,
      le: "2026-08-17T09" });
    localStorage.setItem("mameteo.justesse.v1", JSON.stringify(j));
    const r = J.noter(P.chargeCourante(), "47.500,4.300");
    const apres = J.lire().lignes.find(l => l.c === "2026-08-17T15" && l.e === 6);
    return apres && apres.r !== undefined && r.releves >= 1
      ? "" : `relevé ${JSON.stringify(apres)} après ${avant} lignes`;
  }) === "");
  ok("une seconde notation dans la même heure n'ajoute rien",
    await pgSc.evaluate(async () => {
      const J = await import("/src/justesse.js");
      const P = await import("/src/previsions.js");
      const avant = J.lire().lignes.length;
      J.noter(P.chargeCourante(), "47.500,4.300");
      return J.lire().lignes.length - avant;
    }) === 0);
  /* Chaque ligne porte les deux probabilités, celle de la source et la part des
     scénarios mouillés. Rien n'en affiche aucune : c'est le jalon 6 qui dira,
     dans deux mois et par échéance, laquelle tombe le plus juste. Les scénarios
     arrivant après la prévision, la ligne est écrite sans eux puis complétée. */
  ok("chaque ligne porte les deux probabilités",
    await pgSc.evaluate(() => {
      const j = JSON.parse(localStorage.getItem("mameteo.justesse.v1") || "null");
      const l = (j?.lignes || []).filter(x => x.pe !== undefined);
      if (!l.length) return "aucune ligne complétée";
      const faux = l.filter(x => !(x.pe >= 0 && x.pe <= 100) || typeof x.pb !== "number");
      return faux.length ? JSON.stringify(faux[0]) : "";
    }) === "", await pgSc.evaluate(() => {
      const j = JSON.parse(localStorage.getItem("mameteo.justesse.v1") || "null");
      return JSON.stringify((j?.lignes || []).find(x => x.pe !== undefined) || {});
    }));
  ok("la part des scénarios se pose sur les lignes déjà écrites",
    await pgSc.evaluate(async () => {
      const J = await import("/src/justesse.js");
      const P = await import("/src/previsions.js");
      const E = await import("/src/ensemble.js");
      const j = J.lire();
      const cible = j.lignes.find(l => l.pe !== undefined);
      if (!cible) return "aucune ligne à éprouver";
      delete cible.pe;
      localStorage.setItem("mameteo.justesse.v1", JSON.stringify(j));
      const r = J.noter(P.chargeCourante(), cible.l, new Date(), E.chargeCourante());
      const apres = J.lire().lignes.find(l => l.c === cible.c && l.e === cible.e);
      return r.completees >= 1 && apres?.pe !== undefined ? "" : `complétées ${r.completees}`;
    }) === "");
  await ctxSc.close();

  /* ---------- Le rappel de parapluie ---------- */
};
