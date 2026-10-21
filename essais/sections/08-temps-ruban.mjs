/* Le temps, ruban. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs.

   Depuis la version 232, la page ne dessine plus qu'une voie à la fois, celle
   de la porte, en grand : chaque règle du tracé se vérifie voie par voie, en
   passant d'une grandeur à l'autre par les pastilles. */

export const titre = "Le temps, ruban";
export const avecPage = true;

export default async T => {
  const { pg, ok, txt, onglet, ouvrirVoie } = T;
  await onglet("temps");
  /* Ce qui mérite d'être retenu se lit sur l'accueil, sous « À retenir ». Le
     répéter en tête du temps redisait les mêmes phrases un écran plus loin, à
     l'endroit où l'on vient justement chercher le détail. */
  ok("les conseils ne se répètent pas sur l'écran du temps",
    await pg.locator("#ecran .conseils").count() === 0);
  ok("« Plus de détails » ouvre la vue d'ensemble, titrée Heure par heure",
    (await txt(".hh-grand")) === "Heure par heure" && await pg.locator('.hh-page[data-vue="ensemble"]').count() === 1,
    await txt(".hh-grand"));
  ok("aucune feuille n'est ouverte", await pg.locator("#feuille:visible").count() === 0);

  await ouvrirVoie(pg, "t");
  ok("une grandeur ouvre la vue ciblée, titrée de son nom",
    (await txt(".hh-grand")) === "Température" && await pg.locator('.hh-page[data-vue="ciblee"]').count() === 1,
    await txt(".hh-grand"));
  ok("la vue ciblée ne dessine qu'une voie, la sienne",
    await pg.locator(".mg-v").count() === 1 && await pg.locator('.mg-v[data-cle="t"].mg-grand').count() === 1,
    String(await pg.locator(".mg-v").count()));
  const puces = (await pg.locator(".hh-puce").allInnerTexts()).map(x => x.trim().toLowerCase()).join(",");
  /* L'ordre des tuiles des mesures du jour de l'accueil, version 238. */
  const tuiles = await pg.evaluate(() => [...document.querySelectorAll("#ecran .hh-puce")].map(p => p.dataset.grandeur).join());
  ok("sept pastilles, dans l'ordre des tuiles de l'accueil", puces === "temp.,pluie,vent,ciel,humidité,uv,pression"
    && tuiles === "t,mm,v,nua,hum,uv,pres", `${puces} ; ${tuiles}`);
  ok("la pastille de la grandeur ouverte est pressée",
    await pg.locator('.hh-puce[aria-pressed="true"]').getAttribute("data-grandeur") === "t");
  ok("les sept pastilles tiennent sur deux rangées, sans défilement de côté", await pg.evaluate(() => {
    const p = [...document.querySelectorAll(".hh-puce")].map(e => e.getBoundingClientRect());
    const rangs = new Set(p.map(r => Math.round(r.top)));
    return rangs.size === 2 && p.every(r => r.left >= 0 && r.right <= innerWidth);
  }));
  ok("l'axe des heures est posé", await pg.locator(".mg-bd .mg-bh").count() >= 3);
  /* La page est en plein ciel depuis la version 232 : le ciel du lieu
     derrière, sans l'en-tête du lieu, le retour en disque de verre. */
  ok("« Heure par heure » se lit en plein ciel, sans l'en-tête du lieu", await pg.evaluate(() => {
    const r = document.documentElement.classList;
    const e = document.getElementById("enteteCiel");
    return r.contains("plein-ciel") && r.contains("ciel-detail") && getComputedStyle(e).display === "none"
      && !!document.querySelector("#ecran .plein-heures #ciTemps") && !!document.getElementById("btnRetour");
  }));

  /* Chaque voie s'ouvre par sa pastille ; la fonction reçoit la clé et rend
     une chaîne vide si tout va bien. */
  const CLES = ["nua", "t", "mm", "v", "uv", "hum", "pres"];
  const parVoie = async (cles, f) => {
    const fautes = [];
    for (const c of cles) {
      await pg.locator(`.hh-puce[data-grandeur="${c}"]`).click();
      await pg.waitForTimeout(250);
      const r = await pg.evaluate(f, c);
      if (r) fautes.push(`${c} : ${r}`);
    }
    return fautes.join(" ; ");
  };

  const titres = await parVoie(CLES, c => {
    const t = document.querySelector(".hh-grand")?.textContent;
    const v = document.querySelectorAll(".mg-v");
    return v.length === 1 && v[0].dataset.cle === c && t ? "" : `${v.length} voies, titre ${t}`;
  });
  ok("chaque pastille ouvre sa voie, seule, sous son titre", titres === "", titres);

  await pg.locator('.hh-puce[data-grandeur="uv"]').click();
  await pg.waitForTimeout(250);
  const uv = await txt(".hh-phrase");
  ok("la phrase de l'indice UV porte une heure ou un chiffre", /\d/.test(uv), uv);

  /* Le ciel garde sa bande de symboles au-dessus du tracé. */
  await pg.locator('.hh-puce[data-grandeur="nua"]').click();
  await pg.waitForTimeout(250);
  ok("le ciel porte sa bande de symboles", await pg.evaluate(() => {
    const v = document.querySelector('.mg-v[data-cle="nua"]');
    const ic = [...v.querySelectorAll("svg.mg-ic")];
    if (ic.length < 6) return `${ic.length} symboles`;
    return "";
  }) === "", String(await pg.locator('.mg-v[data-cle="nua"] svg.mg-ic').count()));
  /* La coupe du ciel, version 236 : les étages se dessinent à leur
     altitude, et la liste porte une barre par étage. Les faux services ne
     portent que des nuages bas ; des nuages moyens et hauts sont posés dans
     la charge, à partir de l'heure en cours, puis la voie se redessine. */
  await pg.evaluate(async () => {
    const P = await import("/src/previsions.js");
    const h = P.chargeCourante().hourly;
    const i = h.time.indexOf(h.time.find(t => t.endsWith("T09:00") && t.startsWith("2026-08-18")));
    for (let k = i; k < i + 24; k++) { h.cloud_cover_mid[k] = 80; h.cloud_cover_high[k] = k >= i + 3 ? 90 : 0; }
  });
  await pg.locator('.hh-puce[data-grandeur="t"]').click();
  await pg.waitForTimeout(250);
  await pg.locator('.hh-puce[data-grandeur="nua"]').click();
  await pg.waitForTimeout(400);
  const coupe = await pg.evaluate(() => {
    const v = document.querySelector('.mg-v[data-cle="nua"]');
    const svg = v?.querySelector("svg.mg-s");
    if (!svg) return { faute: "voie absente" };
    const graduation = t => [...svg.querySelectorAll("text.mg-g")].find(e => e.textContent.replace(/\s/g, " ") === t);
    const yDe = t => graduation(t)?.getBoundingClientRect().top;
    const y2 = yDe("2 km"), y6 = yDe("6 km");
    const centres = sel => [...svg.querySelectorAll(sel)].map(e => { const r = e.getBoundingClientRect(); return r.top + r.height / 2; });
    const bas = centres("ellipse.mg-nb"), moy = centres("ellipse.mg-nm"), hauts = centres("path.mg-nh");
    return { y2, y6, nb: bas.length, nm: moy.length, nh: hauts.length,
      basSous2: bas.every(y => y > y2), moyEntre: moy.every(y => y < y2 + 8 && y > y6 - 8), hautsAu6: hauts.every(y => y < y6) };
  });
  ok("la coupe du ciel dessine chaque étage à son altitude",
    coupe.y2 && coupe.y6 && coupe.nb > 0 && coupe.nm > 0 && coupe.nh > 0 && coupe.basSous2 && coupe.moyEntre && coupe.hautsAu6,
    JSON.stringify(coupe));
  const phraseCiel = (await txt(".hh-phrase")).replace(/[\u00A0\u202F]/g, " ");
  ok("la phrase du ciel nomme ses étages et l'heure où le voile arrive",
    /, nuages moyens ; voile d'altitude dès 12 h ; nuages bas dès demain 00 h\.$/.test(phraseCiel), phraseCiel);
  const barres = await pg.evaluate(() => ({
    lignes: document.querySelectorAll(".hh-de-nua .hh").length,
    trois: [...document.querySelectorAll(".hh-de-nua .hh")].every(l => l.querySelectorAll(".hh-etages > .hh-piste > b").length === 3),
    legende: document.querySelector(".hh-de-nua .hh-legende")?.textContent || "" }));
  ok("la liste du ciel porte une barre par étage et nomme les étages",
    barres.lignes >= 20 && barres.trois && /Hauts, au-dessus de 6 km/.test(barres.legende) && /Bas, sous 2 km/.test(barres.legende),
    JSON.stringify(barres));
  /* Depuis le 3 octobre 2026, un seul axe : le bandeau collant en tête du
     ruban. Les axes sous les voies écrivaient les heures autrement. */
  ok("un seul axe des heures, en tête du ruban, aucune voie n'en porte",
    await pg.locator(".mg-v .mg-a, .mg-a").count() === 0 && await pg.locator(".mg-bd .mg-bh").count() >= 3,
    String(await pg.locator(".mg-a").count()));
  ok("aucun montant de lecture visible au repos", await pg.locator(".mg-cur:visible").count() === 0);
  await pg.locator('.hh-puce[data-grandeur="v"]').click();
  await pg.waitForTimeout(250);
  const chVent = (await pg.locator('.mg-v[data-cle="v"]').locator("text.mg-g").allTextContents())
    .map(x => String(x ?? "").replace(/\s|km\/h/g, "")).filter(Boolean);
  ok("le seuil du vent ne se superpose pas à la graduation",
    new Set(chVent).size === chVent.length, chVent.join(" | "));

  /* ---- La grammaire du tracé ---- */

  /* L'échelle vit dans la gouttière de droite, hors du tracé. Posée dedans, elle
     traversait les courbes : « 20 km/h » coupait la ligne du vent. */
  const gouttiere = await parVoie(CLES, () => {
    const t = [...document.querySelectorAll(".mg-s text.mg-g")];
    return t.every(e => Number(e.getAttribute("x")) >= 324) ? "" : "dans le tracé";
  });
  ok("l'échelle se tient dans la gouttière", gouttiere === "", gouttiere);

  /* Deux chiffres d'échelle au même point se lisaient « 2,8 m2,5 ». */
  const echelles = await parVoie(CLES, () => {
    for (const v of document.querySelectorAll(".mg-v")) {
      const y = [...v.querySelectorAll("text.mg-g")].map(e => Number(e.getAttribute("y")));
      for (let a = 0; a < y.length; a++) {
        for (let b = a + 1; b < y.length; b++) if (Math.abs(y[a] - y[b]) < 7) return "superposés";
      }
    }
    return "";
  });
  ok("deux chiffres d'échelle ne se superposent pas", echelles === "", echelles);

  /* Les seuils nommés disent ce que vaut la valeur là où on la regarde. */
  const nommes = await parVoie(["v", "uv", "hum", "mm"], cle => {
    const attendu = { v: ["Léger", "Modéré", "Fort"], uv: ["Modéré", "Élevé"],
      hum: ["Humide", "Saturé"], mm: ["Modérée"] }[cle];
    const v = document.querySelector(`.mg-v[data-cle="${cle}"]`);
    if (!v) return "voie absente";
    const vus = [...v.querySelectorAll("text.mg-bn")].map(e => e.textContent);
    for (const m of attendu) if (!vus.includes(m)) return `sans ${m} (${vus.join("/")})`;
    return "";
  });
  ok("les échelles nommées portent leurs seuils dans le tracé", nommes === "", nommes);

  /* Le nom de bande cherche l'espace libre. Un mot posé sur l'aire pleine se
     noyait ; il se déporte au milieu ou à droite quand la gauche est prise. */
  const noms = await parVoie(["v", "hum", "uv", "mm"], seule => {
    const fautes = [];
    for (const cle of [seule]) {
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

  await pg.locator('.hh-puce[data-grandeur="v"]').click();
  await pg.waitForTimeout(250);
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

  /* Les barres de pluie prennent les trois intensités du mode pluie
     d'« À venir », version 232. */
  await pg.locator('.hh-puce[data-grandeur="mm"]').click();
  await pg.waitForTimeout(250);
  ok("les barres de pluie prennent les intensités du mode pluie", await pg.evaluate(() => {
    const b = [...document.querySelectorAll('.mg-v[data-cle="mm"] rect.mg-pl')];
    if (!b.length) return "aucune barre";
    const sp = getComputedStyle(document.documentElement).getPropertyValue("--sp-faible").trim();
    const el = document.createElement("div"); el.style.color = sp; document.body.append(el);
    const attendu = getComputedStyle(el).color; el.remove();
    const faibles = b.filter(r => r.classList.contains("mg-pl-faible"));
    return faibles.length && faibles.every(r => getComputedStyle(r).fill === attendu) ? "" : `${faibles.length} barres faibles`;
  }) === "");
  await pg.locator('.hh-puce[data-grandeur="t"]').click();
  await pg.waitForTimeout(250);
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
  await pg.locator('.hh-puce[data-grandeur="uv"]').click();
  await pg.waitForTimeout(250);
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
  ok("la nuit garde l'encre du texte, non la couleur de la voie", await pg.evaluate(() => {
    const r = document.querySelector('.mg-v[data-cle="uv"] rect.mg-nuit');
    const s = document.querySelector('.mg-v[data-cle="uv"] .mg-s');
    return getComputedStyle(r).fill !== getComputedStyle(s).color;
  }));
  const nuits = await parVoie(CLES, () => (document.querySelector(".mg-v rect.mg-nuit") ? "" : "sans nuit"));
  ok("la nuit est lavée sur chacune des sept voies", nuits === "", nuits);

  /* La phrase de résumé est un fait tiré de la série, non une notice : elle porte
     une heure ou un chiffre. */
  const faits = await parVoie(CLES, () => {
    const t = document.querySelector(".hh-phrase")?.textContent || "";
    return /\d/.test(t) ? "" : `« ${t.slice(0, 60)} »`;
  });
  ok("chaque voie résume un fait, non une notice", faits === "", faits);
};
