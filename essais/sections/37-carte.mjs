/* La carte. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */

export const titre = "La carte";
export const avecPage = true;

export default async T => {
  const { ctx, ok, txtDe, onglet, ctxReponse, REGL_BEAU, METEO_NUE, reposer } = T;
  /* Le fond est dessiné, non chargé en tuiles : une tuile de plan de l'IGN pèse de
     42 à 70 kilooctets, et une vue de téléphone en demande une douzaine. Les
     contours embarqués coûtent trente-trois kilooctets une fois pour toutes. */
  const [ctxCarte, pgCarte] = await ctxReponse(METEO_NUE, REGL_BEAU);
  await pgCarte.locator('[data-onglet="carte"]').click();
  await pgCarte.waitForTimeout(700);

  ok("la carte est peinte sur sa toile",
    await pgCarte.evaluate(() => {
      const cv = document.getElementById("caToile");
      if (!cv) return "aucune toile";
      const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
      const teintes = new Set();
      for (let i = 0; i < d.length; i += 4 * 97) teintes.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
      // Un fond uni ne porte qu'une teinte : les traits en ajoutent.
      return teintes.size > 3 ? "" : `${teintes.size} teintes`;
    }) === "");
  /* L'écran de la carte ne défile pas : la toile occupe ce qui reste entre les
     deux barres, et le doigt qui glisse déplace la carte. */
  ok("l'écran de la carte ne défile pas",
    await pgCarte.evaluate(() =>
      document.documentElement.scrollHeight <= window.innerHeight + 1),
    await pgCarte.evaluate(() =>
      `${document.documentElement.scrollHeight} contre ${window.innerHeight}`));
  /* La carte s'ouvre sur la France entière depuis le 7 septembre 2026. Elle sert
     d'abord à voir où il pleut, et la réponse est régionale avant d'être locale.
     Le cadrage se calcule au lieu d'être écrit en dur : un téléphone en portrait
     et le même en paysage n'ont pas le même rapport de côtés. */
  const franceDit = await pgCarte.evaluate(async () => {
      const C = await import("/src/carte.js");
      const cv = document.getElementById("caToile");
      if (!cv) return "aucune toile";
      const l = cv.clientWidth, h = cv.clientHeight;
      const vue = C.vueSur(C.FRANCE, l, h);
      // Les quatre coins de la France tombent dans le cadre.
      for (const [la, lo] of [[C.FRANCE.n, C.FRANCE.o], [C.FRANCE.n, C.FRANCE.e],
        [C.FRANCE.s, C.FRANCE.o], [C.FRANCE.s, C.FRANCE.e]]) {
        const p = C.surEcran(vue, la, lo, l, h);
        if (p.x < 0 || p.y < 0 || p.x > l || p.y > h) {
          return `coin ${la},${lo} hors du cadre`;
        }
      }
      /* Et le cadrage vaut celui que la carte s'est donné : sans quoi le contrôle
         vérifierait un calcul que l'écran n'emploie pas. */
      const ici = document.querySelector(".ca-r-ici");
      if (!ici) return "aucun repère de lieu courant";
      /* La mesure porte sur le point, non sur la boîte : le nom bascule à gauche
         du point près du bord droit, et la boîte change alors de bord d'ancrage. */
      const b = cv.getBoundingClientRect();
      const pt = ici.querySelector(".ca-r-pt").getBoundingClientRect();
      const attendu = C.surEcran(vue, 47.5, 4.3, l, h);
      const dx = (pt.left + pt.width / 2) - (b.left + attendu.x);
      const dy = (pt.top + pt.height / 2) - (b.top + attendu.y);
      return Math.abs(dx) < 3 && Math.abs(dy) < 3 ? ""
        : `le repère est à ${dx.toFixed(1)}, ${dy.toFixed(1)} de sa place`;
  });
  ok("la carte s'ouvre sur la France entière", franceDit === "", franceDit);

  /* Un repère près du bord droit porte son nom à gauche du point. Le cas se voit
     dès l'ouverture depuis que la carte montre la France entière.

     Le contrôle amène le repère au bord en déplaçant la carte, puis lit ce que
     l'application en a fait. Poser la classe lui-même reviendrait à éprouver la
     feuille de style et non la règle. */
  await pgCarte.locator("#caIci").click();
  await pgCarte.waitForTimeout(400);
  const cadreBord = await pgCarte.locator("#caToile").boundingBox();
  {
    const y = cadreBord.y + cadreBord.height / 2 + 200;
    const x = cadreBord.x + cadreBord.width / 2;
    await pgCarte.mouse.move(x, y);
    await pgCarte.mouse.down();
    await pgCarte.mouse.move(x + cadreBord.width / 2 - 30, y, { steps: 8 });
    await pgCarte.mouse.up();
    await pgCarte.waitForTimeout(500);
  }
  ok("un repère près du bord droit porte son nom à gauche",
    await pgCarte.evaluate(() => {
      const cv = document.getElementById("caToile");
      const l = cv.clientWidth;
      const cadre = cv.getBoundingClientRect();
      const b = document.querySelector(".ca-r-ici");
      if (!b || b.hidden) return "le repère du lieu courant n'est plus visible";
      const pt = b.querySelector(".ca-r-pt").getBoundingClientRect();
      const x = pt.left + pt.width / 2 - cadre.left;
      if (x < l - 60) return `le repère est à ${x.toFixed(0)} sur ${l}, trop loin du bord`;
      if (!b.classList.contains("ca-r-gauche")) return "le nom n'a pas basculé";
      const boite = b.getBoundingClientRect();
      const debord = boite.right - cadre.left - l;
      return debord <= 0 ? "" : `le nom déborde de ${debord.toFixed(0)} points`;
    }) === "");
  await pgCarte.locator("#caIci").click();
  await pgCarte.waitForTimeout(400);

  ok("chaque lieu suivi porte son repère",
    await pgCarte.locator(".ca-r").count() === 3
    && await pgCarte.locator(".ca-r-ici").count() === 1,
    `${await pgCarte.locator(".ca-r").count()} repères`);

  /* Ce qui suit part d'un cadrage centré sur la commune, que le bouton de retour
     donne. La carte s'ouvre sur la France entière depuis le 7 septembre 2026, et
     ces contrôles portent sur le zoom, le masquage et le glissement, non sur le
     cadrage d'ouverture, lequel a sa propre garde plus haut. */
  await pgCarte.locator("#caIci").click();
  await pgCarte.waitForTimeout(400);

  /* Le zoom se mesure sur l'écartement de deux repères, non sur le libellé de
     l'échelle : celui-ci reste le même d'un cran à l'autre quand la barre change
     de longueur, la longueur ronde retenue ne changeant qu'un cran sur deux. */
  const ecartReperes = () => pgCarte.evaluate(() => {
    const r = [...document.querySelectorAll(".ca-r")].filter(x => !x.hidden);
    if (r.length < 2) return null;
    /* La mesure porte sur le point, non sur la boîte du repère : le nom bascule
       à gauche du point près du bord droit, et le bord de la boîte changerait de
       place sans que le lieu ait bougé. */
    const c = r.map(x => {
      const b = x.querySelector(".ca-r-pt").getBoundingClientRect();
      return [b.left + b.width / 2, b.top + b.height / 2];
    });
    return Math.round(Math.hypot(c[0][0] - c[1][0], c[0][1] - c[1][1]));
  });
  const ecartAvant = await ecartReperes();
  await pgCarte.locator("#caToile").press("+");
  await pgCarte.waitForTimeout(300);
  const ecartApres = await ecartReperes();
  ok("un cran de zoom double l'écartement des lieux",
    ecartAvant > 10 && Math.abs(ecartApres / ecartAvant - 2) < 0.06,
    `${ecartAvant} puis ${ecartApres}`);
  /* Un repère hors du cadre est caché plutôt que collé au bord : une pastille au
     bord dirait un lieu qui n'est pas là. */
  for (let k = 0; k < 2; k++) { await pgCarte.locator("#caToile").press("+"); await pgCarte.waitForTimeout(150); }
  await pgCarte.waitForTimeout(300);
  ok("un repère hors du cadre est caché",
    await pgCarte.locator(".ca-r:not([hidden])").count() === 1
    && await pgCarte.locator(".ca-r-ici:not([hidden])").count() === 1,
    `${await pgCarte.locator(".ca-r:not([hidden])").count()} repères visibles`);
  for (let k = 0; k < 2; k++) { await pgCarte.locator("#caToile").press("-"); await pgCarte.waitForTimeout(150); }
  await pgCarte.waitForTimeout(300);
  ok("l'échelle écrite reste une longueur ronde",
    /^(1|2|5|10|20|50|100|200|500) km$/.test((await txtDe(pgCarte, ".ca-echelle span")).trim()),
    await txtDe(pgCarte, ".ca-echelle span"));

  /* Le zoom reste entre ses bornes : au delà, le pas de la grille des contours se
     verrait, et en deçà il n'y aurait plus rien à lire. */
  ok("le zoom reste entre ses bornes", await pgCarte.evaluate(async () => {
    const C = await import("/src/carte.js");
    const haut = C.borner({ lat: 47.5, lon: 4.3, z: 99 });
    const bas = C.borner({ lat: 47.5, lon: 4.3, z: -5 });
    if (haut.z !== C.ZMAX) return `haut ${haut.z}`;
    if (bas.z !== C.ZMIN) return `bas ${bas.z}`;
    const loin = C.borner({ lat: 12, lon: 60, z: 8 });
    if (loin.lat > 53 || loin.lon > 13) return `centre ${loin.lat}, ${loin.lon}`;
    return "";
  }) === "");
  /* La projection et son inverse se répondent : c'est ce qui garantit qu'un point
     touché est bien le point du globe qu'on croit toucher. */
  ok("la projection et son inverse se répondent", await pgCarte.evaluate(async () => {
    const C = await import("/src/carte.js");
    const vue = { lat: 47.5, lon: 4.3, z: 8 };
    for (const [x, y] of [[0, 0], [120, 300], [389, 600]]) {
      const p = C.depuisEcran(vue, x, y, 390, 700);
      const e = C.surEcran(vue, p.lat, p.lon, 390, 700);
      if (Math.abs(e.x - x) > 0.01 || Math.abs(e.y - y) > 0.01) {
        return `${x},${y} devient ${e.x.toFixed(2)},${e.y.toFixed(2)}`;
      }
    }
    return "";
  }) === "");

  /* Un déplacement au doigt emmène la carte, et le bouton de retour la ramène sur
     le lieu courant. */
  const centreDuRepere = () => pgCarte.evaluate(() => {
    const cv = document.getElementById("caToile");
    const r = document.querySelector(".ca-r-ici");
    if (!cv || !r || r.hidden) return null;
    const b = cv.getBoundingClientRect(), p = r.getBoundingClientRect();
    return [Math.round((p.left + 11) - (b.left + b.width / 2)),
      Math.round((p.top + 11) - (b.top + b.height / 2))];
  });
  const cadreCarte = await pgCarte.locator("#caToile").boundingBox();
  /* Le geste part d'un point libre : au centre exact se tient le repère du lieu
     courant, et l'appui y ouvrirait la commune au lieu de déplacer la carte. */
  const dep = { x: cadreCarte.x + cadreCarte.width / 2,
    y: cadreCarte.y + cadreCarte.height / 2 + 200 };
  await pgCarte.mouse.move(dep.x, dep.y);
  await pgCarte.mouse.down();
  await pgCarte.mouse.move(dep.x - 90, dep.y - 60, { steps: 6 });
  await pgCarte.mouse.up();
  await pgCarte.waitForTimeout(400);
  const apresGlissement = await centreDuRepere();
  ok("le doigt déplace la carte",
    !!apresGlissement && Math.abs(apresGlissement[0] + 90) < 6 && Math.abs(apresGlissement[1] + 60) < 6,
    JSON.stringify(apresGlissement));
  await pgCarte.locator("#caIci").click();
  await pgCarte.waitForTimeout(400);
  const apresRetour = await centreDuRepere();
  ok("le retour ramène la carte sur le lieu courant",
    !!apresRetour && Math.abs(apresRetour[0]) < 2 && Math.abs(apresRetour[1]) < 2,
    JSON.stringify(apresRetour));

  /* Un appui sur le repère d'un lieu suivi bascule la commune, comme une rangée
     de la liste des lieux. */
  const nomAvant = await txtDe(pgCarte, "#navLieuNom");
  const echelleAvant = (await txtDe(pgCarte, "#caEchelle span")).trim();
  /* Cinq secondes suffisent : un repère qui ne paraît pas est une faute, et
     l'attente par défaut de trente secondes ferait durer la suite d'autant à
     chaque contrôle d'une fonction cassée. */
  await pgCarte.locator('.ca-r:not(.ca-r-ici)').first().click({ timeout: 5000 })
    .catch(() => {});
  await reposer(pgCarte, 1800);
  const nomApres = await txtDe(pgCarte, "#navLieuNom");
  ok("un appui sur un repère bascule la commune",
    nomAvant !== nomApres && nomApres.length > 1, `${nomAvant} puis ${nomApres}`);

  /* Le changement de commune relance une lecture complète, donc plusieurs rendus.
     Le cadrage doit tenir : on vient de toucher un point de la carte, et la carte
     n'a aucune raison de sauter ailleurs. */
  ok("le cadrage tient à travers un changement de commune",
    (await txtDe(pgCarte, "#caEchelle span")).trim() === echelleAvant,
    `${echelleAvant} puis ${(await txtDe(pgCarte, "#caEchelle span")).trim()}`);
  /* Le cadrage garde sa place d'un rendu à l'autre, et un appui sur l'onglet La
     carte le ramène sur la France. Sans cette mémoire, chaque source qui arrive
     ferait revenir la carte à son cadrage d'ouverture pendant qu'on la déplace. */
  const cadreDit = await pgCarte.evaluate(async () => {
      const lu = () => document.querySelector("#caEchelle span").textContent;
      const onglet = document.querySelector('[data-onglet="carte"]');
      const dodo = m => new Promise(r => setTimeout(r, m));
      // Un appui sur l'onglet déjà actif ramène le cadrage sur la France.
      onglet.click(); await dodo(700);
      const france = lu();
      for (let k = 0; k < 3; k++) document.getElementById("caToile").dispatchEvent(new KeyboardEvent("keydown", { key: "+", bubbles: true }));
      await dodo(500);
      if (lu() === france) return "le zoom n'a pas changé l'échelle";
      onglet.click(); await dodo(700);
      return lu() === france ? ""
        : `après l'appui sur l'onglet, échelle ${lu()} au lieu de ${france}`;
  });
  ok("un appui sur l'onglet ramène le cadrage sur la France", cadreDit === "", cadreDit);

  /* ---------- La vigilance sur la carte ----------

     Un seul appel rend le niveau de chaque département. Mesuré le 7 septembre
     2026 : 1181 octets compressés pour 201 sous-domaines, dont les 96 départements
     métropolitains. Les autres sont des massifs et des zones côtières, que la
     carte ne dessine pas.

     Les anneaux de remplissage viennent de la même topologie que les traits : la
     teinte épouse donc exactement le trait, sans décalage à fort zoom. */

  ok("la topologie rend un anneau fermé par département",
    await pgCarte.evaluate(async () => {
      const G = await import("/src/geographie.js");
      const codes = G.codesDepartements();
      if (codes.length !== 96) return `${codes.length} départements`;
      for (const c of ["21", "2A", "2B", "75", "29"]) {
        const a = G.anneauxDe(c);
        if (!a || !a.length) return `${c} sans anneau`;
        for (const r of a) {
          if (r.length < 8) return `${c} : anneau de ${r.length / 2} points`;
          const dx = Math.abs(r[0] - r[r.length - 2]);
          const dy = Math.abs(r[1] - r[r.length - 1]);
          if (dx > 1e-9 || dy > 1e-9) return `${c} : anneau non fermé`;
        }
      }
      return G.anneauxDe("ZZ") === null ? "" : "un code inconnu rend un anneau";
    }) === "");

  /* Le trait et la teinte viennent des mêmes points : les arcs du contour et des
     limites intérieures sont ceux que les anneaux enchaînent. */
  ok("le trait et la teinte partagent leurs points",
    await pgCarte.evaluate(async () => {
      const G = await import("/src/geographie.js");
      const c = G.contours();
      const dansTrait = new Set();
      for (const l of [...c.contour, ...c.departements]) {
        for (let i = 0; i < l.length; i += 2) {
          dansTrait.add(`${l[i].toFixed(6)},${l[i + 1].toFixed(6)}`);
        }
      }
      for (const code of ["21", "44", "33"]) {
        for (const r of G.anneauxDe(code)) {
          for (let i = 0; i < r.length; i += 2) {
            if (!dansTrait.has(`${r[i].toFixed(6)},${r[i + 1].toFixed(6)}`)) {
              return `${code} : un point d'anneau manque au trait`;
            }
          }
        }
      }
      return "";
    }) === "");

  ok("la couche de vigilance teinte les départements en alerte",
    await pgCarte.evaluate(async () => {
      const cv = document.getElementById("caToile");
      const ctx = cv.getContext("2d");
      const C = await import("/src/carte.js");
      const dodo = m => new Promise(r => setTimeout(r, m));
      /* La pluie s'éteint : sa nappe couvre tout et masquerait la teinte. */
      const pluie = document.getElementById("caPluie");
      if (pluie.getAttribute("aria-checked") === "true") {
        document.getElementById("caSansNappe").click(); await dodo(500);
      }
      await dodo(600);
      const vue = { lat: 47.5, lon: 4.3, z: 8 };
      const lire = (la, lo) => {
        const cadre = cv.getBoundingClientRect();
        const p = C.surEcran({ lat: 46.4, lon: 2.2, z: 5.13 }, la, lo, cv.clientWidth, cv.clientHeight);
        const d = ctx.getImageData(Math.round(p.x * 2), Math.round(p.y * 2), 1, 1).data;
        return `${d[0]},${d[1]},${d[2]}`;
      };
      // Un point dans le Finistère, un dans la Loire-Atlantique, un en Gironde,
      // et un en Côte-d'Or qui reste au vert.
      const t = {
        f29: lire(48.3, -4.0), f44: lire(47.4, -1.6),
        f33: lire(44.8, -0.6), f21: lire(47.3, 4.8),
      };
      if (t.f29 === t.f21) return `Finistère et Côte-d'Or de la même teinte, ${t.f29}`;
      if (t.f44 === t.f29) return `deux niveaux de la même teinte, ${t.f44}`;
      if (t.f33 === t.f44) return `deux niveaux de la même teinte, ${t.f33}`;
      return "";
    }) === "");

  /* Un massif et une zone côtière paraissent dans la source. La carte ne dessine
     que les départements, et un identifiant qui n'en est pas un ne doit pas
     entrer dans la table. */
  ok("les massifs et les zones côtières n'entrent pas dans la table",
    await pgCarte.evaluate(async () => {
      const V = await import("/src/vigilance.js");
      const d = V.lirePays({ update_time: 1, subdomains_phenomenons_max_color: [
        { domain_id: "29", phenomenons_max_color: [{ phenomenon_id: "1", phenomenon_max_color_id: 3 }] },
        { domain_id: "MAS21", phenomenons_max_color: [{ phenomenon_id: "8", phenomenon_max_color_id: 4 }] },
        { domain_id: "0610", phenomenons_max_color: [{ phenomenon_id: "9", phenomenon_max_color_id: 4 }] },
        { domain_id: "2A", phenomenons_max_color: [{ phenomenon_id: "1", phenomenon_max_color_id: 2 }] },
      ] });
      if (!d) return "rien lu";
      const codes = [...d.niveaux.keys()].sort();
      return codes.join(",") === "29,2A" ? "" : `codes retenus : ${codes.join(",")}`;
    }) === "");

  /* Version 140, demande de Jérôme du 2 octobre 2026 : plus de boutons de
     zoom, et les sources derrière un bouton, fermées à l'arrivée, ouvertes au
     premier appui, refermées par un appui sur la carte. */
  ok("la carte n'a plus de boutons de zoom, et ses sources s'ouvrent derrière un bouton",
    await pgCarte.evaluate(async () => {
      const dodo = m => new Promise(r => setTimeout(r, m));
      const c = document.getElementById("caCredit"), b = document.getElementById("caSources");
      /* Trois commandes : les couches, le retour au lieu, la recherche. */
      if (document.querySelectorAll(".ca-outils .ca-o").length !== 3 || document.getElementById("caPlus")) return "des commandes en trop";
      if (!b) return "pas de bouton des sources";
      if (!c.hidden || c.getBoundingClientRect().height > 0) return "les sources sont affichées à l'arrivée";
      b.click(); await dodo(150);
      const ouvert = !c.hidden && c.getBoundingClientRect().height > 0 && b.getAttribute("aria-expanded") === "true"
        && /Contours IGN/.test(c.textContent);
      document.getElementById("caToile").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      await dodo(150);
      if (!ouvert) return "l'appui n'ouvre pas les sources";
      return c.hidden ? "" : "un appui sur la carte ne referme pas les sources";
    }) === "");

  ok("la mention de Météo-France paraît avec la couche de vigilance",
    await pgCarte.evaluate(async () => {
      const c = document.getElementById("caCredit");
      const v = document.getElementById("caVigi");
      const dodo = m => new Promise(r => setTimeout(r, m));
      const avec = /Vigilance Météo-France/.test(c.textContent);
      v.click(); await dodo(400);
      const sans = !/Vigilance Météo-France/.test(c.textContent);
      v.click(); await dodo(600);
      if (!avec) return "la mention manque quand la couche est allumée";
      return sans ? "" : "la mention reste quand la couche est éteinte";
    }) === "");

  /* Les contours embarqués : quatre couches, et une boîte qui tient dans la
     fenêtre que la carte peut montrer. Un contour hors fenêtre serait des octets
     servis pour une côte que personne ne verra. */
  ok("les contours se décodent et tiennent dans leur fenêtre",
    await pgCarte.evaluate(async () => {
      const G = await import("/src/geographie.js");
      const c = G.contours();
      const noms = ["contour", "departements", "terre", "bornes"];
      for (const n of noms) {
        if (!Array.isArray(c[n]) || !c[n].length) return `couche ${n} vide`;
        for (const l of c[n]) {
          for (let i = 0; i < l.length; i += 2) {
            if (l[i] < -9 || l[i] > 15 || l[i + 1] < 38 || l[i + 1] > 55) {
              return `${n} sort de la fenêtre : ${l[i].toFixed(2)}, ${l[i + 1].toFixed(2)}`;
            }
          }
        }
      }
      // Le contour du pays porte la Corse : sans elle, la carte oublierait une région.
      const corse = c.contour.some(l => {
        for (let i = 0; i < l.length; i += 2) {
          if (l[i] > 8.5 && l[i + 1] > 41.3 && l[i + 1] < 43.1) return true;
        }
        return false;
      });
      return corse ? "" : "la Corse manque au contour";
    }) === "");
  await ctxCarte.close();

  /* ---------- La pluie sur la carte ---------- */
};
