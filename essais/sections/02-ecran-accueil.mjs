/* Écran d'accueil. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */

export const titre = "Écran d'accueil";
export const avecPage = true;

export default async T => {
  const { pg, nav, ok, dire, phrasesConseils, txt } = T;
  ok("le jour est porté par le ciel, non par un titre d'écran",
    /^[A-ZÀ-Ý][a-zà-ÿ]+ \d{1,2} [a-zà-ÿ]+$/.test(await txt(".plein-titre > i"))
    && await pg.locator(".titre-ecran").count() === 0,
    await txt(".plein-titre > i"));
  ok("la commune ne s'écrit pas deux fois sur l'accueil",
    !(await txt(".plein-titre")).includes("Fain"), await txt(".plein-titre"));
  ok("le bandeau porte un grand chiffre", /\d+°/.test(await txt(".bd-deg")), await txt(".bd-deg"));
  /* Jalon 11 : huit tuiles, une par paramètre suivi, au lieu de quatre mesures. */
  /* Depuis le 30 septembre 2026, une neuvième, l'eau, qui arrive après la
     prévision : elle est attendue. */
  await pg.waitForFunction(() => document.querySelectorAll(".bd-m").length === 9, null, { timeout: 8000 }).catch(() => {});
  ok("l'accueil porte une tuile par paramètre suivi", await pg.locator(".bd-m").count() === 9);
  const mes = (await pg.locator(".bd-m i").allInnerTexts()).join(", ");
  ok("les tuiles sont nommées",
    mes.toLowerCase() === "ressenti, pluie, vent, ciel, humidité, indice uv, pression, air, l'eau", mes);
  const cj = await phrasesConseils(pg, ".cj-l");
  /* Trois lignes par bloc au plus : au-delà, un bloc cesse d'être un résumé. Six
     en tout au pire, comme du temps de la carte unique. */
  ok("trois lignes par bloc au plus", await pg.evaluate(() =>
    [...document.querySelectorAll("#ecran .section[data-bloc]")]
      .every(s => s.querySelectorAll(".cj-l").length <= 3)),
    cj.length + " lignes en tout");
  /* Une règle ne parle que si elle a quelque chose à dire : une phrase qui
     annonce qu'il ne se passe rien se lit cent fois pour rien apprendre. */
  ok("rien ne s'écrit pour dire qu'il n'y a rien",
    !/aucune lame|rien à signaler|pas de pluie/i.test(cj.join(" ")), cj.join(" | "));
  /* La page se lit en échelle de temps : trois blocs, du plus proche au plus
     lointain, chacun répondant à une question distincte. */
  const blocs = await pg.locator("#ecran .section[data-bloc] h2").allInnerTexts();
  ok("l'accueil se lit en trois blocs de temps",
    blocs[0] === "Aujourd'hui" && blocs[1] === "Les 24 prochaines heures"
    && /^(Demain|Après-demain|Demain et après-demain)$/.test(blocs[2] || ""),
    blocs.join(" | "));

  /* Chaque bloc ne parle que de sa fenêtre. Le premier s'arrête à minuit, le
     dernier ne dit rien d'aujourd'hui, et son titre nomme les journées qu'il
     porte, ni plus ni moins. */
  ok("chaque bloc s'en tient à sa fenêtre", await pg.evaluate(() => {
    const q = c => document.querySelector(`#ecran .section[data-bloc="${c}"]`);
    const lignes = s => (s ? [...s.querySelectorAll(".cj-l")].map(e => (e.dataset.phrase || e.textContent)) : []);
    const jour = lignes(q("jour")).join(" ");
    if (/demain/.test(jour)) return `aujourd'hui parle de demain : ${jour}`;
    const suite = q("suite");
    if (!suite) return "";
    const vus = new Set();
    for (const l of lignes(suite)) {
      if (/après-demain/.test(l)) vus.add(2);
      else if (/demain/.test(l)) vus.add(1);
      else return `une ligne sans journée : ${l}`;
    }
    const titre = suite.querySelector("h2").textContent;
    const attendu = vus.size === 2 ? "Demain et après-demain"
      : vus.has(2) ? "Après-demain" : "Demain";
    return titre === attendu ? "" : `titre ${titre} pour ${[...vus].join(",")}`;
  }) === "", await pg.evaluate(() =>
    [...document.querySelectorAll("#ecran .section[data-bloc] h2")]
      .map(e => e.textContent).join(" | ")));
  ok("aucune ligne ne se répète", new Set(cj).size === cj.length);

  /* La comparaison avec la veille. « Dix-sept degrés » ne se juge que par rapport
     à quelque chose, et la veille est la seule référence que tout le monde a en
     tête. La charge d'essai porte vingt-trois degrés hier à neuf heures et
     dix-sept aujourd'hui. */
  /* Depuis le jalon 11, le conseil s'affiche en deux lignes ; sa phrase entière
     reste dans le libellé lu à voix haute, qui se compare ici. */
  const cjVeille = await pg.evaluate(() => [...document.querySelectorAll("#ecran .cj-l")]
    .map(l => l.dataset.phrase || l.textContent).find(t => /qu'hier/.test(t)) || "");
  ok("la comparaison avec la même heure la veille s'écrit",
    cjVeille.trim() === "6 degrés de moins qu'hier à la même heure, 17° contre 23°.",
    cjVeille || "aucune ligne");
  ok("elle se pose dans le bloc du jour, non dans celui qui suit",
    await pg.evaluate(() => {
      const dans = c => [...document.querySelectorAll(
        `#ecran .section[data-bloc="${c}"] .cj-l`)].some(e => /qu'hier/.test((e.dataset.phrase || e.textContent)));
      return dans("jour") && !dans("suite");
    }));
  /* Les fenêtres partent toutes de l'heure en cours : aucune règle ne peut parler
     d'une heure écoulée, la journée d'hier étant chargée. La comparaison est la
     seule à regarder en arrière, et elle n'écrit aucune heure. */
  ok("aucune règle ne se déclenche sur une heure écoulée", await pg.evaluate(() => {
    const h = new Date().getHours();
    const t = [...document.querySelectorAll('#ecran .section[data-bloc="jour"] .cj-l')]
      .map(e => e.dataset.phrase || e.textContent).join(" ");
    const vues = [...t.matchAll(/(\d\d) h/g)].map(m => Number(m[1]));
    const tot = vues.filter(x => x < h);
    return tot.length ? `${tot.join(", ")} avant ${h} h` : "";
  }) === "", await pg.evaluate(() =>
    [...document.querySelectorAll('#ecran .section[data-bloc="jour"] .cj-l')]
      .map(e => e.dataset.phrase || e.textContent).join(" | ")));
  ok("aucun verbe de jardin", !/arros|voiler|tuteur|repiquage|ombrer|plant/i.test(cj.join(" ")), cj.join(" | "));
  const alertesTxt = (await pg.locator(".al").allInnerTexts()).join(" ").toLowerCase();
  const conseilsTxt = cj.join(" ").toLowerCase();
  const motsCommuns = ["rafales", "gel probable", "indice uv", "mm attendus"]
    .filter(m => alertesTxt.includes(m) && conseilsTxt.includes(m));
  ok("les alertes ne répètent pas les conseils", motsCommuns.length === 0, motsCommuns.join(", "));
  /* Le mot ne doit pas paraître deux fois, en tuile et en ligne de conseil. Zéro
     fois est un état normal : la tuile cède sa place à la pluie quand le ressenti
     ne s'écarte pas du maximum du jour. */
  ok("le ressenti n'est pas écrit deux fois sur l'accueil",
    ((await txt("#ecran")).toLowerCase().match(/ressenti/g) || []).length <= 1);
  ok("la vigilance ouvre son détail depuis l'accueil",
    await pg.locator('#ecran .vg-c[data-feuille="vigilance"]').count() === 1);
  /* Audit du 1er octobre 2026, lot D, l'accessibilité. Constats 4.1 à 4.3 : la
     température et le ciel se lisent avec leur valeur, la vigilance nomme ses
     phénomènes, les heures de la bande restent des boutons et disent leur ciel. */
  const a11yDit = await pg.evaluate(() => {
    const deg = document.querySelector("#ecran .bd-deg"), ciel = document.querySelector("#ecran .bd-ciel");
    const vg = document.querySelector("#ecran .vg-c");
    const noms = [...(vg?.querySelectorAll(".vg-a b") || [])].map(x => x.textContent);
    const heures = [...document.querySelectorAll("#bande .bh-heure")];
    return {
      deg: `${deg?.getAttribute("aria-label")} | ${parseInt(deg?.textContent, 10)}`,
      ciel: `${ciel?.getAttribute("aria-label")} | ${ciel?.textContent}`,
      phenomenes: noms.length > 0 && noms.every(x => vg.getAttribute("aria-label").includes(x)),
      roles: heures.length > 0 && heures.every(h => !h.hasAttribute("role"))
        && !document.querySelector('#bande [role="list"], #bande [role="listitem"]'),
      cielHeure: heures.length > 0 && heures.every(h => !/degrés/.test(h.getAttribute("aria-label").split(", ")[1] || "degrés")),
    };
  });
  ok("la température et le ciel de l'accueil se lisent avec leur valeur",
    a11yDit.deg.startsWith(`${a11yDit.deg.split(" | ")[1]} degrés, `)
    && a11yDit.ciel.split(" | ")[0].startsWith(`${a11yDit.ciel.split(" | ")[1]}, `), JSON.stringify(a11yDit));
  ok("la vigilance nomme ses phénomènes aux lecteurs d'écran", a11yDit.phenomenes, JSON.stringify(a11yDit));
  ok("les heures de la bande restent des boutons et disent leur ciel",
    a11yDit.roles && a11yDit.cielHeure, JSON.stringify(a11yDit));

  /* Constat 4.4, sur la fonction seule : la colonne du ciel porte le nom du
     ciel en texte lu. */
  const tableLu = await pg.evaluate(async () => {
    const E = await import("/src/ecritures.js"), I = await import("/src/icones.js");
    const un = v => [v];
    const html = E.liste({ n: 1, t: un(20), res: un(20), ros: un(10), hum: un(50), mm: un(0), pb: un(0), code: un(3),
      nua: un(90), pres: un(1015), v: un(5), raf: un(10), dir: un(0), uv: un(1), clair: un(1), jour: un("2026-08-18"), heure: un(12) });
    return html.includes(`<span class="titre-lu">${I.tempsDe(3)[1]}</span>`);
  });
  ok("la colonne du ciel se lit dans le tableau des heures", tableLu === true);

  /* Constat 4.5 : le texte tertiaire et le bleu de la pluie écrit en texte
     atteignent 4,5 de contraste sur le fond et les cartes, dans les deux
     thèmes. */
  const contrasteDe = () => pg.evaluate(() => {
    const v = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
      .map(x => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    const r = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    return Math.min(...["--etiquette-3", "--pluie-texte"].flatMap(t => ["--fond", "--surface"].map(f => r(v(t), v(f)))));
  });
  const contrastes = { clair: await contrasteDe() };
  await pg.emulateMedia({ colorScheme: "dark" });
  contrastes.sombre = await contrasteDe();
  await pg.emulateMedia({ colorScheme: "light" });
  ok("le texte tertiaire et le bleu de la pluie atteignent 4,5 de contraste dans les deux thèmes",
    contrastes.clair >= 4.5 && contrastes.sombre >= 4.5, JSON.stringify(contrastes));

  /* Constat 4.7 : chaque petite commande offre au doigt 44 points au moins,
     mesurés sur des éléments posés pour l'occasion. */
  const touches = await pg.evaluate(() => {
    const cas = [["button", "nav-jeton"], ["button", "ca-jouer"], ["button", "cmp-puce"], ["button", "ci-bouton"],
      ["div.ci-choix>button", ""], ["div.ca-moments>button", ""]];
    const hors = document.createElement("div");
    document.body.append(hors);
    const out = {};
    for (const [quoi, cls] of cas) {
      const [parent, enfant] = quoi.includes(">") ? quoi.split(">") : [null, quoi];
      let racine = hors;
      if (parent) { const p = document.createElement("div"); p.className = parent.split(".")[1]; p.style.position = "static"; hors.append(p); racine = p; }
      const e = document.createElement(enfant); if (cls) e.className = cls; e.textContent = "x"; racine.append(e);
      const z = getComputedStyle(e, "::after");
      out[cls || parent] = Math.min(parseFloat(z.width) || 0, parseFloat(z.height) || 0);
    }
    const sel = document.createElement("select"); sel.className = "rg-h"; hors.append(sel);
    out["rg-h"] = sel.getBoundingClientRect().height;
    hors.remove();
    return out;
  });
  ok("les petites commandes offrent 44 points au doigt", Object.values(touches).every(x => x >= 44), JSON.stringify(touches));

  /* Constat 4.11 : la page et le manifeste ne décrivent plus la table de la
     semaine. */
  const descriptions = await pg.evaluate(async () => [
    document.querySelector('meta[name="description"]')?.content || "",
    (await (await fetch("/manifest.webmanifest")).json()).description || ""]);
  ok("la page et le manifeste se décrivent avec les noms d'écrans actuels",
    descriptions.every(d => d && !/semaine/.test(d)), descriptions.join(" | "));
  ok("l'accueil ne porte plus de tuiles", await pg.locator(".tu").count() === 0);
  ok("une valeur ne prend une couleur qu'au delà de son seuil", await pg.evaluate(() => {
    const v = [...document.querySelectorAll(".bd-m")].map(e => ({
      nom: e.querySelector("i").textContent,
      classe: e.querySelector("b").className,
    }));
    const hum = v.find(x => x.nom === "Humidité");
    const pluie = v.find(x => x.nom === "Pluie");
    const uv = v.find(x => x.nom === "Indice UV");
    /* Depuis le 3 octobre 2026, les tuiles portent sur les heures à venir
       jusqu'à minuit : dans le jeu figé, indice UV 7, humidité 89 %, risque de
       pluie 8 %. Le premier signale, les deux autres non. */
    return uv.classe === "v-chaud" && hum.classe === "" && pluie.classe === "";
  }));
  ok("le symbole d'un conseil porte la couleur de son sujet", await pg.evaluate(() => {
    const g = document.querySelector(".cj-l .icv-goutte");
    if (!g) return false;
    const c = getComputedStyle(g).color;
    return c !== getComputedStyle(document.body).color;
  }));
  /* Jalon 10 : les quatre chiffres passent sur une ligne, et le titre 3 les garde
     au-dessus du corps de texte ; le titre 2 ne tenait pas dans une cellule. */
  ok("les chiffres des mesures sont au moins à l'échelle du titre 3", await pg.evaluate(() => {
    const b = document.querySelector(".bd-m b");
    const t2 = parseFloat(getComputedStyle(document.documentElement)
      .getPropertyValue("--texte-titre3")) * parseFloat(getComputedStyle(document.documentElement).fontSize);
    return parseFloat(getComputedStyle(b).fontSize) >= t2 - 0.5;
  }));
};
