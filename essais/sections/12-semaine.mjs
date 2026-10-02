/* La semaine. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */

export const titre = "La semaine";
export const avecPage = true;

export default async T => {
  const { pg, ok, onglet, ctxReponse, METEO_NUE, reposer } = T;
  await onglet("semaine");
  /* Neuf rangées : les deux journées que les heures couvrent en arrière, puis les
     sept annoncées. La table commençait à aujourd'hui, faute d'avoir demandé les
     journées d'avant. */
  ok("neuf lignes", await pg.locator(".sem-r").count() === 9, String(await pg.locator(".sem-r").count()));
  /* Audit du 1er octobre 2026, constat 4.4 : chaque journée dit son ciel et
     nomme ses bornes aux lecteurs d'écran. */
  const semaineLu = await pg.evaluate(() => [...document.querySelectorAll(".sem-r")].every(r =>
    (r.querySelector(".c .titre-lu")?.textContent || "").length > 2
    && [...r.querySelectorAll(".b .titre-lu")].map(x => x.textContent).join(",") === "minimum,maximum"));
  ok("chaque journée d'À venir dit son ciel et nomme ses bornes", semaineLu === true);
  const jNoms = (await pg.locator(".sem .j b").allInnerTexts()).map(x => x.trim());
  ok("les trois journées qui se nomment portent leur nom, les autres leur date",
    jNoms[1] === "Hier" && jNoms[2] === "Auj." && jNoms[3] === "Demain"
    && /^(lun|mar|mer|jeu|ven|sam|dim)/.test(jNoms[0]), jNoms.join(" | "));
  /* « Avant-hier » ne tient pas dans une colonne de soixante-quatre points : le
     nom court y sert, comme après-demain. Un nom trop long ne déborde pas, il
     repasse à la ligne : c'est la hauteur qui le dit, non la largeur. */
  ok("aucun nom de journée ne repasse à la ligne", await pg.evaluate(() => {
    const h = [...document.querySelectorAll(".sem .j b")]
      .map(e => e.getBoundingClientRect().height);
    const bas = Math.min(...h);
    const gros = h.filter(x => x > bas + 1);
    return gros.length ? `${gros.length} noms sur deux lignes` : "";
  }) === "");
  ok("les journées écoulées sont mises en retrait",
    await pg.locator(".sem-passe").count() === 2
    && await pg.evaluate(() => {
      const p = document.querySelector(".sem-passe > .sem-r");
      return p ? Number(getComputedStyle(p).opacity) < 0.9 : false;
    }));
  ok("chaque ligne porte sa borne basse à gauche et sa borne haute à droite",
    await pg.locator(".sem-min").count() === 9 && await pg.locator(".sem-max").count() === 9);
  ok("les plages se posent sur une échelle commune", await pg.evaluate(() => {
    const p = [...document.querySelectorAll(".sem-plage")]
      .map(e => parseFloat(e.style.left));
    return new Set(p.map(x => x.toFixed(1))).size > 1 && p.every(x => x >= 0 && x <= 100);
  }));
  ok("le point du moment ne paraît que sur le jour en cours",
    await pg.locator(".sem-pt").count() === 1
    && await pg.locator(".sem-auj .sem-pt").count() === 1);
  ok("la pluie se lit sous le symbole",
    await pg.locator(".sem .c em").count() >= 1
    && await pg.locator(".sem .p").count() === 0);
  ok("aucune rangée de la semaine ne dépasse deux lignes", await pg.evaluate(() =>
    [...document.querySelectorAll(".sem-r")].every(t => t.getBoundingClientRect().height < 76)));
  ok("le symbole du ciel est le même partout", await pg.evaluate(() => {
    // Bandeau, semaine et liste des communes emploient tous `icoTemps`.
    return document.querySelectorAll(".sem .c svg.ict").length === 9;
  }));
  ok("les symboles de temps sont en deux tons", await pg.evaluate(() => {
    const s = document.querySelector(".sem .c svg.ict");
    if (!s) return false;
    const a = s.querySelector(".ic-a"), b = s.querySelector(".ic-b");
    if (!a) return false;
    return !b || getComputedStyle(a).stroke !== getComputedStyle(b).stroke
      || getComputedStyle(a).stroke !== "rgb(0, 0, 0)";
  }));

  /* ---- Les moments d'une journée de la semaine ---- */

  ok("chaque journée annonce qu'elle s'ouvre",
    await pg.locator('.sem-r[aria-expanded="false"]').count() === 9
    && await pg.locator(".sem-chev").count() === 9);
  ok("aucun volet n'est ouvert à l'arrivée",
    await pg.locator(".md:not([hidden])").count() === 0);

  await pg.locator(".sem-r").nth(2).click();
  await pg.waitForTimeout(350);
  ok("l'appui ouvre les quatre moments",
    await pg.locator(".md:not([hidden])").count() === 1
    && await pg.locator(".md:not([hidden]) > div").count() === 4);
  ok("les quatre moments sont nommés par tranche de six heures",
    (await pg.locator(".md:not([hidden]) > div > i").allInnerTexts()).join("/")
    === "nuit/matin/après-midi/soirée",
    (await pg.locator(".md:not([hidden]) > div > i").allInnerTexts()).join("/"));

  await pg.locator(".sem-r").nth(4).click();
  await pg.waitForTimeout(350);
  ok("un seul volet reste ouvert",
    await pg.locator(".md:not([hidden])").count() === 1
    && await pg.locator('.sem-r[aria-expanded="true"]').count() === 1);
  await pg.locator(".sem-r").nth(4).click();
  await pg.waitForTimeout(350);
  ok("un second appui referme",
    await pg.locator(".md:not([hidden])").count() === 0
    && await pg.locator('.sem-r[aria-expanded="true"]').count() === 0);

  /* La donnée du volet est celle du module, non une valeur recopiée : la
     température montrée est le minimum la nuit, le maximum le jour, et les deux
     lignes basses ne paraissent que si elles ont quelque chose à dire. */
  const voletsKO = await pg.evaluate(async () => {
    const P = await import("/src/previsions.js");
    const maux = [];
    for (const j of document.querySelectorAll(".sem-r[data-jour]")) {
      const date = j.dataset.jour;
      const mo = P.momentsJour(date);
      if (!mo) { maux.push(`${date}: aucun moment`); continue; }
      /* Le volet porte ses quatre moments, et sous eux la ligne d'accord des
         scénarios quand l'ensemble couvre la journée entière. */
      const dedans = [...document.getElementById(j.getAttribute("aria-controls")).children];
      /* Ni la ligne des scénarios, ni le bouton « Voir les heures » du jalon 12
         ne sont des moments de la journée. */
      const cases = dedans.filter(e => !e.classList.contains("md-sc") && !e.classList.contains("sem-heures"));
      if (cases.length !== 4) { maux.push(`${date}: ${cases.length} cases`); continue; }
      cases.forEach((c, q) => {
        const m = mo[q];
        const attendu = Math.round(q === 0 ? m.tn : m.tx);
        const vu = Number(c.querySelector("b").textContent.replace("°", ""));
        if (vu !== attendu) maux.push(`${date} ${q}: ${vu} au lieu de ${attendu}`);
        const eau = c.querySelector("em");
        if (eau && !(m.mm >= 0.1 || m.pb >= 5)) maux.push(`${date} ${q}: eau sans motif`);
        if (!eau && (m.mm >= 0.1 || m.pb >= 5)) maux.push(`${date} ${q}: eau manquante`);
        const vent = c.querySelector("u");
        if (vent && m.raf < 40) maux.push(`${date} ${q}: vent sans motif`);
        if (!vent && m.raf >= 40) maux.push(`${date} ${q}: rafale tue`);
      });
    }
    return maux;
  });
  ok("chaque volet dit la borne qui compte et rien de superflu",
    voletsKO.length === 0, voletsKO.slice(0, 3).join(" | "));

  ok("la rafale forte est signalée quelque part dans la semaine", await pg.evaluate(() =>
    [...document.querySelectorAll(".md u")].length > 0));

  /* L'accord des scénarios, écrit en toutes lettres sous les quatre moments. Un
     chiffre de dispersion ne se lit pas : « six degrés d'étendue » ne dit rien à
     qui n'a pas l'habitude, quand « les scénarios sont partagés, de 18 à 27 degrés
     au plus chaud » dit à la fois l'accord et ce qu'il recouvre.

     L'ensemble porte sept jours annoncés et aucun jour écoulé : les deux rangées
     du passé ne portent donc pas la ligne, et c'est normal. */
  {
    const vus = await pg.evaluate(() => [...document.querySelectorAll(".sem-j")].map(j => ({
      jour: j.querySelector(".sem-r")?.dataset.jour || "",
      passe: j.classList.contains("sem-passe"),
      dit: (j.querySelector(".md-sc") || {}).textContent || "",
    })));
    const couverts = vus.filter(x => x.dit);
    ok("les journées que les scénarios couvrent disent leur confiance",
      couverts.length === 7 && vus.filter(x => x.passe).every(x => !x.dit),
      `${couverts.length} journées sur ${vus.length}, `
      + `dont ${vus.filter(x => x.passe && x.dit).length} écoulées`);
    ok("la confiance s'écrit en toutes lettres et porte la fourchette",
      /* Depuis le jalon 13, la phrase compare ICON et ECMWF là où les deux
         couvrent la journée, et nomme le modèle seul ailleurs. */
      couverts.every(x => /^Confiance (bonne|moyenne|faible) : (les scénarios |ICON et ECMWF (s'accordent|s'écartent de \d+°), |ECMWF seul|ICON seul)/.test(x.dit)
        && /de -?\d+ à -?\d+° au plus chaud\.$/.test(x.dit.trim())),
      couverts[0]?.dit || "aucune ligne");
    /* La confiance se dégrade avec l'échéance : les scénarios s'accordent sur
       demain et se partagent en fin de semaine. Une ligne qui dirait la même chose
       sur les sept journées ne dirait rien. */
    const mots = couverts.map(x => (x.dit.match(/Confiance (\w+)/) || [])[1]);
    /* Depuis le jalon 13, la confiance se mesure sur les deux modèles réunis :
       à six jours leur dispersion reste moyenne, le « faible » n'arrivant qu'au-
       delà de la semaine, avec ECMWF seul. La garde exige une confiance bonne au
       départ, qui ne remonte jamais, et au moins deux niveaux. */
    const rangConf = { bonne: 0, moyenne: 1, faible: 2 };
    ok("elle se dégrade à mesure que l'échéance s'éloigne",
      new Set(mots).size >= 2 && mots[0] === "bonne"
      && mots.every((m, k) => k === 0 || rangConf[m] >= rangConf[mots[k - 1]]),
      mots.join(", "));
    /* La dispersion est la moyenne sur les heures de la journée, non celle d'une
       heure prise au hasard : une nuit calme sous un après-midi indécis ne doit
       pas passer pour une journée sûre. Le contrôle la recalcule à part. */
    ok("la dispersion est la moyenne des heures de la journée",
      await pg.evaluate(async () => {
        const E = await import("/src/ensemble.js");
        const c = E.chargeCourante();
        if (!c?.q?.t) return "aucun ensemble";
        for (const date of [...new Set(c.time.map(t => t.slice(0, 10)))]) {
          const j = E.journee(date);
          if (!j) continue;
          const k = [];
          c.time.forEach((t, i) => { if (t.slice(0, 10) === date) k.push(i); });
          const moy = k.reduce((a, i) => a + (c.q.t.maxi[i] - c.q.t.mini[i]), 0) / k.length;
          if (Math.abs(moy - j.etendue) > 0.06) {
            return `${date} : ${j.etendue} rendu, ${moy.toFixed(2)} attendu`;
          }
        }
        return "";
      }) === "");
  }

  /* Sur la journée en cours, un moment déjà passé s'efface. La rangée du jour
     n'est plus la première de la table, deux journées écoulées la précédant. */
  await pg.locator(".sem-auj .sem-r").click();
  await pg.waitForTimeout(350);
  ok("un moment passé s'efface sur la journée en cours", await pg.evaluate(() => {
    const v = document.querySelector(".md:not([hidden])");
    if (!v) return false;
    const h = new Date().getHours();
    return [...v.children].every((c, q) =>
      c.classList.contains("passe") === (q * 6 + 6 <= h));
  }));
  /* Une journée entièrement écoulée n'efface aucun de ses moments : tout y est
     passé, et le dire quatre fois n'apprendrait rien. Sa rangée fermée porte déjà
     le retrait. */
  await pg.locator(".sem-auj .sem-r").click();
  await pg.waitForTimeout(300);
  await pg.locator(".sem-passe .sem-r").first().click();
  await pg.waitForTimeout(350);
  ok("une journée écoulée n'efface aucun de ses moments",
    await pg.locator(".md:not([hidden]) > div.passe").count() === 0
    && await pg.locator(".md:not([hidden]) > div").count() === 4);
  await pg.locator(".sem-passe .sem-r").first().click();
  await pg.waitForTimeout(300);

  /* Audit du 1er octobre 2026, constat 1.11 : une valeur absente de la source
     reste absente. Ici, le 24 août n'a plus d'heures complètes ni de bornes
     quotidiennes, et l'indice UV manque toute la journée du 18. La rangée du
     24 écrivait « 0° » et tirait l'échelle vers zéro, si bien qu'aucune barre
     ne partait plus du bord gauche ; la tuile écrivait « Indice UV 0 ». La neige d'une station, de même, sans valeur. */
  const [ctxTrou, pgTrou] = await ctxReponse(() => {
    const d = METEO_NUE();
    d.hourly.time.forEach((t, k) => {
      if (t.startsWith("2026-08-18")) d.hourly.uv_index[k] = null;
      if (t === "2026-08-24T12:00") d.hourly.temperature_2m[k] = null;
    });
    const j = d.daily.time.indexOf("2026-08-24");
    d.daily.temperature_2m_max[j] = null;
    d.daily.temperature_2m_min[j] = null;
    return d;
  });
  const uvTrou = await pgTrou.evaluate(() => [...document.querySelectorAll(".tuile")]
    .find(b => b.querySelector("i")?.textContent === "Indice UV")?.querySelector("b")?.textContent ?? "absente");
  await pgTrou.locator('[data-onglet="semaine"]').click();
  await reposer(pgTrou, 1500);
  const trouDit = await pgTrou.evaluate(async () => {
    const rangees = [...document.querySelectorAll(".sem-r, .sem-fixe")];
    const der = rangees[rangees.length - 1];
    const plages = [...document.querySelectorAll(".sem-plage")].map(s => s.getAttribute("style"));
    const gauche = Math.min(...plages.map(s => parseFloat(/left:([\d.-]+)%/.exec(s)?.[1] ?? "100")));
    const N = await import("/src/neige.js");
    const heures = Array.from({ length: 24 }, (_, k) => `2026-12-01T${String(k).padStart(2, "0")}:00`);
    const r = N.resumePoint({ hourly: { time: heures, snow_depth: heures.map(() => null), snowfall: heures.map(() => 0),
      freezing_level_height: heures.map(() => null) }, daily: { time: ["2026-12-01"], snowfall_sum: [0], wind_gusts_10m_max: [null] } },
      "2026-12-01T09:00");
    return { min: der?.querySelector(".sem-min")?.textContent, max: der?.querySelector(".sem-max")?.textContent,
      nan: document.querySelector("#ecran").innerHTML.includes("NaN"), gauche,
      graphe: [...document.querySelectorAll(".sg text")].some(e => e.textContent === "0°"),
      neige: [r.sol, r.iso, r.rafales].join(" ") };
  });
  ok("une valeur absente de la source ne s'écrit pas zéro",
    uvTrou === "—" && trouDit.min === "—" && trouDit.max === "—" && !trouDit.nan && trouDit.gauche < 1
    && !trouDit.graphe && trouDit.neige === "  ",
    JSON.stringify({ uvTrou, ...trouDit }));
};
