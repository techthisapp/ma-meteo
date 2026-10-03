/* Le temps, ruban. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */

export const titre = "Le temps, ruban";
export const avecPage = true;

export default async T => {
  const { pg, ok, txt, onglet } = T;
  await onglet("temps");
  /* Ce qui mérite d'être retenu se lit sur l'accueil, sous « À retenir ». Le
     répéter en tête du temps redisait les mêmes phrases un écran plus loin, à
     l'endroit où l'on vient justement chercher le détail. */
  ok("les conseils ne se répètent pas sur l'écran du temps",
    await pg.locator("#ecran .conseils").count() === 0);
  ok("l'écran s'ouvre sur Heure par heure", (await txt(".titre-ecran h1")) === "Heure par heure", await txt(".titre-ecran h1"));
  ok("aucune feuille n'est ouverte", await pg.locator("#feuille:visible").count() === 0);
  const voies = await pg.locator(".mg-v .mg-n").allInnerTexts();
  ok("sept voies", voies.length === 7, voies.join(", "));
  const nomsVoies = voies.map(v => v.replace(/[+−\n]/g, "").trim().toLowerCase()).join(",");
  ok("les voies sont les bonnes",
    nomsVoies === "ciel,température,pluie,vent,indice uv,humidité,pression", nomsVoies);
  ok("chaque voie porte une lecture à droite", (await pg.locator(".mg-r").count()) === 7);
  const uv = (await pg.locator('.mg-v[data-cle="uv"]').innerText());
  ok("l'indice UV porte son maximum et le mot qui le qualifie",
    /7[,.\d]*\s*au plus, (faible|modéré|élevé|très élevé|extrême)/.test(uv), uv.split("\n")[0]);
  ok("l'axe des heures est posé", await pg.locator(".mg-bd .mg-bh").count() >= 3);

  /* Le ciel ouvre la pile, et sa bande de symboles ne se mérite pas : c'est le
     dessin qu'on lit en un coup d'œil, il paraît replié comme déplié. L'axe le
     suit, sans quoi un symbole de pluie en tête de page ne dirait pas son heure. */
  ok("le ciel ouvre la pile",
    await pg.locator(".mg-v").first().getAttribute("data-cle") === "nua",
    await pg.locator(".mg-v").first().getAttribute("data-cle"));
  ok("les symboles du ciel paraissent voie repliée", await pg.evaluate(() => {
    const v = document.querySelector('.mg-v[data-cle="nua"]');
    if (v.classList.contains("mg-grand")) return "voie dépliée";
    const ic = [...v.querySelectorAll("svg.mg-ic")];
    if (ic.length < 6) return `${ic.length} symboles`;
    /* La bande leur est réservée : sans réserve de hauteur, les symboles se
       dessinent quand même, mais par-dessus les lames de densité. */
    const lames = [...v.querySelectorAll('rect[shape-rendering="crispEdges"]')];
    if (!lames.length) return "aucune lame de densité";
    const bas = Math.max(...ic.map(e => e.getBoundingClientRect().bottom));
    const haut = Math.min(...lames.map(e => e.getBoundingClientRect().top));
    return haut >= bas - 1 ? "" : `chevauchement de ${(bas - haut).toFixed(1)} points`;
  }) === "", String(await pg.locator('.mg-v[data-cle="nua"] svg.mg-ic').count()));
  /* Depuis le 3 octobre 2026, un seul axe : le bandeau collant en tête du
     ruban. Les axes sous les voies écrivaient les heures autrement. */
  ok("un seul axe des heures, en tête du ruban, aucune voie n'en porte",
    await pg.locator(".mg-v .mg-a, .mg-a").count() === 0 && await pg.locator(".mg-bd .mg-bh").count() >= 3,
    String(await pg.locator(".mg-a").count()));
  ok("aucun montant de lecture visible au repos", await pg.locator(".mg-cur:visible").count() === 0);
  const chVent = (await pg.locator('.mg-v[data-cle="v"]').locator("text.mg-g").allTextContents())
    .map(x => String(x ?? "").replace(/\s|km\/h/g, "")).filter(Boolean);
  ok("le seuil du vent ne se superpose pas à la graduation",
    new Set(chVent).size === chVent.length, chVent.join(" | "));

  /* ---- La grammaire du tracé ---- */

  /* L'échelle vit dans la gouttière de droite, hors du tracé. Posée dedans, elle
     traversait les courbes : « 20 km/h » coupait la ligne du vent. */
  ok("l'échelle se tient dans la gouttière", await pg.evaluate(() => {
    const t = [...document.querySelectorAll(".mg-s text.mg-g")];
    return t.length > 0 && t.every(e => Number(e.getAttribute("x")) >= 324);
  }), String(await pg.locator(".mg-s text.mg-g").count()));

  /* Deux chiffres d'échelle au même point se lisaient « 2,8 m2,5 ». */
  ok("deux chiffres d'échelle ne se superposent pas", await pg.evaluate(() => {
    for (const v of document.querySelectorAll(".mg-v")) {
      const y = [...v.querySelectorAll("text.mg-g")].map(e => Number(e.getAttribute("y")));
      for (let a = 0; a < y.length; a++) {
        for (let b = a + 1; b < y.length; b++) if (Math.abs(y[a] - y[b]) < 7) return false;
      }
    }
    return true;
  }));

  /* Les seuils nommés disent ce que vaut la valeur là où on la regarde. */
  ok("les échelles nommées portent leurs seuils dans le tracé", await pg.evaluate(() => {
    const attendu = { v: ["Léger", "Modéré", "Fort"], uv: ["Modéré", "Élevé"],
      hum: ["Humide", "Saturé"], mm: ["Modérée"] };
    for (const [cle, mots] of Object.entries(attendu)) {
      const v = document.querySelector(`.mg-v[data-cle="${cle}"]`);
      if (!v) return `voie ${cle} absente`;
      const vus = [...v.querySelectorAll("text.mg-bn")].map(e => e.textContent);
      for (const m of mots) if (!vus.includes(m)) return `${cle} sans ${m} (${vus.join("/")})`;
    }
    return "";
  }) === "", await pg.evaluate(() =>
    [...document.querySelectorAll("text.mg-bn")].map(e => e.textContent).join("/")));

  /* Le nom de bande cherche l'espace libre. Un mot posé sur l'aire pleine se
     noyait ; il se déporte au milieu ou à droite quand la gauche est prise. */
  const noms = await pg.evaluate(() => {
    const fautes = [];
    for (const cle of ["v", "hum", "uv", "mm"]) {
      const voie = document.querySelector(`.mg-v[data-cle="${cle}"]`);
      if (!voie) continue;
      const svg = voie.querySelector("svg.mg-s");
      const m = svg.getScreenCTM();
      const ecran = (x, y) => ({ x: m.a * x + m.e, y: m.d * y + m.f });
      /* Une aire et un trait ne salissent pas de la même façon. L'aire couvre tout
         ce qui est sous sa courbe, un trait haut au-dessus du mot ne le touche
         pas : les deux se comptent séparément. */
      const traits = [], toits = [];
      for (const pl of svg.querySelectorAll("polyline")) {
        for (const p of (pl.getAttribute("points") || "").trim().split(/\s+/)) {
          const [x, y] = p.split(",").map(Number);
          if (Number.isFinite(x) && Number.isFinite(y)) traits.push(ecran(x, y));
        }
      }
      for (const pa of svg.querySelectorAll("path[fill]")) {
        const f = pa.getAttribute("fill");
        if (f === "none" || Number(pa.getAttribute("opacity") || 1) < 0.2) continue;
        for (const c of (pa.getAttribute("d") || "").matchAll(/([-\d.]+),([-\d.]+)/g)) {
          toits.push(ecran(Number(c[1]), Number(c[2])));
        }
      }
      /* Le rectangle d'une découpe n'est pas de l'encre, et le voile du passé non
         plus : il éloigne ce qui est dessous, il ne le cache pas. Ni l'un ni
         l'autre ne doit interdire une place au mot. */
      const barres = [...svg.querySelectorAll("rect")]
        .filter(r => !r.classList.contains("mg-nuit") && !r.classList.contains("mg-passe")
          && !r.closest("defs"))
        .map(r => r.getBoundingClientRect());
      /* Le tracé s'étend d'un bout à l'autre des filets de seuil : ce sont eux qui
         donnent la zone de dessin, sans avoir à refaire le calcul des marges. */
      const filets = [...svg.querySelectorAll("line")].filter(l =>
        Math.abs(Number(l.getAttribute("y1")) - Number(l.getAttribute("y2"))) < 0.01);
      if (!filets.length) continue;
      /* Les filets courent sur toute la bande dessinée, laquelle déborde le cadre
         de part et d'autre : la zone où poser un mot est l'intersection des deux. */
      const f0 = filets[0].getBoundingClientRect(), cad = svg.getBoundingClientRect();
      const zone = { left: Math.max(f0.left, cad.left), right: Math.min(f0.right, cad.right) };
      const pris = (g, dr, haut, bas) =>
        traits.some(p => p.x > g && p.x < dr && p.y > haut && p.y < bas)
        || toits.some(p => p.x > g && p.x < dr && p.y < bas)
        || barres.some(r => r.right > g && r.left < dr && r.top < bas - 1);
      for (const t of voie.querySelectorAll("text.mg-bn")) {
        const b = t.getBoundingClientRect();
        /* Une ligne peut être prise sur toute sa longueur : on ne reproche au mot
           sa place que s'il en existait une nette. La recherche est plus exigeante
           que la pose, d'une marge de quatre points de chaque côté. */
        let libre = false;
        for (let g = zone.left; g + b.width + 10 <= zone.right && !libre; g += 4) {
          if (!pris(g, g + b.width + 10, b.top - 4, b.bottom + 4)) libre = true;
        }
        if (libre && pris(b.left - 2, b.right + 2, b.top + 1, b.bottom - 1)) {
          fautes.push(`${cle}/${t.textContent}`);
        }
      }
    }
    return fautes.join(", ");
  });
  ok("les noms de bande évitent l'encre quand ils le peuvent", noms === "", noms);

  /* Le liseré du nom doit être opaque : à trois quarts, il laissait passer l'aire
     qu'il devait masquer et le mot s'y noyait. */
  ok("le liseré des noms de bande est opaque", await pg.evaluate(() => {
    const st = getComputedStyle(document.querySelector("text.mg-bn"));
    return st.opacity === "1" && st.paintOrder.includes("stroke")
      && parseFloat(st.strokeWidth) >= 2;
  }));

  // Le vent porte ses flèches de direction, repliée comme dépliée.
  ok("le vent porte ses flèches de direction",
    await pg.locator('.mg-v[data-cle="v"] .mg-fl').count() >= 6,
    String(await pg.locator('.mg-v[data-cle="v"] .mg-fl').count()));

  // La rampe colore la courbe de température, en largeur comme en hauteur.
  ok("la rampe colore la température", await pg.evaluate(() => {
    const v = document.querySelector('.mg-v[data-cle="t"]');
    const lignes = [...v.querySelectorAll("polyline")];
    const rampee = lignes.some(e => /url\(#mgTx\)/.test(e.getAttribute("stroke") || ""));
    const aire = v.querySelector('path[fill^="url(#mgTy"]');
    return rampee && !!aire && v.querySelectorAll("linearGradient stop").length > 20;
  }));

  /* Les barres de l'indice ultraviolet prennent la couleur de leur niveau. La
     rampe va du violet clair au fuchsia intense depuis le 12 septembre 2026 :
     l'indice se lit à l'intensité, non à la chaleur de la teinte, et c'est la
     saturation qui doit monter avec lui. */
  ok("les barres UV prennent la couleur de leur niveau", await pg.evaluate(() => {
    const b = [...document.querySelectorAll('.mg-v[data-cle="uv"] rect[fill^="hsl"]')];
    if (b.length < 6) return false;
    const lu = e => (e.getAttribute("fill").match(/hsl\((\d+) (\d+)% (\d+)%/) || []).slice(1).map(Number);
    const c = b.map(lu).filter(v => v.length === 3);
    if (c.length < 6) return false;
    const h = c.map(v => v[0]), sat = c.map(v => v[1]);
    return new Set(h).size >= 3 && Math.max(...sat) > Math.min(...sat) + 15;
  }));

  /* La nuit prend l'encre du texte, non la couleur de la voie : lavée à la
     couleur, elle virait au jaune sur l'indice ultraviolet. */
  ok("la nuit traverse les sept voies", await pg.evaluate(() =>
    [...document.querySelectorAll(".mg-v[data-cle]")]
      .every(v => v.querySelector("rect.mg-nuit"))));
  ok("la nuit garde l'encre du texte, non la couleur de la voie", await pg.evaluate(() => {
    const r = document.querySelector('.mg-v[data-cle="uv"] rect.mg-nuit');
    const s = document.querySelector('.mg-v[data-cle="uv"] .mg-s');
    return getComputedStyle(r).fill !== getComputedStyle(s).color;
  }));

  /* La phrase de résumé est un fait tiré de la série, non une notice : elle porte
     une heure ou un chiffre. */
  ok("chaque voie résume un fait, non une notice", await pg.evaluate(() =>
    [...document.querySelectorAll(".mg-l")].every(e => /\d/.test(e.textContent))),
    (await pg.locator(".mg-l").first().innerText()).slice(0, 60));
};
