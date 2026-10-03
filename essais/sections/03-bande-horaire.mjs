/* La bande horaire. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */

export const titre = "La bande horaire";
export const avecPage = true;

export default async T => {
  const { pg, etat, ok, ouvrirLeTemps, txt, onglet, reposer } = T;
  /* Jalon 10, lot 1 : l'évolution de la journée d'un coup d'œil, sous le ciel,
     après les avis urgents. */
  const bandeDit = await pg.evaluate(async () => {
    const B = await import("/src/bande.js");
    const bande = document.getElementById("bande");
    const ordre = el => el ? [...document.querySelectorAll("#ecran *")].indexOf(el) : -1;
    const heure = Array.from({ length: 24 }, (_, k) => (13 + k) % 24);
    const serie = { n: 24, heure,
      mm: heure.map(h => h >= 15 && h <= 17 ? 0.2 : 0),
      pb: heure.map(h => h >= 15 && h <= 17 ? 90 : 10),
      raf: heure.map(h => h === 16 ? 55 : 30),
      t: heure.map(() => 20), v: heure.map(() => 20), code: heure.map(() => 3), clair: heure.map(() => 1) };
    const seche = { ...serie, mm: serie.mm.map(() => 0), pb: serie.pb.map(() => 5), raf: serie.raf.map(() => 30) };
    const defil = bande?.querySelector(".bande-defil");
    const premiere = bande?.querySelector(".bh-heure");
    return {
      presente: !!bande,
      /* Les avis urgents ne sont pas toujours là : chacun, quand il paraît, doit
         précéder la bande. */
      apresAvis: [".pp-c", ".vg-c"].every(q => {
        const el = document.querySelector(q);
        return !el || ordre(el) < ordre(bande);
      }),
      /* Depuis le 24 septembre 2026, les chiffres du jour précèdent la bande,
         et les portes la suivent en grille. */
      /* Depuis le second dessin, jalon 11 : la bande précède les conseils et les
         tuiles des paramètres. */
      avantTuiles: ordre(bande) < ordre(document.querySelector('[data-bloc="jour"] .tuiles')),
      destinations: [...document.querySelectorAll(".tuiles .tuile")].map(t =>
        t.dataset.detail || (t.dataset.feuille ? "feuille:" + t.dataset.feuille : "")),
      avantPortes: ordre(bande) < ordre(document.querySelector(".portes")),
      /* Les portes ferment l'accueil depuis le 24 septembre 2026 : après les
         24 prochaines heures et demain, avant la ligne des sources. */
      portesEnBas: (() => {
        const p = ordre(document.querySelector(".portes"));
        const avant = document.querySelector('[data-bloc="suite"]') || document.querySelector('[data-bloc="h24"]');
        /* La ligne des sources est retirée au jalon 20 : seul le pied de la
           vigilance muette peut encore suivre les portes. */
        const pied = document.querySelector("#ecran .pied");
        return p > ordre(avant) && (!pied || p < ordre(pied));
      })(),
      portes: (() => {
        const b = [...document.querySelectorAll(".portes .porte")];
        const r = b.map(x => x.getBoundingClientRect());
        return { n: b.length, rangees: new Set(r.map(x => Math.round(x.top))).size,
          colonnes: new Set(r.map(x => Math.round(x.left))).size };
      })(),
      heures: bande ? bande.querySelectorAll(".bh-heure").length : 0,
      glisse: defil ? defil.scrollWidth > defil.clientWidth : false,
      icone: !!premiere?.querySelector("svg.ict"),
      degre: /^-?\d+°$/.test(premiere?.querySelector(".bh-t")?.textContent || ""),
      vents: bande ? [...bande.querySelectorAll(".bv .bh-v")].filter(x => /\d/.test(x.textContent)).length : 0,
      trait: (bande?.querySelector(".bh-courbe polyline")?.getAttribute("points") || "").trim().split(/\s+/).length,
      /* La rangée des heures seulement : celle du vent porte aussi une colonne
         par lever ou coucher, pour que la barre de pluie reste continue. */
      soleil: bande ? bande.querySelectorAll(".bande-ligne .bh.bh-soleil").length : 0,
      phrase: B.phraseBande(serie), sechePhrase: B.phraseBande(seche),
      plages: JSON.stringify(B.plagesDePluie(serie)),
    };
  });
  ok("la bande horaire se pose sous les avis urgents, avant les tuiles et les portes",
    bandeDit.presente && bandeDit.apresAvis && bandeDit.avantTuiles && bandeDit.avantPortes);
  /* Les huit paramètres suivis, chacun vers son détail : sept voies du ruban,
     et la feuille de l'air. */
  ok("chaque tuile mène au détail de son paramètre",
    bandeDit.destinations.join(" ") === "t mm v nua hum uv pres feuille:air feuille:eau",
    bandeDit.destinations.join(" "));
  ok("les quatre portes ferment l'accueil, après demain et après-demain",
    bandeDit.portesEnBas);
  ok("les quatre portes se rangent en grille de deux sur deux",
    bandeDit.portes.n === 4 && bandeDit.portes.rangees === 2 && bandeDit.portes.colonnes === 2,
    JSON.stringify(bandeDit.portes));
  ok("elle compte vingt-quatre heures, qui glissent sous le doigt",
    bandeDit.heures === 24 && bandeDit.glisse, `${bandeDit.heures} heures`);
  ok("chaque heure porte son symbole, son degré et son vent",
    bandeDit.icone && bandeDit.degre && bandeDit.vents === 24, `${bandeDit.vents} vents`);
  ok("un trait relie les températures des vingt-quatre heures",
    bandeDit.trait === 24, `${bandeDit.trait} points`);
  /* L'heure figée des contrôles tombe à neuf heures un 18 août : le coucher du
     soir et le lever du lendemain entrent tous deux dans les vingt-quatre heures. */
  ok("le coucher et le lever du Soleil s'intercalent à leur minute",
    bandeDit.soleil === 2, `${bandeDit.soleil} colonnes`);
  /* Sans avis, la bande et les chiffres du jour tiennent ensemble dans le premier
     écran, au-dessus de la barre d'onglets. La page des contrôles porte un avis à
     cet endroit de la suite : il est masqué le temps de la mesure, puis rendu. */
  const sansAvis = await pg.evaluate(() => {
    /* La bande vient après les chiffres depuis le 24 septembre 2026 : c'est
       elle, la plus basse des deux, qui se mesure. */
    const m = document.querySelector("#ecran #bande .bande-defil");
    const o = document.getElementById("onglets");
    if (!m || !o) return { reste: null };
    const avis = [...document.querySelectorAll("#ecran .vg, #ecran .pp-c")];
    const avant = avis.map(e => e.style.display);
    avis.forEach(e => { e.style.display = "none"; });
    const reste = o.getBoundingClientRect().top - m.getBoundingClientRect().bottom;
    avis.forEach((e, k) => { e.style.display = avant[k]; });
    return { reste, masques: avis.length };
  });
  ok("sans avis, la bande horaire tient dans la première vue",
    sansAvis.reste !== null && sansAvis.reste >= 0,
    `${sansAvis.reste === null ? "élément manquant" : sansAvis.reste.toFixed(0) + " points"}, `
    + `${sansAvis.masques} avis masqués pour la mesure`);

  /* Jalon 10, lot 3 : la bande et la suite de la page ne doivent pas se
     contredire. La première version de la bande comptait les heures à fort
     risque sans quantité, et annonçait une pluie de 2 h à 8 h quand « Demain et
     après-demain » disait de 03 h à 06 h pour la même averse. Et le risque d'une
     période de la table est le plus fort de ses heures : une maquette montrait
     100 % pour un après-midi dont les heures disaient 80 et 90 %. */
  const accordDit = await pg.evaluate(async () => {
    const B = await import("/src/bande.js");
    const E = await import("/src/ecritures.js");
    const heure = Array.from({ length: 24 }, (_, k) => (9 + k) % 24);
    const s = { n: 24, heure, mm: heure.map(h => h >= 3 && h <= 5 ? 1.8 : 0),
      /* Des rafales sous le seuil commun de 40 km/h : la phrase ne parle que
         de la pluie. */
      pb: heure.map(h => h >= 2 && h <= 7 ? 68 : 8), raf: heure.map(() => 30),
      t: heure.map(() => 15), v: heure.map(() => 20), code: heure.map(() => 3), clair: heure.map(() => 1) };
    const h13 = Array.from({ length: 24 }, (_, k) => (13 + k) % 24);
    const m = { n: 24, heure: h13, jour: h13.map((h, k) => (13 + k < 24 ? 0 : 1)),
      t: h13.map(() => 20), mm: h13.map(() => 0), hum: h13.map(() => 70), raf: h13.map(() => 20),
      v: h13.map(() => 10), uv: h13.map(() => 0), code: h13.map(() => 3), clair: h13.map(() => 1),
      pb: h13.map(h => ({ 13: 10, 14: 20, 15: 80, 16: 90, 17: 90 })[h] ?? 5) };
    const html = E.moments(m);
    /* Depuis le jalon 20, lot 2, le risque se lit sous la pluie, dans la
       ligne « Pluie ». */
    const ligne = html.split('<span class="mt-l">Pluie</span>')[1]?.split('<span class="mt-l">')[0] || "";
    const risques = [...ligne.matchAll(/(\d+) %<\/i>/g)].map(x => Number(x[1]));
    return { phrase: B.phraseBande(s), plages: JSON.stringify(B.plagesDePluie(s)), apresMidi: risques[0] };
  });
  ok("la bande dit les mêmes heures de pluie que la suite de la page",
    accordDit.plages === "[[18,20]]"
    && accordDit.phrase === "Pluie cette nuit de 03 h à 06 h, 5,4 mm.",
    `${accordDit.plages} ${accordDit.phrase}`);
  ok("le risque d'une période est le plus fort de ses heures",
    accordDit.apresMidi === 90, `${accordDit.apresMidi} % pour l'après-midi`);

  /* Jalon 10, lot 5 : « Le temps » en page de détail depuis l'accueil. Les gestes
     ramènent la page des contrôles à l'accueil en fin de bloc. */
  await pg.evaluate(() => window.scrollTo({ top: 260, behavior: "instant" }));
  await pg.waitForTimeout(150);
  const yQuitte = await pg.evaluate(() => Math.round(window.scrollY));
  const heureBande = await pg.evaluate(() =>
    (document.querySelector('#bande [data-heure="5"]')?.getAttribute("aria-label") || "").split(",")[0]);
  await pg.locator('#bande [data-heure="5"]').click();
  await pg.waitForTimeout(700);
  const detailDit = await pg.evaluate(() => ({
    retour: !!document.getElementById("btnRetour"),
    titre: document.querySelector("#ecran h1")?.textContent || "",
    accueilCourant: document.querySelector('[data-onglet="accueil"]')?.getAttribute("aria-current") === "page",
    /* Depuis le jalon 21, lot 2, la lecture se fait dans la bulle sous l'axe. */
    lecture: document.querySelector(".mg-lu-h")?.textContent || "",
  }));
  ok("une heure touchée dans la bande ouvre le temps en page de détail",
    /* La page s'appelle « Heure par heure » depuis le 28 septembre 2026. */
    detailDit.retour && detailDit.titre === "Heure par heure" && detailDit.accueilCourant,
    JSON.stringify(detailDit));
  ok("le ruban s'y cale sur l'heure touchée",
    heureBande !== "" && detailDit.lecture.startsWith(heureBande.replace(/^0/, ""))
    || detailDit.lecture.startsWith(heureBande),
    `bande « ${heureBande} », ruban « ${detailDit.lecture} »`);
  await pg.locator("#btnRetour").click();
  await pg.waitForTimeout(600);
  const retourDit = await pg.evaluate(() => ({
    accueil: !!document.getElementById("bande") && !document.getElementById("btnRetour"),
    y: Math.round(window.scrollY),
  }));
  ok("le retour ramène l'accueil à l'endroit quitté",
    retourDit.accueil && Math.abs(retourDit.y - yQuitte) <= 2,
    `accueil ${retourDit.accueil}, ${retourDit.y} contre ${yQuitte}`);

  /* Ouvert sans heure, le ruban ne garde aucune lecture d'une ouverture
     précédente. Puis le glissement : au lâcher, le dessin doit rester à l'heure
     entière où le rendu le pose ; le remettre à zéro avant de redessiner faisait
     revenir les courbes en arrière puis sauter, la saccade relevée sur
     l'appareil. Un observateur relève la translation du dessin jusqu'au rendu. */
  /* Les deux chemins sans heure : un chiffre de l'accueil, qui ouvre sa voie,
     puis le lien « Plus de détails ». Le second efface la lecture de lui-même,
     et le seul essayer laissait passer l'erreur volontaire 14, qui porte sur le
     premier. */
  /* Depuis le jalon 21, lot 2, la bulle lit toujours une heure : sans heure
     désignée, c'est maintenant, et aucun montant de lecture ne double le
     repère. */
  const sansLectureDe = () => pg.evaluate(() =>
    document.querySelector(".mg-lu-h")?.textContent === "Maintenant"
    && [...document.querySelectorAll(".mg-cur")].every(c => c.style.display === "none"));
  await pg.locator(".bd-deg").click();
  await pg.waitForTimeout(700);
  const sansLectureVoie = await sansLectureDe();
  await pg.locator("#btnRetour").click();
  await pg.waitForTimeout(600);
  await pg.locator("#bande .bande-plus").click();
  await pg.waitForTimeout(700);
  const sansLecture = await sansLectureDe();
  ok("sans heure désignée, aucune lecture ne reste d'une ouverture précédente", sansLecture && sansLectureVoie,
    `par un chiffre ${sansLectureVoie}, par le lien ${sansLecture}`);
  /* Le glissement de côté a disparu, décision de Jérôme du 3 octobre 2026 :
     un doigt qui court à l'horizontale fait suivre la lecture, la fenêtre ne
     bouge pas et le dessin ne se translate plus. */
  const avantGlisse = await pg.evaluate(() => ({ jour: document.querySelector(".mg-j-on")?.getAttribute("aria-label"),
    lu: document.querySelector(".mg-lu-h")?.textContent }));
  const trace = await pg.locator('.mg-v[data-cle="t"] .mg-s').boundingBox();
  if (trace) {
    const y = trace.y + trace.height / 2, x = trace.x + trace.width * 0.7;
    await pg.mouse.move(x, y);
    await pg.mouse.down();
    await pg.mouse.move(x - 40, y, { steps: 3 });
    await pg.mouse.move(x - 120, y, { steps: 4 });
    await pg.mouse.up();
    await pg.waitForTimeout(300);
  }
  const apresGlisse = await pg.evaluate(() => ({ jour: document.querySelector(".mg-j-on")?.getAttribute("aria-label"),
    lu: document.querySelector(".mg-lu-h")?.textContent,
    tr: [...document.querySelectorAll(".mg-mob")].map(g => g.getAttribute("transform") || "").filter(Boolean).length }));
  ok("un glissement de côté ne déplace plus la fenêtre, il fait suivre la lecture",
    trace && avantGlisse.jour === "Maintenant" && apresGlisse.jour === "Maintenant" && apresGlisse.tr === 0
    && apresGlisse.lu !== avantGlisse.lu, JSON.stringify({ avantGlisse, apresGlisse }));

  /* Un onglet referme la page de détail, comme sur iPhone. */
  await pg.locator('[data-onglet="semaine"]').click();
  await pg.waitForTimeout(400);
  await pg.locator('[data-onglet="accueil"]').click();
  await pg.waitForTimeout(600);
  ok("un onglet referme la page de détail",
    await pg.evaluate(() => !!document.getElementById("bande") && !document.getElementById("btnRetour")));
  /* Le ruban garde son état d'un rendu à l'autre : la fenêtre glissée, la voie
     ouverte et la lecture posée ici survivraient jusqu'aux sections du ruban, qui
     supposent une fenêtre calée sur maintenant et en dépendaient. Le bloc rend ce
     qu'il a pris. */
  await pg.evaluate(async () => {
    const R = await import("/src/ruban.js");
    R.auMaintenant(); R.poserHeure(-1); R.poserVoie(null);
    window.scrollTo({ top: 0, behavior: "instant" });
  });

  /* La version et la mise à jour, demandées le 23 septembre 2026. Le numéro est
     écrit deux fois, dans la coque et dans le module ; la garde rattrape un
     oubli au moment de monter la version. La version publiée se lit dans le
     sw.js servi ; une route la remplace ici le temps des gestes. */
  const versionDit = await pg.evaluate(async () => {
    const V = await import("/src/version.js");
    const t = await (await fetch("/sw.js", { cache: "no-store" })).text();
    return { module: V.VERSION, coque: (/const VERSION = "([^"]+)"/.exec(t) || [])[1], numero: V.numero() };
  });
  /* La coque se redemande au serveur sans le cache du navigateur, sans quoi une
     version publiée restait invisible jusqu'à dix minutes. */
  ok("le service worker redemande la coque sans le cache du navigateur",
    await pg.evaluate(async () => /fetch\(ev\.request, \{ cache: "no-cache" \}\)/
      .test(await (await fetch("/sw.js", { cache: "no-store" })).text())));

  /* La coque ne liste aucun fichier deux fois : un doublon peut faire échouer
     l'installation du service worker, et une première version du lot 3 du
     jalon 11 en avait posé un. */
  ok("la coque hors ligne ne liste aucun fichier deux fois", await pg.evaluate(async () => {
    const t = await (await fetch("/sw.js", { cache: "no-store" })).text();
    /* La liste seule : le fichier cite aussi la page de secours hors ligne. */
    const liste = (t.match(/=\s*\[([\s\S]*?)\]/) || [])[1] || "";
    const l = [...liste.matchAll(/"(\.\/[^"]*)"/g)].map(m => m[1]);
    const doubles = l.filter((x, i) => l.indexOf(x) !== i);
    return l.length > 10 && !doubles.length ? "" : `doublons : ${doubles.join(", ")}`;
  }) === "");

  ok("le numéro de version est celui de la coque",
    versionDit.module === versionDit.coque && Number.isInteger(versionDit.numero),
    `${versionDit.module} contre ${versionDit.coque}`);

  const publier = async corps => {
    await pg.context().unroute(/sw\.js\?v=/);
    await pg.context().route(/sw\.js\?v=/, r => corps === null ? r.abort()
      : r.fulfill({ status: 200, contentType: "text/javascript", body: corps }));
    await pg.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await pg.waitForTimeout(600);
    return pg.evaluate(() => {
      const b = document.querySelector("#ecran .mise-a-jour");
      return b ? { texte: b.textContent, bouton: !!b.querySelector('[data-action="recharger"]') } : null;
    });
  };
  const plusRecente = await publier(`const VERSION = "ma-meteo-v999";`);
  ok("une version plus récente publiée fait paraître l'offre de recharger",
    plusRecente && /999/.test(plusRecente.texte) && plusRecente.bouton, JSON.stringify(plusRecente));
  const memeVersion = await publier(`const VERSION = "${versionDit.coque}";`);
  ok("la même version ne fait rien paraître", memeVersion === null, JSON.stringify(memeVersion));
  const plusAncienne = await publier(`const VERSION = "ma-meteo-v1";`);
  ok("une version plus ancienne publiée ne propose rien", plusAncienne === null, JSON.stringify(plusAncienne));
  const horsLigne = await publier(null);
  ok("hors ligne, la recherche ne propose rien", horsLigne === null, JSON.stringify(horsLigne));
  await pg.context().unroute(/sw\.js\?v=/);

  await pg.locator("#btnReglages").click();
  await pg.waitForTimeout(500);
  ok("les réglages disent la version",
    await pg.evaluate(n => document.getElementById("rgVersion")?.textContent === String(n), versionDit.numero));
  /* La page s'appelle « Heure par heure » depuis la version 104 ; la carte des
     réglages portait encore l'ancien nom jusqu'à la version 119. */
  const titresReglages = await pg.evaluate(() => [...document.querySelectorAll("#feuille-corps .carte-tete h3")].map(h => h.textContent));
  ok("les réglages nomment l'écriture de la page « Heure par heure »",
    /* La carte s'intitule « Heure par heure » depuis le jalon 20. */
    titresReglages.includes("Heure par heure") && !titresReglages.some(t => /Le temps/.test(t)),
    JSON.stringify(titresReglages));
  await pg.evaluate(() => history.back());
  await pg.waitForTimeout(500);
  /* La feuille doit s'être refermée : laissée ouverte, elle double les
     sélecteurs des sections suivantes. */
  ok("la feuille des réglages se referme au retour",
    await pg.evaluate(() => document.getElementById("feuille").hidden === true));

  /* Le ruban en paysage garde la densité du portrait. Sa largeur était fixe, 358
     unités, et en paysage ces unités s'étiraient sur 764 points : tout grossissait
     d'un facteur deux, relevé par Jérôme le 24 septembre 2026. Le rapport entre
     points d'écran et unités de dessin doit être le même dans les deux sens, et
     le portrait garder ses 358 unités. */
  const densite = () => pg.evaluate(() => {
    const svg = document.querySelector(".mg-s");
    if (!svg) return null;
    const vb = Number(svg.getAttribute("viewBox").split(" ")[2]);
    return { vb, rapport: svg.getBoundingClientRect().width / vb };
  });
  await ouvrirLeTemps(pg);
  await pg.waitForTimeout(700);
  const portrait = await densite();
  await pg.setViewportSize({ width: 844, height: 390 });
  await reposer(pg, 1800);
  const paysage = await densite();
  await pg.setViewportSize({ width: 390, height: 844 });
  await reposer(pg, 1800);
  await pg.locator('[data-onglet="accueil"]').click();
  await pg.waitForTimeout(500);
  await pg.evaluate(async () => {
    const R = await import("/src/ruban.js");
    R.auMaintenant(); R.poserHeure(-1); R.poserVoie(null);
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  ok("le ruban garde en paysage la densité du portrait",
    portrait && paysage && portrait.vb === 358 && paysage.vb > 700
    && Math.abs(paysage.rapport - portrait.rapport) < 0.02,
    `portrait ${portrait?.vb} unités à ${portrait?.rapport.toFixed(3)}, `
    + `paysage ${paysage?.vb} unités à ${paysage?.rapport.toFixed(3)}`);

  /* Jalon 11, lot 3 : la bande porte une ligne de vent avec sa flèche, les
     rafales ne paraissent que fortes, la colonne du moment présent se détache.
     La flèche montre où va le vent ; le ruban montrait d'où il venait, à
     l'inverse de son commentaire, et la flèche est désormais partagée. */
  const ventDit = await pg.evaluate(async () => {
    const V = await import("/src/fleche.js");
    const B = await import("/src/bande.js");
    const heure = Array.from({ length: 24 }, (_, k) => (9 + k) % 24);
    const serie = raf => ({ n: 24, heure, mm: heure.map(() => 0), pb: heure.map(() => 5), raf,
      t: heure.map(() => 15), v: heure.map(() => 20), dir: heure.map(() => 90),
      code: heure.map(() => 3), clair: heure.map(() => 1) });
    const g = { lat: 48.86, lon: 2.35 };
    const compte = raf => {
      const d = document.createElement("div");
      d.innerHTML = B.bandeHoraire(serie(raf), g);
      return [...d.querySelectorAll(".bh-r")].filter(x => x.textContent.trim()).length;
    };
    const bande = document.getElementById("bande");
    return {
      angles: [V.angleFleche(0), V.angleFleche(90), V.angleFleche(-90), V.angleFleche(450)],
      fleches: bande ? bande.querySelectorAll(".bv .bh-fl").length : 0,
      calmes: compte(heure.map(() => 30)),
      fortes: compte(heure.map((_, k) => (k === 3 ? 55 : 30))),
      fond: !!bande?.querySelector(".bh-fond"),
      titre: bande?.querySelector(".bande-tete h3")?.textContent || "",
    };
  });
  ok("la flèche du vent montre où il va",
    ventDit.angles.join(" ") === "0 90 270 90", ventDit.angles.join(" "));
  ok("chaque heure de la bande porte la flèche de son vent", ventDit.fleches === 24, String(ventDit.fleches));
  ok("les rafales ne paraissent dans la bande que fortes",
    ventDit.calmes === 0 && ventDit.fortes === 1, `${ventDit.calmes} calmes, ${ventDit.fortes} fortes`);
  ok("la colonne du moment présent se détache, sous le titre « Maintenant et prochaines heures »",
    ventDit.fond && ventDit.titre === "Maintenant et prochaines heures", ventDit.titre);

  /* Jalon 12, lot 2 : la confiance se lit sur chaque ligne de La semaine, sans
     déplier, et la barre s'estompe quand elle baisse. Les jours passés n'en
     portent pas. */
  await onglet("semaine");
  const semConf = await pg.evaluate(() => {
    const lignes = [...document.querySelectorAll("#ecran .sem-j")];
    const mots = lignes.filter(l => !l.classList.contains("sem-passe"))
      .map(l => l.querySelector(".sem-conf")?.textContent || "").filter(Boolean);
    const passes = lignes.filter(l => l.classList.contains("sem-passe") && l.querySelector(".sem-conf")).length;
    const estompe = [...document.querySelectorAll("#ecran .sem-plage.sem-faible, #ecran .sem-plage.sem-moyenne")]
      .every(x => (getComputedStyle(x).maskImage || getComputedStyle(x).webkitMaskImage || "none") !== "none");
    const nettes = [...document.querySelectorAll("#ecran .sem-plage:not(.sem-faible):not(.sem-moyenne)")]
      .every(x => (getComputedStyle(x).maskImage || "none") === "none");
    return { mots, passes, estompe, nettes,
      incertaines: document.querySelectorAll("#ecran .sem-plage.sem-faible, #ecran .sem-plage.sem-moyenne").length };
  });
  /* Jalon 12, lot 3 : le graphique de tête, un point par journée de la liste,
     les jours passés atténués, aujourd'hui repéré, et une largeur d'affichage
     bornée pour que ses textes ne grossissent pas en paysage. */
  const semGraphe = await pg.evaluate(async () => {
    const V = await import("/src/vues.js");
    const g = document.querySelector("#ecran .sem-graphe");
    const liste = document.querySelector("#ecran .sem");
    const pts = sel => (g?.querySelector(sel)?.getAttribute("points") || "").trim().split(/\s+/).filter(Boolean).length;
    const essai = V.grapheSemaine([
      { nom: "Hier", tn: 12, tx: 31, mm: 0, passe: true, auj: false },
      { nom: "Auj.", tn: 9, tx: 25, mm: 0, passe: false, auj: true },
      { nom: "Dem.", tn: 9, tx: 25, mm: 5.4, passe: false, auj: false },
      { nom: "jeu", tn: 16, tx: 30, mm: 0, passe: false, auj: false },
    ]);
    return {
      avant: !!g && !!liste && (g.compareDocumentPosition(liste) & Node.DOCUMENT_POSITION_FOLLOWING) > 0,
      jours: document.querySelectorAll("#ecran .sem-j").length,
      max: pts(".sg-max"), min: pts(".sg-min"),
      passes: g ? g.querySelectorAll(".sg-passe").length : 0,
      passesListe: document.querySelectorAll("#ecran .sem-j.sem-passe").length,
      auj: g ? g.querySelectorAll(".sg-auj").length : 0,
      borne: g ? getComputedStyle(g.querySelector("svg")).maxWidth : "",
      resume: (/aria-label="([^"]*)"/.exec(essai) || [])[1] || "",
    };
  });
  /* Jalon 12, lot 4 : les grandes lignes de la semaine, trois phrases au plus par
     ordre de gravité, vérifiées sur des semaines d'essai connues. */
  const lignesDit = await pg.evaluate(async () => {
    const C = await import("/src/conseils.js");
    const j = (nom, tn, tx, mm, code, pb = 10, vent = 15) => ({ nom, tn, tx, mm, code, pb, vent });
    const semaine = [j("aujourd'hui", 9, 25, 0, 2), j("demain", 9, 25, 5.4, 61, 80), j("jeudi", 16, 28, 3.2, 3),
      j("vendredi", 16, 29, 0, 3), j("samedi", 17, 30, 3.9, 61), j("dimanche", 17, 30, 3.1, 95, 70), j("lundi", 17, 30, 1.6, 95)];
    const seche = [j("aujourd'hui", 10, 22, 0, 1), j("demain", 11, 23, 0, 1), j("jeudi", 12, 24, 0, 2), j("vendredi", 12, 23, 0, 1)];
    const unOrage = [j("aujourd'hui", 10, 22, 0, 1), j("demain", 11, 23, 2.4, 95), j("jeudi", 12, 24, 0, 2)];
    const bloc = document.querySelector("#ecran .sem-lignes");
    const liste = document.querySelector("#ecran .sem");
    const graphe = document.querySelector("#ecran .sem-graphe");
    const apres = (a, b) => !!a && !!b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) > 0;
    return {
      semaine: C.grandesLignes(semaine).map(l => l.t),
      seche: C.grandesLignes(seche).map(l => l.t),
      unOrage: C.grandesLignes(unOrage).map(l => l.t)[0] || "",
      place: apres(graphe, bloc) && apres(bloc, liste),
      nombre: bloc ? bloc.querySelectorAll(".cj-l").length : 0,
    };
  });
  ok("les grandes lignes disent l'orage, la chaleur et la pluie la plus forte, par gravité",
    lignesDit.semaine.join(" | ") === "Orages probables dimanche et lundi, 3,1 mm attendus dimanche. | "
      + "Chaleur jusqu'à 30° samedi, 5 jours à 28° et plus. | Pluie la plus forte demain, 5,4 mm attendus.",
    lignesDit.semaine.join(" | "));
  ok("une semaine sans pluie se dit sèche", lignesDit.seche.join(" | ") === "Semaine sèche, aucune pluie notable d'ici vendredi.",
    lignesDit.seche.join(" | "));
  ok("un orage seul ne répète pas son jour", /^Orage probable demain, [\d,]+ mm attendus\.$/.test(lignesDit.unOrage),
    lignesDit.unOrage);
  ok("les grandes lignes se posent entre le graphique et la liste, trois au plus",
    lignesDit.place && lignesDit.nombre >= 1 && lignesDit.nombre <= 3, `${lignesDit.nombre} lignes`);

  /* Jalon 12, lot 5 : le week-end se repère d'un fond léger, et une journée
     dépliée mène à ses heures, dans le ruban ouvert à son minuit. */
  const weDit = await pg.evaluate(() => [...document.querySelectorAll("#ecran .sem-j")].map(l => {
    const j = l.querySelector("[data-jour]")?.dataset.jour;
    const js = j ? new Date(`${j}T12:00`).getDay() : -1;
    return { we: js === 0 || js === 6, marque: l.classList.contains("sem-we"), j };
  }).filter(x => x.j));
  const ligneJour = pg.locator("#ecran .sem-j:not(.sem-passe) .sem-r[data-jour]").nth(2);
  const jourVise = await ligneJour.getAttribute("data-jour");
  await ligneJour.click();
  await pg.waitForTimeout(500);
  await pg.locator(`[data-jour-heures="${jourVise}"]`).click();
  await pg.waitForTimeout(900);
  const heuresDit = await pg.evaluate(() => ({
    fenetre: document.querySelector(".mg-j-on")?.getAttribute("aria-label") || "",
    debut: document.querySelector(".mg-bd .mg-bj")?.textContent || "",
    retour: document.getElementById("btnRetour")?.textContent || "",
  }));
  await pg.evaluate(() => history.back());
  await pg.waitForTimeout(600);
  await pg.evaluate(async () => {
    const R = await import("/src/ruban.js");
    R.auMaintenant(); R.poserHeure(-1); R.poserVoie(null);
  });
  ok("le week-end de La semaine se repère d'un fond léger, et lui seul",
    weDit.some(x => x.we) && weDit.every(x => x.we === x.marque),
    weDit.map(x => `${x.j}${x.marque ? "*" : ""}`).join(" "));
  ok("une journée dépliée mène à ses heures, le ruban ouvert à son minuit",
    /* Depuis le jalon 21, lot 2, le bouton du jour s'allume. */
    new RegExp(`${Number(jourVise.slice(8))} août`).test(heuresDit.fenetre) && heuresDit.retour.trim() === "À venir",
    `${jourVise} : « ${heuresDit.fenetre} », retour « ${heuresDit.retour.trim()} »`);

  await onglet("accueil");
  ok("La semaine s'ouvre sur son graphique, un point par journée",
    semGraphe.avant && semGraphe.max === semGraphe.jours && semGraphe.min === semGraphe.jours && semGraphe.jours >= 7,
    JSON.stringify(semGraphe));
  ok("le graphique atténue les jours passés et repère aujourd'hui",
    semGraphe.passes === semGraphe.passesListe && semGraphe.auj === 1,
    `${semGraphe.passes} passés contre ${semGraphe.passesListe}, ${semGraphe.auj} aujourd'hui`);
  /* Le graphique, le 28 septembre 2026 : la quantité de pluie au-dessus des
     barres, et une ligne des rafales avec la flèche de la direction dominante. */
  const grapheVent = await pg.evaluate(async () => {
    const V = await import("/src/vues.js");
    const html = V.grapheSemaine([
      { nom: "Auj.", tn: 9, tx: 25, mm: 0, raf: 30, dir: 270, passe: false, auj: true },
      { nom: "Dem.", tn: 9, tx: 25, mm: 5.4, raf: 55, dir: 200, passe: false, auj: false },
      { nom: "jeu", tn: 16, tx: 30, mm: 12.6, raf: 20, dir: 90, passe: false, auj: false },
    ]);
    const d = document.createElement("div"); d.innerHTML = html;
    return {
      mm: [...d.querySelectorAll(".sg-mm")].map(t => t.textContent),
      points: (d.querySelector(".sg-vent")?.getAttribute("points") || "").trim().split(/\s+/).filter(Boolean).length,
      kmh: [...d.querySelectorAll(".sg-kmh")].map(t => t.textContent),
      fleches: d.querySelectorAll(".sg-fl > g").length,
      resume: d.querySelector("svg")?.getAttribute("aria-label") || "",
    };
  });
  ok("la pluie du graphique porte sa quantité, en millimètres",
    grapheVent.mm.join(" ") === "5,4 13", grapheVent.mm.join(" "));
  ok("le graphique trace les rafales du jour, avec la flèche de leur direction",
    grapheVent.points === 3 && grapheVent.kmh.join(" ") === "30 55 20" && grapheVent.fleches === 3
    && /vent jusqu'à 55 kilomètres par heure\.$/.test(grapheVent.resume), JSON.stringify(grapheVent));
  /* Jalon 13, lot 1 : seize jours. Au-delà de dix journées, le graphique garde
     des colonnes fixes et défile ; la seconde semaine porte le numéro du jour. */
  const grapheSeize = await pg.evaluate(async () => {
    const V = await import("/src/vues.js");
    const jours = Array.from({ length: 18 }, (_, k) => ({ nom: ["sam", "dim", "lun"][k % 3], tn: 10, tx: 20, mm: 0,
      passe: k < 2, auj: k === 2, num: k >= 9 ? k + 1 : null }));
    const d = document.createElement("div"); d.innerHTML = V.grapheSemaine(jours);
    const svg = d.querySelector("svg");
    return { defile: !!d.querySelector(".sg-defil"), large: Number(svg?.getAttribute("width") || 0),
      derniere: [...d.querySelectorAll(".sg-j")].pop()?.textContent || "" };
  });
  ok("sur seize jours, le graphique défile à colonnes fixes et nomme la seconde semaine",
    grapheSeize.defile && grapheSeize.large >= 18 * 30 && /^\S+ 18$/.test(grapheSeize.derniere),
    JSON.stringify(grapheSeize));
  /* Jalon 13, lots 2 et 3 : les scénarios quotidiens d'ICON et d'ECMWF, et la
     confiance mixte. Une charge connue est posée, puis retirée. */
  const scenDit = await pg.evaluate(async () => {
    const S = await import("/src/scenarios.js");
    const jourDe = k => new Date(Date.UTC(2026, 7, 18 + k)).toISOString().slice(0, 10);
    const r = S.reduire({ time: [jourDe(0)], temperature_2m_max: [20], temperature_2m_max_member01: [22],
      temperature_2m_max_member02: [null] }, "temperature_2m_max");
    const serie = (n, larg) => ({ time: Array.from({ length: n }, (_, k) => jourDe(k)),
      membres: Array.from({ length: n }, (_, k) => Array.from({ length: 20 }, (_, m) => 20 + (m / 19 - 0.5) * larg(k))) });
    /* Une dispersion de six degrés dès aujourd'hui : les scénarios disent « à
       confirmer » là où l'ensemble horaire des contrôles dit « fiable », et le mot
       affiché désigne ainsi sa source. */
    const c = { icon: serie(7, () => 6), ecmwf: serie(15, k => 6 + k * 0.8) };
    const j0 = S.jour(jourDe(0), c), j10 = S.jour(jourDe(10), c), j15 = S.jour(jourDe(15), c);
    window.__scenariosAvant = S.chargee();
    S.poser(c);
    return { r: JSON.stringify(r.membres), j0: j0 && [j0.source, j0.icon.n, j0.ecmwf.n, j0.reunis.n],
      j10: j10 && j10.source, j15, seuils: [3.9, 4, 6.9, 7].map(S.accordDe).join(" ") };
  });
  await onglet("semaine");
  const semScen = await pg.evaluate(() => {
    const l = document.querySelector('.sem-j .sem-r[data-jour="2026-08-18"]')?.closest(".sem-j");
    return { mot: l?.querySelector(".sem-conf")?.textContent || "", volet: l?.querySelector(".md-sc")?.textContent || "" };
  });
  /* La charge d'origine est rendue : les sections suivantes la lisent. */
  await pg.evaluate(async () => { const S = await import("/src/scenarios.js"); S.poser(window.__scenariosAvant); });
  await onglet("accueil");
  ok("les scénarios quotidiens se réduisent par journée, membre par membre", scenDit.r === "[[20,22]]", scenDit.r);
  ok("la confiance réunit les deux modèles où ils se recouvrent, ECMWF seul au-delà, rien après",
    JSON.stringify(scenDit.j0) === JSON.stringify(["mixte", 20, 20, 40]) && scenDit.j10 === "ecmwf" && scenDit.j15 === null,
    JSON.stringify(scenDit));
  ok("les seuils de la confiance quotidienne tombent à quatre et à sept degrés",
    scenDit.seuils === "bonne moyenne moyenne faible", scenDit.seuils);
  ok("La semaine tire sa confiance des deux modèles, et le volet les compare",
    semScen.mot === "à confirmer" && /^Confiance moyenne : ICON et ECMWF s'accordent, ICON de \d+ à \d+°, ECMWF de \d+ à \d+° au plus chaud\.$/.test(semScen.volet),
    JSON.stringify(semScen));
  /* La phrase de confiance, jalon 13 : quand les médianes des deux modèles
     s'écartent de deux degrés ou plus, elle le dit ; au-delà de sept jours, elle
     nomme ECMWF seul. Les journées lointaines se déplient sur elle seule. */
  const phrasesConf = await pg.evaluate(async () => {
    const V = await import("/src/vues.js");
    return [
      V.phraseConfiance({ source: "mixte", etendue: 5, ecart: 2.6,
        icon: { p10: 17.8, p90: 22.1 }, ecmwf: { p10: 20.2, p90: 24.9 }, reunis: { p10: 18, p90: 24 } }),
      V.phraseConfiance({ source: "ecmwf", etendue: 8.2, ecart: null, icon: null,
        ecmwf: { p10: 14.2, p90: 22.8 }, reunis: { p10: 14.2, p90: 22.8 } }),
    ].map(h => h.replace(/<[^>]+>/g, ""));
  });
  ok("la confiance dit quand les deux modèles s'écartent, et nomme ECMWF seul au-delà",
    phrasesConf[0] === "Confiance moyenne : ICON et ECMWF s'écartent de 3°, ICON de 18 à 22°, ECMWF de 20 à 25° au plus chaud."
    && phrasesConf[1] === "Confiance faible : ECMWF seul au-delà de sept jours, de 14 à 23° au plus chaud.",
    phrasesConf.join(" | "));
  /* Jalon 13, lot 4 : la tendance de la semaine suivante, en une ligne. */
  const tendDit = await pg.evaluate(async () => {
    const C = await import("/src/conseils.js");
    const j = (tx, mm = 0) => ({ tx, mm });
    const cette = [25, 25, 26, 24, 25, 26, 25].map(t => j(t));
    const fraiche = [j(20), j(19, 2), j(21), j(20), j(19, 1.5), j(20), j(21)];
    const pareille = [24, 25, 26, 25, 25, 24, 26].map(t => j(t));
    return [C.tendanceSuivante(cette, fraiche)?.t, C.tendanceSuivante(cette, pareille)?.t,
      C.tendanceSuivante(cette, fraiche.slice(0, 4))];
  });
  ok("la semaine suivante se dit en une ligne de tendance, et seulement avec cinq jours",
    tendDit[0] === "Semaine prochaine plus fraîche, autour de 20° au plus chaud, 2 jours de pluie."
    && tendDit[1] === "Semaine prochaine semblable, autour de 25° au plus chaud, sans pluie notable."
    && tendDit[2] === null, JSON.stringify(tendDit));
  /* Jalon 17 : La semaine au plus loin. La tendance de GFS se réduit par
     journée, prolonge la charge quotidienne sans doublon, et se déplie d'un
     « Voir plus » commun au graphique et à la liste. */
  const tendRed = await pg.evaluate(async () => {
    const S = await import("/src/scenarios.js"), V = await import("/src/vues.js");
    const r = S.reduireTendance({ time: ["2026-09-01"],
      temperature_2m_max: [20], temperature_2m_max_member01: [22], temperature_2m_max_member02: [21],
      temperature_2m_max_member03: [23], temperature_2m_max_member04: [19],
      temperature_2m_min: [10], temperature_2m_min_member01: [12], temperature_2m_min_member02: [11],
      temperature_2m_min_member03: [13], temperature_2m_min_member04: [9],
      precipitation_sum: [0], precipitation_sum_member01: [2], precipitation_sum_member02: [0],
      precipitation_sum_member03: [3], precipitation_sum_member04: [1] })[0];
    const x = V.etendreQuotidien({ time: ["2026-09-01", "2026-09-02"], temperature_2m_max: [1, 2], temperature_2m_min: [0, 0],
      precipitation_sum: [0, 0], precipitation_probability_max: [0, 0], weather_code: [0, 0] },
      [{ date: "2026-09-02", tx: 9, tn: 9, mm: 9, pb: 9 }, { date: "2026-09-03", tx: 15, tn: 5, mm: 1.2, pb: 60 }]);
    return { r: r && [r.tx, r.tn, r.mm, r.pb, r.n], time: x.time.join(" "), code: x.weather_code[2], pb: x.precipitation_probability_max[2] };
  });
  ok("la tendance de GFS se résume par journée : médianes, pluie moyenne, part des scénarios pluvieux",
    JSON.stringify(tendRed.r) === JSON.stringify([21, 11, 1.2, 60, 5]), JSON.stringify(tendRed));
  ok("la tendance prolonge la charge quotidienne, sans doublon, le symbole tiré de la pluie",
    tendRed.time === "2026-09-01 2026-09-02 2026-09-03" && tendRed.code === 61 && tendRed.pb === 60, JSON.stringify(tendRed));
  await onglet("semaine");
  const avantPlus = await pg.evaluate(() => ({ lignes: document.querySelectorAll("#ecran .sem-j:not(.sem-passe)").length,
    boutons: [...document.querySelectorAll("#ecran [data-semaine-plus]")].map(b => b.textContent) }));
  const bPlus = pg.locator("#ecran [data-semaine-plus]").first();
  if (await bPlus.count()) { await bPlus.click(); await reposer(pg, 2700); }
  const apresPlus = await pg.evaluate(() => {
    const t = [...document.querySelectorAll("#ecran .sem-j.sem-tend")];
    return { lignes: document.querySelectorAll("#ecran .sem-j:not(.sem-passe)").length, tend: t.length,
      eau: t[0]?.querySelector(".c em")?.textContent || "", conf: t.some(l => l.querySelector(".sem-conf")),
      fonds: document.querySelectorAll("#ecran .sem-graphe .sg-tend").length,
      boutons: [...document.querySelectorAll("#ecran [data-semaine-plus]")].map(b => b.textContent) };
  });
  if (apresPlus.boutons.length) { await pg.locator("#ecran [data-semaine-plus]").first().click(); await pg.waitForTimeout(400); }
  await onglet("accueil");
  ok("La semaine se déplie d'un « Voir plus » commun au graphique et à la liste, jusqu'à la tendance",
    avantPlus.boutons.length === 2 && avantPlus.boutons.every(b => b.startsWith("Voir plus"))
    && apresPlus.tend > 10 && apresPlus.lignes > avantPlus.lignes && apresPlus.fonds === apresPlus.tend
    && apresPlus.boutons.every(b => b === "Voir moins"), JSON.stringify({ avantPlus, apresPlus }));
  ok("une journée de tendance dit la part de ses scénarios pluvieux, sans mot de confiance",
    apresPlus.eau === "35 %" && !apresPlus.conf, JSON.stringify(apresPlus));
  /* L'onglet « La semaine » s'appelle « À venir » depuis le 28 septembre 2026. */
  const nomOnglet = await pg.evaluate(() => document.querySelector('[data-onglet="semaine"]')?.textContent.trim() || "");
  ok("l'onglet des jours à venir s'appelle « À venir »", nomOnglet === "À venir", nomOnglet);

  /* Le plafond avance à chaque image : calé au point entier, il restait figé
     entre deux sauts d'un point, un à-coup toutes les vingt images. Deux images
     séparées d'un trentième de seconde doivent différer. */
  const plafondBouge = await pg.evaluate(async () => {
    const V = await import("/src/vues.js"), T = await import("/src/temps.js");
    const d = document.createElement("div");
    d.style.cssText = "position:fixed;left:0;top:0;width:390px;z-index:99";
    d.innerHTML = `<div class="plein plein-accueil">${V.bandeauAccueil({ lat: 47.63, lon: 4.38 },
      new Date("2026-09-28T12:00:00+02:00"), T.depuis(3, 100, 0), 10).ciel}</div>`;
    document.body.append(d);
    await new Promise(r => setTimeout(r, 100));
    const cv = d.querySelector("canvas.ci-temps");
    const x = cv.getContext("2d");
    T.dessiner(cv, 20);
    const a = x.getImageData(0, 0, cv.width, Math.round(cv.height / 2)).data;
    T.dessiner(cv, 20 + 1 / 30);
    const b = x.getImageData(0, 0, cv.width, Math.round(cv.height / 2)).data;
    d.remove();
    let n = 0;
    for (let k = 0; k < a.length; k += 4) if (a[k] !== b[k] || a[k + 1] !== b[k + 1] || a[k + 2] !== b[k + 2]) n++;
    return n;
  });
  ok("le plafond du ciel couvert avance à chaque image, sans à-coup", plafondBouge > 0, `${plafondBouge} points changés`);
  /* La page des heures, le 28 septembre 2026 : « Heure par heure », un bandeau
     collant qui porte le jour et les heures, un trait continu à chaque minuit
     sur toute la pile des voies, sans les pointillés d'avant dans chaque voie. */
  await ouvrirLeTemps(pg);
  const hph = await pg.evaluate(() => {
    const b = document.querySelector("#ecran .mg-bandeau");
    const cs = b ? getComputedStyle(b) : null;
    return {
      titre: document.querySelector("#ecran h1")?.textContent || "",
      colle: cs ? cs.position === "sticky" && parseFloat(cs.top) >= 44 : false,
      jours: b ? [...b.querySelectorAll(".mg-bj")].map(t => t.textContent) : [],
      heures: b ? [...b.querySelectorAll(".mg-bh")].map(t => t.textContent) : [],
      mobiles: document.querySelectorAll("#ecran .mg-bandeau .mg-mob").length,
      /* Depuis le 3 octobre 2026, minuit se trace dans chaque voie et s'arrête
         aux tracés : le calque posé derrière la pile traversait les titres. */
      traits: document.querySelectorAll("#ecran .mg-s .mg-mp").length,
      voiesTracees: document.querySelectorAll("#ecran .mg-s").length,
      calque: document.querySelectorAll("#ecran .mg-minuits").length,
      pointilles: document.querySelectorAll("#ecran .mg-s .mg-minuit").length,
    };
  });
  await pg.evaluate(() => history.back());
  await pg.waitForTimeout(500);
  ok("la page des heures s'appelle « Heure par heure »", hph.titre === "Heure par heure", hph.titre);
  ok("un bandeau collant porte le jour et les heures, et glisse avec le ruban",
    hph.colle && hph.jours.some(j => /^(Aujourd'hui|Demain|Hier)$/.test(j)) && hph.heures.includes("12 h") && hph.mobiles === 1,
    JSON.stringify(hph));
  ok("minuit se trace dans chaque voie dessinée, sans calque qui traverse les titres",
    hph.traits >= hph.voiesTracees && hph.voiesTracees >= 1 && hph.calque === 0 && hph.pointilles === 0, JSON.stringify(hph));
  /* Jalon 14, lot 1 : la semaine du lundi au dimanche, les mêmes dates d'une
     autre année, et le bilan avec sa phrase. */
  const cmpPur = await pg.evaluate(async () => {
    const C = await import("/src/comparaison.js");
    const cette = [20, 21, 22, 23, 22, 21, 20].map((tx, k) => ({ tx, tn: tx - 10, mm: k === 2 ? 5 : 0 }));
    const chaude = cette.map((j, k) => ({ tx: j.tx - 3, tn: j.tn - 3, mm: k === 1 ? 10 : k === 5 ? 5 : 0 }));
    /* Quatre millimètres d'écart, sous le seuil de dix : la pluie reste
       « comparable ». Identique, elle ne distinguait aucun seuil d'un autre. */
    const pareille = cette.map((j, k) => ({ tx: j.tx - 0.4, tn: j.tn, mm: j.mm + (k === 0 ? 4 : 0) }));
    return { semaine: C.semaineDe("2026-09-30").join(" "), bissextile: C.memesDates(["2024-02-29"], 2023)[0],
      chaude: C.bilan(cette, chaude, 2025)?.phrase, pareille: C.bilan(cette, pareille, 2025)?.phrase,
      court: C.bilan(cette, chaude.slice(0, 3), 2025) };
  });
  ok("la semaine va du lundi au dimanche, un 29 février devient le 28",
    cmpPur.semaine === "2026-09-28 2026-09-29 2026-09-30 2026-10-01 2026-10-02 2026-10-03 2026-10-04"
    && cmpPur.bissextile === "2023-02-28", JSON.stringify(cmpPur));
  ok("le bilan de la comparaison dit l'écart de température, et la pluie au-delà de dix millimètres",
    cmpPur.chaude === "Plus chauds que les mêmes 7 jours de 2025, de 3° en moyenne au plus chaud ; plus secs, 5 mm contre 15."
    && cmpPur.pareille === "Semblables aux mêmes 7 jours de 2025, à 0,4° près au plus chaud ; pluie comparable, 5 mm contre 9."
    && cmpPur.court === null, JSON.stringify(cmpPur));
  /* Jalon 14, lot 2 : l'adresse groupée des lieux et le bilan entre lieux. */
  const lieuxPur = await pg.evaluate(async () => {
    const C = await import("/src/comparaison.js");
    const u = new URL(C.adresseLieux([{ lat: 47.6, lon: 4.3 }, { lat: 48.86, lon: 2.35 }],
      ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"])).searchParams;
    const sept = f => Array.from({ length: 7 }, (_, k) => f(k));
    const sec = C.bilanLieux([{ nom: "A", jours: sept(() => ({ tx: 20, tn: 10, mm: 0 })) },
      { nom: "B", jours: sept(() => ({ tx: 22, tn: 12, mm: 0.1 })) }]);
    const seul = C.bilanLieux([{ nom: "A", jours: sept(() => ({ tx: 20, tn: 10, mm: 0 })) }]);
    return { lat: u.get("latitude"), debut: u.get("start_date"), fin: u.get("end_date"), sec: sec?.phrase, seul };
  });
  ok("les lieux se demandent ensemble, et une semaine sans pluie notable se dit sèche partout",
    lieuxPur.lat === "47.6000,48.8600" && lieuxPur.debut === "2026-09-28" && lieuxPur.fin === "2026-10-04"
    && lieuxPur.sec === "B le plus chaud ces 7 derniers jours, 22° en moyenne au plus chaud ; sec partout." && lieuxPur.seul === null,
    JSON.stringify(lieuxPur));
  /* Audit, constat 1.6 : une journée dont la pluie manque, comme les derniers
     jours d'une archive en retard, sort des cumuls au lieu de compter sèche, et
     la phrase dit sur combien de jours elle compare. */
  const trouPur = await pg.evaluate(async () => {
    const C = await import("/src/comparaison.js");
    const quinze = f => Array.from({ length: 15 }, (_, k) => f(k));
    const cette = quinze(k => ({ tx: 20, tn: 10, mm: k >= 12 ? null : 0 }));
    const autre = quinze(k => ({ tx: 20, tn: 10, mm: k >= 12 ? 5 : 0 }));
    const vide = quinze(() => ({ tx: 20, tn: 10, mm: null }));
    const sept = f => Array.from({ length: 7 }, (_, k) => f(k));
    const lieux = C.bilanLieux([{ nom: "A", jours: sept(k => ({ tx: 20, tn: 10, mm: k >= 4 ? null : 0 })) },
      { nom: "B", jours: sept(k => ({ tx: 22, tn: 12, mm: k >= 4 ? 5 : 0 })) }]);
    return { trou: C.bilan(cette, autre, 2025, "15p")?.phrase, vide: C.bilan(vide, autre, 2025, "15p")?.phrase,
      lieux: lieux?.phrase, arrose: lieux?.arrose };
  });
  ok("une journée sans pluie connue sort des cumuls de la comparaison, et la phrase le dit",
    /; pluie comparable, 0 mm contre 0 sur 12 jours\.$/.test(trouPur.trou || "")
    && /; pluie non comparée, archive incomplète\.$/.test(trouPur.vide || "")
    && /; sec partout sur 4 jours\.$/.test(trouPur.lieux || "") && trouPur.arrose === null,
    JSON.stringify(trouPur));
  /* Jalon 14, complément du 29 septembre 2026 : les périodes. Le passé finit
     hier, l'avenir commence demain, aujourd'hui n'appartient à aucune période ;
     le seuil de la pluie croît avec la racine de la durée. */
  const perPur = await pg.evaluate(async () => {
    const C = await import("/src/comparaison.js");
    const bornes = p => { const d = C.datesDe(p, "2026-09-29"); return `${d.length} ${d[0]} ${d[d.length - 1]}`; };
    const trente = f => Array.from({ length: 30 }, (_, k) => f(k));
    const cette = trente(k => ({ tx: 20, tn: 10, mm: k === 0 ? 10 : 0 }));
    const autre = trente(() => ({ tx: 17, tn: 8, mm: 0.85 }));
    return { p7: bornes("7p"), p60: bornes("60p"), f3: bornes("3f"), f15: bornes("15f"),
      sens: C.PERIODES.map(([v, , s]) => `${v}:${s}`).join(" "), defaut: C.PERIODE_DEFAUT,
      seuils: [3, 7, 15, 30, 60].map(C.seuilPluie).join(" "), phrase: C.bilan(cette, autre, 2025, "30p")?.phrase };
  });
  ok("le passé finit hier, l'avenir commence demain, et le seuil de la pluie croît avec la durée",
    perPur.p7 === "7 2026-09-22 2026-09-28" && perPur.p60 === "60 2026-07-31 2026-09-28"
    && perPur.f3 === "3 2026-09-30 2026-10-02" && perPur.f15 === "15 2026-09-30 2026-10-14"
    && perPur.sens === "7p:passe 15p:passe 30p:passe 60p:passe 3f:avenir 7f:avenir 15f:avenir" && perPur.defaut === "7p"
    && perPur.seuils === "7 10 15 21 29"
    && perPur.phrase === "Plus chauds que les mêmes 30 jours de 2025, de 3° en moyenne au plus chaud ; pluie comparable, 10 mm contre 26.",
    JSON.stringify(perPur));
  /* Jalon 16, lot 1 : la liste embarquée des stations, France et pays voisins,
     chacune avec le pied sous le sommet et une position plausible. */
  const stationsDit = await pg.evaluate(async () => {
    const { STATIONS } = await import("/src/stations.js");
    return { n: STATIONS.length,
      formes: STATIONS.every(s => s.length === 8 && typeof s[0] === "string" && s[4] < s[5]
        && s[2] > 41 && s[2] < 49.5 && s[3] > -2.5 && s[3] < 9.5),
      /* Les stations se rangent sous leur domaine, qui figure lui-même dans la liste. */
      parents: STATIONS.every(s => s[7] === null || STATIONS.some(t => t[0] === s[7])),
      courchevel: STATIONS.find(s => s[0] === "Courchevel")?.[7] || "",
      rangees: STATIONS.filter(s => s[7]).length,
      pays: [...new Set(STATIONS.map(s => s[1]))].sort().join(" "),
      megeve: STATIONS.find(s => s[0] === "Megève")?.slice(4, 6).join("-") || "" };
  });
  ok("la liste des stations couvre la France et ses voisins, le pied sous le sommet, rangées sous leur domaine",
    stationsDit.n >= 400 && stationsDit.formes && stationsDit.pays === "AD CH DE ES FR IT" && stationsDit.megeve === "820-2371"
    && stationsDit.parents && stationsDit.courchevel === "Les Trois Vallées" && stationsDit.rangees >= 20,
    JSON.stringify(stationsDit));

  /* Jalon 16, lot 2 : les stations à une heure de route, par OSRM ; sans
     réponse, une estimation à vol d'oiseau, marquée comme telle. */
  const prochesDit = await pg.evaluate(async () => {
    const N = await import("/src/neige.js");
    const liste = [["A", "FR", 45.20, 5.80, 1000, 2000, 10], ["B", "FR", 45.40, 5.90, 1200, 2200, 20],
      ["Loin", "FR", 47.5, 7.5, 900, 1500, 5]];
    const g = { lat: 45.19, lon: 5.72 };
    const repond = async () => ({ ok: true, json: async () => ({ code: "Ok", durations: [[0, 1500, 4200]] }) });
    const muet = async () => { throw new Error("réseau"); };
    return { cands: N.candidates(g, liste).map(s => s.nom).join(" "),
      adresse: N.adresseOsrm(g, N.candidates(g, liste)),
      osrm: (await N.proches(g, liste, repond)).map(s => `${s.nom}:${s.minutes}:${s.estime}`).join(" "),
      repli: (await N.proches(g, liste, muet)).map(s => `${s.nom}:${s.estime}`).join(" ") };
  });
  ok("les stations proches sont celles à une heure de route, en une requête à OSRM",
    prochesDit.cands === "A B" && prochesDit.osrm === "A:25:false"
    && prochesDit.adresse.endsWith("/5.72000,45.19000;5.80000,45.20000;5.90000,45.40000?sources=0&annotations=duration"),
    JSON.stringify(prochesDit));
  ok("sans réponse d'OSRM, une estimation à vol d'oiseau prend le relais, marquée comme telle",
    prochesDit.repli === "A:true B:true", prochesDit.repli);
  /* Une seule requête de route dans l'application : la neige passe par
     src/trajets.js, comme les plages, depuis le 2 octobre 2026. Elle gardait
     jusque-là sa propre copie de la requête, point connu de CLAUDE.md. */
  const osrmDit = await pg.evaluate(async () => {
    const noms = ["neige", "plage", "trajets", "eau", "villes"];
    const textes = await Promise.all(noms.map(n => fetch(`/src/${n}.js`).then(r => r.text())));
    return noms.filter((n, k) => textes[k].includes("router.project-osrm.org")).join(" ");
  });
  ok("seul le module des trajets interroge OSRM", osrmDit === "trajets", osrmDit);
  /* Audit, constat 6.9 : la proximité commune de la neige et des plages, dans
     src/trajets.js. Une estimation à vol d'oiseau ne se garde pas : après
     elle, l'ouverture suivante interroge de nouveau OSRM, et une réponse se
     garde, la troisième ouverture n'interrogeant plus rien. */
  const gardeDit = await pg.evaluate(async () => {
    const essai = async (M, g) => {
      let appels = 0;
      const muet = async () => { appels++; throw new Error("réseau"); };
      const repond = async u => {
        appels++;
        const n = new URL(u).pathname.split(";").length;
        return { ok: true, json: async () => ({ code: "Ok", durations: [Array.from({ length: n }, () => 600)] }) };
      };
      const a = await M.prochesGardees(g, muet);
      const apresEstimation = appels;
      await M.prochesGardees(g, repond);
      const apresReponse = appels;
      await M.prochesGardees(g, repond);
      return `${a.length > 0 && a.every(x => x.estime)}:${apresEstimation}:${apresReponse}:${appels}`;
    };
    localStorage.removeItem("mameteo.neige.proches.v1");
    localStorage.removeItem("mameteo.plage.proches.v2");
    const N = await import("/src/neige.js"), P = await import("/src/plage.js");
    const r = { neige: await essai(N, { lat: 45.19, lon: 5.72 }), plage: await essai(P, { lat: 43.45, lon: -1.5 }) };
    localStorage.removeItem("mameteo.neige.proches.v1");
    localStorage.removeItem("mameteo.plage.proches.v2");
    return r;
  });
  ok("une estimation à vol d'oiseau ne se garde pas, une durée de route se garde",
    gardeDit.neige === "true:1:2:2" && gardeDit.plage === "true:1:2:2", JSON.stringify(gardeDit));
  /* Audit, constat 6.8 : la lame d'un dixième de millimètre et le risque de
     cinq pour cent s'écrivent une fois, dans src/previsions.js. Ils étaient
     répétés vingt fois en dur, et le ruban dessinait la pluie dès 0,05 mm
     quand il ne l'écrivait qu'à 0,1. */
  const seuilsDit = await pg.evaluate(async () => {
    const noms = ["ecritures", "ruban", "bande", "beautemps", "pluieproche", "app", "conseils", "activites",
      "vues/avenir", "vues/climat", "vues/heures", "vues/feuilles"];
    const textes = await Promise.all(noms.map(n => fetch(`/src/${n}.js`).then(r => r.text())));
    const lame = /\b(?:mm|pluie|tot|total)\b(?:\[\w+\])?\)?\s*(?:>=|<=|<|>)\s*0\.(?:1|05)\b/;
    const risque = /\b(?:pb|rx)\b(?:\[\w+\])?\)?\s*>=\s*5\b/;
    return noms.filter((n, k) => lame.test(textes[k]) || risque.test(textes[k])).join(" ");
  });
  ok("les seuils de la pluie s'écrivent une seule fois", seuilsDit === "", seuilsDit);
  /* Jalon 16, lot 3 : la neige d'une station, lue à deux altitudes. Le résumé
     d'un point, l'adresse de la requête, la chute notable, la phrase et la
     saison se vérifient sur des données connues. */
  const neigeDit = await pg.evaluate(async () => {
    const N = await import("/src/neige.js");
    const heures = Array.from({ length: 96 }, (_, k) => `2026-12-${String(1 + Math.floor(k / 24)).padStart(2, "0")}T${String(k % 24).padStart(2, "0")}:00`);
    const x = { hourly: { time: heures, snow_depth: heures.map((_, k) => (k >= 72 ? 0.45 : 0.3)),
      snowfall: heures.map((_, k) => (k >= 40 && k < 76 ? 0.5 : 0)), freezing_level_height: heures.map(() => 1234) },
      daily: { time: ["2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05"],
        snowfall_sum: [0, 0, 0, 12, 9], wind_gusts_10m_max: [30, 40, 50, 61.4, 20] } };
    const r = N.resumePoint(x, "2026-12-04T03:00");
    const st = (nom, sol, chutes) => ({ nom, haut: { sol, fraiche72: 5, iso: 1500, chutes: chutes.map((cm, i) => ({ date: `2026-12-0${i + 4}`, cm })) } });
    const u = new URL(N.adresseNeige(Array.from({ length: 12 }, (_, k) => ({ lat: 45, lon: 6, pied: 1400 + k, sommet: 2250 + k })))).searchParams;
    return {
      r: [r.sol, r.fraiche24, r.fraiche72, r.chutes.map(c => c.cm).join("/"), r.iso, r.rafales].join(" "),
      pts: u.get("elevation").split(",").length, alt: u.get("elevation").split(",").slice(0, 2).join(","),
      notable: N.chuteNotable([st("A", 40, [5, 6, 7]), st("B", 50, [4, 12, 6])])?.phrase || "",
      calme: N.chuteNotable([st("A", 40, [5, 6, 7])]),
      phrase: N.phraseNeige([st("A", 40, [0]), st("B", 55, [0])]),
      sans: N.phraseNeige([st("A", 0, [0])]),
      saison: [N.enSaison("2026-11-15", []), N.enSaison("2026-04-30", []), N.enSaison("2026-09-30", []),
        N.enSaison("2026-09-30", [st("A", 12, [0])])].join(" "),
    };
  });
  ok("la neige d'un point se résume : au sol, fraîche sur 24 et 72 heures, chutes à venir, isotherme, rafales",
    neigeDit.r === "45 12 18 12/9 1230 61" && neigeDit.pts === 20 && neigeDit.alt === "1400,2250", JSON.stringify(neigeDit));
  ok("une chute notable se dit à la station où il en tombera le plus, un temps calme se tait",
    neigeDit.notable === "22 cm de neige fraîche attendus à B, d'ici dimanche." && neigeDit.calme === null, JSON.stringify(neigeDit));
  ok("la phrase de la neige nomme la station la mieux enneigée, ou l'isotherme sans neige",
    neigeDit.phrase === "B, 55 cm au sommet, dont 5 cm de fraîche." && /^Pas encore de neige au sol ; isotherme zéro vers 1\s?500 m\.$/.test(neigeDit.sans),
    JSON.stringify(neigeDit));
  ok("la saison de la neige va de novembre à avril, et au-delà tant que la neige tient",
    neigeDit.saison === "true true false true", neigeDit.saison);

  /* L'affichage : sur un état enneigé posé dans la page, la porte large au-dessus
     de la grille, le conseil de chute notable en tête, et la feuille qui range
     les stations sous leur domaine, sources citées. L'état est retiré ensuite. */
  await pg.evaluate(async () => {
    const N = await import("/src/neige.js"), R = await import("/src/reglages.js");
    const g = R.lire();
    const pt = (sol, chutes) => ({ sol, fraiche24: 0, fraiche72: 6, iso: 1200, rafales: 50,
      chutes: chutes.map((cm, i) => ({ date: `2026-08-${String(18 + i).padStart(2, "0")}`, cm })) });
    const st = (nom, dom, sol, chutes) => ({ nom, domaine: dom, minutes: 45, estime: false, pied: 1200, sommet: 2200,
      bas: pt(sol / 2, [0]), haut: pt(sol, chutes) });
    N.poserNeige({ cle: `${g.lat.toFixed(3)},${g.lon.toFixed(3)}`, proches: [1], heure: "2026-08-18T09:00",
      resumes: [st("Station A", null, 40, [10, 12, 5]), st("Domaine B", null, 30, [0]), st("Station C", "Domaine B", 25, [0])] });
  });
  await onglet("semaine");
  await onglet("accueil");
  const neigeAcc = await pg.evaluate(() => {
    const porte = document.querySelector('#ecran .porte-large[data-feuille="neige"]');
    const grille = document.querySelector("#ecran .portes");
    return { porte: !!porte, avant: !!porte && !!grille && (porte.compareDocumentPosition(grille) & Node.DOCUMENT_POSITION_FOLLOWING) > 0,
      sous: porte?.querySelector(".rangee-txt span")?.textContent || "",
      conseil: [...document.querySelectorAll("#ecran .cj-l")].map(l => l.dataset.phrase).find(t => /neige fraîche/.test(t || "")) || "" };
  });
  const porteNeigeVue = await pg.locator('#ecran .porte-large[data-feuille="neige"]').count();
  if (porteNeigeVue) await pg.locator('#ecran .porte-large[data-feuille="neige"]').click();
  await pg.waitForTimeout(600);
  const neigeFeuille = await pg.evaluate(() => ({
    titre: document.querySelector("#feuille-titre, .feuille h2, .feuille-tete h2")?.textContent || "",
    cartes: document.querySelectorAll("#feuille-corps .ng-seule, #feuille-corps .ng-dom").length,
    domaine: [...document.querySelectorAll("#feuille-corps .ng-dom h3")].map(h => h.textContent).join(","),
    ensemble: [...document.querySelectorAll("#feuille-corps .ng-tete b")].filter(b => b.textContent === "Ensemble du domaine").length,
    /* Les sources passent dans les réglages depuis le jalon 20 : la feuille
       n'en cite plus, et garde son explication derrière le « i ». */
    sources: !/OpenSkiMap/.test(document.querySelector("#feuille-corps")?.textContent || "")
      && !!document.querySelector("#feuille-corps details.aide"),
  }));
  /* Le retour ne se fait que si la feuille s'est ouverte : sans elle, il
     quitterait l'application et interromprait la suite. */
  if (porteNeigeVue) { await pg.evaluate(() => history.back()); await pg.waitForTimeout(400); }
  await pg.evaluate(async () => { const N = await import("/src/neige.js"); N.poserNeige(null); });
  await onglet("semaine");
  await onglet("accueil");
  ok("en saison, une porte large mène à la neige, au-dessus de la grille, et une chute notable se dit en tête",
    neigeAcc.porte && neigeAcc.avant && neigeAcc.sous === "Station A, 40 cm au sommet, dont 6 cm de fraîche."
    && /^27 cm de neige fraîche attendus à Station A, /.test(neigeAcc.conseil), JSON.stringify(neigeAcc));
  ok("la feuille de la neige range les stations sous leur domaine, et cite ses sources",
    neigeFeuille.cartes === 2 && neigeFeuille.domaine === "Domaine B" && neigeFeuille.ensemble === 1 && neigeFeuille.sources,
    JSON.stringify(neigeFeuille));
  /* Jalon 15, lot 1 : la liste embarquée des plages, eaux de baignade de mer et
     d'estuaire déclarées à la Commission européenne, France et côtes voisines ;
     chaque plage française porte son département, et les noms sont lisibles. */
  const plagesDit = await pg.evaluate(async () => {
    const { PLAGES } = await import("/src/plages.js");
    const fr = PLAGES.filter(p => p[1] === "FR");
    return { n: PLAGES.length, fr: fr.length,
      /* Neuf champs depuis le 2 octobre 2026 : le dernier est la direction de la
         mer, un angle ou null. */
      formes: PLAGES.every(p => p.length === 9 && typeof p[0] === "string" && p[2] > 41 && p[2] < 51.6 && p[3] > -5.5 && p[3] < 10
        && (p[8] === null || (Number.isInteger(p[8]) && p[8] >= 0 && p[8] < 360))),
      /* Le classement officiel de la qualité de l'eau et la fiche du ministère. */
      classees: fr.filter(p => [0, 1, 2, 3, 4].includes(p[6])).length / fr.length,
      fiches: fr.filter(p => /^[0-9A-Za-z]+:[0-9AB]{2,3}$/.test(p[7] || "")).length / fr.length,
      /* Quelques liens de la source portent un code faux, tenu pour inconnu. */
      departements: fr.filter(p => !/^(\d{2}|2A|2B)$/.test(p[5] || "")).length <= 5,
      capitales: PLAGES.filter(p => p[0] === p[0].toUpperCase() && /[A-Z]{3}/.test(p[0])).length,
      basques: PLAGES.some(p => p[0] === "Côte des Basques" && p[5] === "64" && p[6] === 1 && p[7] === "001130:064"),
      pays: [...new Set(PLAGES.map(p => p[1]))].sort().join(" ") };
  });
  ok("la liste des plages couvre la France et ses côtes voisines, chaque plage française située, les noms lisibles",
    plagesDit.n >= 2000 && plagesDit.fr >= 1800 && plagesDit.formes && plagesDit.departements
    && plagesDit.capitales < 60 && plagesDit.basques && plagesDit.pays === "BE ES FR IT"
    && plagesDit.classees > 0.95 && plagesDit.fiches > 0.95, JSON.stringify(plagesDit));
  /* Jalon 15, lot 2 : les plages à une heure de route, par le module commun des
     trajets ; sans réponse d'OSRM, une estimation à vol d'oiseau. */
  const plagesProches = await pg.evaluate(async () => {
    const P = await import("/src/plage.js"), T = await import("/src/trajets.js");
    const liste = [["A", "FR", 43.49, -1.55, null, "64"], ["B", "FR", 43.60, -1.45, null, "40"], ["Loin", "FR", 47, 2, null, "18"]];
    const g = { lat: 43.48, lon: -1.56 };
    const repond = async () => ({ ok: true, json: async () => ({ code: "Ok", durations: [[0, 300, 4000]] }) });
    const muet = async () => { throw new Error("réseau"); };
    return { cands: P.candidates(g, liste).map(p => p.nom).join(" "),
      osrm: (await P.proches(g, liste, repond)).map(p => `${p.nom}:${p.minutes}:${p.estime}:${p.departement}`).join(" "),
      repli: (await P.proches(g, liste, muet)).map(p => `${p.nom}:${p.estime}`).join(" "),
      adresse: T.adresseOsrm(g, [{ lat: 43.49, lon: -1.55 }]) };
  });
  ok("les plages proches sont celles à une heure de route, en une requête à OSRM",
    plagesProches.cands === "A B" && plagesProches.osrm === "A:5:false:64"
    && plagesProches.adresse.endsWith("/-1.56000,43.48000;-1.55000,43.49000?sources=0&annotations=duration"),
    JSON.stringify(plagesProches));
  ok("sans réponse d'OSRM, les plages proches s'estiment à vol d'oiseau, marquées comme telles",
    plagesProches.repli === "A:true B:true", plagesProches.repli);
  /* Jalon 15, lot 3 : la mer des plages. Les marées se tirent de la hauteur de
     la mer, l'extrême situé entre deux heures ; les plages montrées sont
     espacées de cinq kilomètres ; la phrase et la saison. */
  const merDit = await pg.evaluate(async () => {
    const P = await import("/src/plage.js");
    const time = Array.from({ length: 24 }, (_, k) => `2026-07-01T${String(k).padStart(2, "0")}:00`);
    const niveau = time.map((_, k) => 2 * Math.cos(((k - 6.5) / 12.4) * 2 * Math.PI));
    const m = P.marees(time, niveau, "2026-07-01T00:00");
    const pl = (nom, lat, lon) => ({ nom, lat, lon, pays: "FR" });
    const vues = P.choisir([pl("A", 43.48, -1.56), pl("B", 43.49, -1.56), pl("C", 43.60, -1.50)], 4).map(p => p.nom).join(" ");
    const r = [{ nom: "Côte", mer: { eau: 21.9, vagues: 1, periode: 11, marees: [] } }];
    return { m: m.map(x => `${x.type} ${x.heure} ${x.hauteur}`).join(" | "), vues,
      phrase: P.phrasePlage(r), calme: P.phrasePlage([{ nom: "Anse", mer: { eau: 18, vagues: 0.1, marees: [] } }]),
      saison: [P.enSaisonPlage("2026-07-15", []), P.enSaisonPlage("2026-10-10", r),
        P.enSaisonPlage("2026-10-10", [{ mer: { eau: 17 } }]), P.enSaisonPlage("2026-05-20", [])].join(" ") };
  });
  ok("les marées se situent entre deux heures, pleines et basses mers avec leur hauteur",
    merDit.m === "haute 06 h 30 2 | basse 12 h 42 -2 | haute 18 h 54 2", merDit.m);
  ok("les plages montrées sont espacées de cinq kilomètres, et la phrase dit l'eau et les vagues",
    merDit.vues === "A C" && merDit.phrase === "Côte, eau à 21,9°, vagues de 1 m." && merDit.calme === "Anse, eau à 18°, mer calme.",
    JSON.stringify(merDit));
  ok("la saison de la plage va de juin à septembre, et au-delà tant que l'eau dépasse 20°",
    merDit.saison === "true true false false", merDit.saison);
  /* Jalon 15, lot 3 : l'affichage de la plage, sur un état posé dans la page, puis
     retiré. La porte large au-dessus de la grille ; la feuille avec l'eau, les
     marées, le classement de la qualité de l'eau et la fiche du ministère. */
  await pg.evaluate(async () => {
    const P = await import("/src/plage.js"), R = await import("/src/reglages.js");
    const g = R.lire();
    const mer = { eau: 22.4, vagues: 1.2, periode: 9, marees: [{ type: "basse", heure: "12 h 52", hauteur: -2.1 }, { type: "haute", heure: "19 h 06", hauteur: 1.3 }] };
    P.poserPlage({ cle: `${g.lat.toFixed(3)},${g.lon.toFixed(3)}`, proches: [1], heure: "2026-08-18T09:00", resumes: [
      { nom: "Plage A", pays: "FR", minutes: 12, estime: false, commune: "Biarritz", departement: "64", qualite: 1, fiche: "001130:064", mer, versMer: 300,
        air: { air: 24, max: 27, vent: 10, direction: 270, uv: 6 }, creneau: { jour: "aujourd'hui", de: 13, a: 18 } },
      { nom: "Plage B", pays: "FR", minutes: 20, estime: false, commune: null, departement: "64", qualite: 4, fiche: null, mer,
        air: { air: 24, max: 27, vent: 10, direction: 270, uv: 6 } }] });
  });
  await onglet("semaine");
  await onglet("accueil");
  const plageAcc = await pg.evaluate(() => {
    const porte = document.querySelector('#ecran .porte-large[data-feuille="plage"]');
    return { porte: !!porte, sous: porte?.querySelector(".rangee-txt span")?.textContent || "" };
  });
  const portePlageVue = await pg.locator('#ecran .porte-large[data-feuille="plage"]').count();
  if (portePlageVue) await pg.locator('#ecran .porte-large[data-feuille="plage"]').click();
  await pg.waitForTimeout(600);
  const plageFeuille = await pg.evaluate(() => {
    const c = [...document.querySelectorAll("#feuille-corps .pl-pl")];
    const dd = (i, t) => [...(c[i]?.querySelectorAll("dt") || [])].find(x => x.textContent === t)?.nextElementSibling?.textContent || "";
    return { cartes: c.length, marees: dd(0, "Marées"), marnage: dd(0, "Marnage"), qA: dd(0, "Qualité de l'eau"), qB: dd(1, "Qualité de l'eau"),
      lieuB: c[1]?.querySelector(".pl-lieu")?.textContent || "", ventA: dd(0, "Vent"), ventB: dd(1, "Vent"), bainA: dd(0, "Baignade"),
      fiche: c[0]?.querySelector("a.pl-fiche")?.getAttribute("href") || "", ficheB: !!c[1]?.querySelector("a.pl-fiche") };
  });
  if (portePlageVue) { await pg.evaluate(() => history.back()); await pg.waitForTimeout(400); }
  await pg.evaluate(async () => { const P = await import("/src/plage.js"); P.poserPlage(null); });
  await onglet("semaine");
  await onglet("accueil");
  ok("en saison, une porte large mène à la plage, avec l'eau et les vagues",
    plageAcc.porte && plageAcc.sous === "Plage A, eau à 22,4°, vagues de 1,2 m.", JSON.stringify(plageAcc));
  ok("la feuille de la plage dit les marées, le marnage, la qualité de l'eau classée et mène à la fiche du ministère",
    plageFeuille.cartes === 2 && plageFeuille.marees === "Basse mer 12 h 52, pleine mer 19 h 06" && plageFeuille.marnage === "3,4 m"
    && plageFeuille.qA === "excellente, saison 2024" && plageFeuille.qB === "insuffisante, saison 2024"
    && plageFeuille.lieuB === "Pyrénées-Atlantiques"
    && plageFeuille.ventA === "10 km/h, de l'ouest, venu de la mer" && plageFeuille.ventB === "10 km/h, de l'ouest"
    && plageFeuille.bainA === "conseillée de 13 h à 18 h"
    && plageFeuille.fiche === "https://baignades.sante.gouv.fr/baignades/profil.do?idSite=001130&codeDept=064" && !plageFeuille.ficheB,
    JSON.stringify(plageFeuille));
  /* Jalon 15, lot 4 : les créneaux de baignade, sur une journée d'essai. L'air
     est chaud de 11 h à 16 h, une vague trop forte passe à 14 h : le plus long
     créneau va de 11 h à 14 h. Des vagues trop fortes deux jours durant disent
     leur motif. Le vent se dit par sa direction au niveau de la plage. */
  const bainDit = await pg.evaluate(async () => {
    const P = await import("/src/plage.js");
    const t = [];
    for (const d of ["2026-07-01", "2026-07-02"]) for (let h = 0; h < 24; h++) t.push(`${d}T${String(h).padStart(2, "0")}:00`);
    const heureDe = x => Number(x.slice(11, 13));
    const air = (chaud) => ({ hourly: { time: t, temperature_2m: t.map(chaud), wind_speed_10m: t.map(() => 10),
      wind_direction_10m: t.map(() => 270), precipitation: t.map(() => 0) },
      daily: { time: ["2026-07-01", "2026-07-02"], sunrise: ["2026-07-01T06:30", "2026-07-02T06:31"], sunset: ["2026-07-01T21:40", "2026-07-02T21:40"] } });
    const mer = vague => ({ hourly: { time: t, sea_surface_temperature: t.map(() => 21), wave_height: t.map(vague) } });
    const c1 = P.creneauBaignade(air(x => (x.startsWith("2026-07-01") && heureDe(x) >= 11 && heureDe(x) <= 16 ? 24 : 18)),
      mer(x => (x === "2026-07-01T14:00" ? 2 : 0.8)), "2026-07-01T08:00");
    const c2 = P.creneauBaignade(air(() => 24), mer(() => 2.3), "2026-07-01T08:00");
    return { c1: P.phraseCreneau(c1), c2: P.phraseCreneau(c2), vents: [P.ventDe(270), P.ventDe(45), P.ventDe(180)].join(" | ") };
  });
  ok("un créneau de baignade est la plus longue suite d'heures favorables, ou dit ce qui l'empêche",
    bainDit.c1 === "Baignade conseillée de 11 h à 14 h." && bainDit.c2 === "Pas de bon créneau de baignade aujourd'hui ni demain : vagues de 2,3 m.",
    JSON.stringify(bainDit));
  ok("le vent de la plage se dit par sa direction", bainDit.vents === "de l'ouest | du nord-est | du sud", bainDit.vents);
  /* Le vent rapporté au rivage, quand la plage porte la direction de la mer,
     point connu de CLAUDE.md repris le 2 octobre 2026. La mer est à l'ouest :
     un vent d'ouest vient d'elle, un vent d'est vient de la terre et pousse
     vers le large, un vent du nord longe le rivage. Puis les données : des
     plages dont l'orientation est connue, et Hendaye, trop près de l'Espagne
     pour être orientée. */
  const rivageDit = await pg.evaluate(async () => {
    const P = await import("/src/plage.js");
    const L = await P.listePlages();
    const versMer = nom => L.find(p => p[0] === nom)?.[8];
    return { vents: [P.ventDe(250, 270), P.ventDe(90, 270), P.ventDe(0, 270), P.ventDe(0, null)].join(" | "),
      biarritz: versMer("Grande Plage Nord (Palais)"), palavas: versMer("Carnon Palavas - la Roquille"),
      sables: versMer("Grande Plage Horloge"), etretat: versMer("Étretat-Plage"), hendaye: L.find(p => p[0] === "Casino" && p[5] === "64")?.[8],
      lue: P.candidates({ lat: 43.48, lon: -1.56 }, L).find(p => p.nom === "Grande Plage Nord (Palais)")?.versMer,
      part: L.filter(p => p[1] === "FR" && Number.isFinite(p[8])).length / L.filter(p => p[1] === "FR").length };
  });
  const pres = (v, attendu) => Number.isFinite(v) && Math.abs(((v - attendu + 540) % 360) - 180) <= 25;
  ok("le vent de la plage se rapporte au rivage : de mer, de terre ou le long du rivage",
    rivageDit.vents === "de l'ouest, venu de la mer | de l'est, venu de la terre : il pousse vers le large | du nord, le long du rivage | du nord",
    rivageDit.vents);
  ok("la direction de la mer des plages connues est la bonne, Hendaye n'en a pas, et la plage lue la garde",
    pres(rivageDit.biarritz, 300) && rivageDit.lue === rivageDit.biarritz && pres(rivageDit.palavas, 160) && pres(rivageDit.sables, 205) && pres(rivageDit.etretat, 320)
    && rivageDit.hendaye === null && rivageDit.part > 0.6,
    JSON.stringify(rivageDit));
  /* Jalon 18, lot 1 : les niveaux de VigiEau se rangent de la vigilance à la
     crise ; un département sans arrêté ne paraît pas. */
  const rangsEau = await pg.evaluate(async () => {
    const V = await import("/src/vigieau.js");
    const t = V.versRangs([{ code: "21", niveauGraviteMax: "crise" }, { code: "2A", niveauGraviteMax: "alerte_renforcee" },
      { code: "1", niveauGraviteMax: "vigilance" }, { code: "13", niveauGraviteMax: null }, { code: "75", niveauGraviteMax: "alerte" }]);
    return [...t].map(([c, r]) => `${c}:${r}`).join(" ");
  });
  ok("les restrictions d'eau se rangent de la vigilance à la crise", rangsEau === "21:4 2A:3 01:1 75:2", rangsEau);
  /* Jalon 18, lot 2 : l'eau de la commune. La restriction se range par
     ressource ; l'état d'une nappe se lit par la part des années plus basses ; le
     piézomètre retenu mesure depuis quinze ans et a une mesure récente. */
  const eauPur = await pg.evaluate(async () => {
    const E = await import("/src/eau.js");
    const r = E.restrictionsDe([{ type: "AEP", niveauGravite: "vigilance" }, { type: "SUP", niveauGravite: "alerte_renforcee",
      arrete: { cheminFichier: "a.pdf", dateFinValidite: "2026-10-31T00:00:00Z" } }, { type: "SOU", niveauGravite: null }]);
    const serie = (pente) => { const l = []; for (let an = 2000; an <= 2026; an++) for (let j = 1; j <= 28; j++)
      l.push({ date_mesure: `${an}-08-${String(j).padStart(2, "0")}`, niveau_nappe_eau: 100 + (an - 2000) * pente }); return l; };
    const court = serie(0.01).filter(x => x.date_mesure >= "2020");
    const g = { lat: 47.6, lon: 4.3 };
    const st = [{ code_bss: "vieux", x: 4.31, y: 47.61, date_debut_mesure: "1990-01-01", date_fin_mesure: "2020-01-01" },
      { code_bss: "jeune", x: 4.30, y: 47.60, date_debut_mesure: "2018-01-01", date_fin_mesure: "2026-09-28" },
      { code_bss: "loin", x: 5.30, y: 47.60, date_debut_mesure: "1995-01-01", date_fin_mesure: "2026-09-28" },
      { code_bss: "bon", x: 4.50, y: 47.60, date_debut_mesure: "1995-01-01", date_fin_mesure: "2026-09-25" }];
    return { r: `${r.rang} ${r.niveau} ${r.zones.map(z => z.type).join(",")}`,
      haute: E.etatNappe(serie(0.01))?.classe, basse: E.etatNappe(serie(-0.01))?.classe, court: E.etatNappe(court),
      choisi: E.choisirPiezo(st, g, "2026-09-30")?.code_bss, nom: E.nomPropre("FORAGE CD21  (LAIGNES-21)"),
      tuile: JSON.stringify(E.tuileEau({ restriction: r, nappe: { classe: "basse" } })) };
  });
  ok("la restriction de la commune se range par ressource, la plus grave en tête",
    eauPur.r === "3 Alerte renforcée SUP,AEP", JSON.stringify(eauPur));
  ok("l'état d'une nappe se lit par la part des années plus basses, dix années au moins",
    eauPur.haute === "très haute" && eauPur.basse === "très basse" && eauPur.court === null, JSON.stringify(eauPur));
  ok("le piézomètre retenu mesure depuis quinze ans et a une mesure récente, le plus proche",
    eauPur.choisi === "bon" && eauPur.nom === "Forage CD21 (Laignes-21)"
    && eauPur.tuile === '{"valeur":"Alerte renforcée","sous":"nappe basse","classe":"v-chaud"}', JSON.stringify(eauPur));

  /* L'eau sur l'accueil et dans sa feuille, pour la commune d'essai : la tuile, le
     conseil d'une restriction en alerte, et le détail. */
  await pg.waitForFunction(() => /nappe très haute/.test(document.querySelector("#ecran .bd-mesures")?.textContent || ""), null, { timeout: 8000 }).catch(() => {});
  const eauAcc = await pg.evaluate(() => {
    const t = [...document.querySelectorAll("#ecran .bd-mesures .bd-m")].find(x => /L'eau/.test(x.textContent));
    return { tuile: t ? t.textContent.replace(/\s+/g, " ").trim() : "", classe: t?.querySelector(".v-attention") ? "v-attention" : "",
      conseil: [...document.querySelectorAll("#ecran .cj-l")].map(l => l.dataset.phrase).find(x => /^Restriction d'eau/.test(x || "")) || "" };
  });
  const tuileEau = pg.locator("#ecran .bd-mesures .bd-m", { hasText: "L'eau" });
  const tuileEauVue = await tuileEau.count();
  if (tuileEauVue) await tuileEau.first().click();
  await pg.waitForTimeout(600);
  const eauFeuille = await pg.evaluate(() => {
    const dd = t => [...document.querySelectorAll("#feuille-corps dt")].find(x => x.textContent === t)?.nextElementSibling?.textContent || "";
    return { surface: dd("Eaux de surface"), potable: dd("Eau potable"), etat: dd("État"), tendance: dd("Tendance sur une semaine"),
      arrete: document.querySelector('#feuille-corps a[href="https://exemple.gouv.fr/arrete.pdf"]')?.textContent || "",
      piezo: document.querySelector("#feuille-corps .pl-lieu")?.textContent || "" };
  });
  if (tuileEauVue) { await pg.evaluate(() => history.back()); await pg.waitForTimeout(400); }
  /* Une tuile qui ouvre une feuille dit au lecteur d'écran laquelle. Jusqu'à la
     version 119, toutes disaient « voir l'air qu'on respire », la tuile de l'eau
     comprise. */
  const tuilesVers = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll("#ecran .bd-m.tuile[data-feuille]")]
    .map(b => [b.dataset.feuille, b.getAttribute("aria-label").replace(/^.*, /, "")])));
  ok("une tuile qui ouvre une feuille dit au lecteur d'écran celle qu'elle ouvre",
    tuilesVers.air === "voir l'air qu'on respire" && tuilesVers.eau === "voir l'eau", JSON.stringify(tuilesVers));
  ok("la tuile de l'eau dit la restriction et la nappe, et une alerte se dit parmi les conseils",
    /L'eau\s*Alerte\s*nappe très haute/.test(eauAcc.tuile) && eauAcc.classe === "v-attention"
    && eauAcc.conseil === "Restriction d'eau : alerte, usages de l'eau encadrés par arrêté.", JSON.stringify(eauAcc));
  ok("la feuille de l'eau détaille la restriction, son arrêté, et l'état de la nappe",
    eauFeuille.surface === "Alerte" && eauFeuille.potable === "Vigilance" && eauFeuille.etat === "très haute" && eauFeuille.tendance === "stable"
    && eauFeuille.arrete === "L'arrêté en vigueur, jusqu'au 31 octobre"
    && /^Plus haute que 30 des 30 années comparables, au 15 août\. Piézomètre Puits de la Fontaine \(Montbard-21\), à \d+ km\.$/.test(eauFeuille.piezo),
    JSON.stringify(eauFeuille));
  /* Jalon 18, lot 2 : la rivière. La situation d'un débit se lit par la part des
     années plus basses ; la tendance de la hauteur, à deux centimètres près. */
  const riviereDit = await pg.evaluate(async () => {
    const E = await import("/src/eau.js");
    const serie = (actuel) => { const l = []; for (let an = 2000; an <= 2026; an++) for (let j = 1; j <= 20; j++)
      l.push({ date_obs_elab: `${an}-08-${String(j).padStart(2, "0")}`, resultat_obs_elab: an === 2026 ? actuel : 500 + an }); return l; };
    const h = v => v.map((x, i) => ({ resultat_obs: x, date_obs: `t${i}` }));
    const bas = E.etatDebit(serie(100)), haut = E.etatDebit(serie(9000));
    return { bas: `${bas?.classe} ${bas?.plusBas}/${bas?.annees} ${bas?.mediane}`, haut: haut?.classe,
      tendances: [E.tendanceHauteur(h([500, 530])), E.tendanceHauteur(h([500, 470])), E.tendanceHauteur(h([500, 510])), E.tendanceHauteur(h([500]))].map(String).join(" ") };
  });
  ok("la situation d'un débit se lit par la part des années plus basses, et la tendance de la hauteur à deux centimètres près",
    riviereDit.bas === "très bas 0/26 2513" && riviereDit.haut === "très haut" && riviereDit.tendances === "en hausse en baisse stable null",
    JSON.stringify(riviereDit));

  /* La rivière dans la feuille de l'eau : la station qui mesure le débit passe
     devant l'échelle de secours plus proche. */
  await tuileEau.first().click();
  await pg.waitForFunction(() => { const c = [...document.querySelectorAll("#feuille-corps .carte")].find(x => /Rivière/.test(x.textContent));
    return c && !/Lecture de la rivière/.test(c.textContent); }, null, { timeout: 15000 }).catch(() => {});
  const riviereFeuille = await pg.evaluate(() => {
    const c = [...document.querySelectorAll("#feuille-corps .carte")].find(x => /Rivière/.test(x.textContent));
    const dd = t => [...(c?.querySelectorAll("dt") || [])].find(x => x.textContent === t)?.nextElementSibling?.textContent || "";
    return { station: c?.querySelector(".pl-lieu")?.textContent || "", hauteur: dd("Hauteur"), debit: dd("Débit"), saison: dd("Pour la saison"),
      phrase: [...(c?.querySelectorAll(".pl-lieu") || [])][1]?.textContent || "" };
  });
  await pg.evaluate(() => history.back()); await pg.waitForTimeout(400);
  ok("la rivière retenue mesure le débit, et la feuille dit sa hauteur, sa tendance et sa situation",
    /^La Seine à Fain, à \d+ km$/.test(riviereFeuille.station) && riviereFeuille.hauteur === "55 cm, en hausse"
    && riviereFeuille.debit === "800 l/s" && riviereFeuille.saison === "très bas"
    && riviereFeuille.phrase === "Sur les sept derniers jours, 100 l/s contre 1 m³/s en médiane des 31 années précédentes à la même date, le plus bas de toutes.",
    JSON.stringify(riviereFeuille));
  /* Jalon 18, lot 2 : l'étiage d'été, bilan de la dernière campagne. */
  const etiageDit = await pg.evaluate(async () => {
    const E = await import("/src/eau.js");
    const o = (code, date, ec, dlo) => ({ code_station: code, libelle_station: `POINT ${code}`, latitude: 47.6, longitude: 4.3 + dlo,
      date_observation: `${date}T00:00:00Z`, libelle_ecoulement: ec });
    /* Des noms sans lettre isolée : un « A » seul entre deux mots se lit « à ». */
    const b = E.bilanEtiage([o("NORD", "2026-08-01", "Ecoulement visible acceptable", 0.01), o("NORD", "2026-08-10", "Assec", 0.01),
      o("SUD", "2026-08-10", "Ecoulement visible faible", 0.1), o("EST", "2026-08-01", "Assec", 0.2), o("OUEST", "2026-08-10", "Ecoulement non visible", 0.3)],
      { lat: 47.6, lon: 4.3 });
    return { b: `${b.date} ${b.total} ${b.sec}/${b.interrompu}/${b.faible}/${b.visible} ${b.proche.station} ${b.proche.ecoulement}`,
      sortes: ["Assec", "Ecoulement non visible", "Ecoulement visible faible", "Ecoulement visible acceptable", "?"].map(E.sorteEcoulement).map(String).join(" ") };
  });
  ok("l'étiage se résume par la dernière campagne, chaque point à sa dernière observation",
    etiageDit.b === "2026-08-10 3 1/1/1/0 Point Nord à sec" && etiageDit.sortes === "sec interrompu faible visible null", JSON.stringify(etiageDit));

  /* L'étiage et la température de l'eau dans la feuille, sous la rivière. */
  await tuileEau.first().click();
  await pg.waitForFunction(() => /Étiage observé/.test(document.querySelector("#feuille-corps")?.textContent || "")
    && /Eau de la rivière/.test(document.querySelector("#feuille-corps")?.textContent || ""), null, { timeout: 15000 }).catch(() => {});
  const etiageFeuille = await pg.evaluate(() => [...document.querySelectorAll("#feuille-corps .pl-lieu")].map(p => p.textContent)
    .filter(t => /Étiage|Eau de la rivière/.test(t)));
  await pg.evaluate(() => history.back()); await pg.waitForTimeout(400);
  ok("la feuille de l'eau dit l'étiage de la dernière campagne et la température récente de la rivière",
    etiageFeuille.length === 2
    && /^Étiage observé le 10 août dans un rayon d'environ 35 km, sur 4 cours d'eau : 2 à sec, 1 à écoulement interrompu, 1 à écoulement faible\. Le plus proche, Le Ru de Fain à Fain, à \d+ km : écoulement faible\.$/.test(etiageFeuille[0])
    && etiageFeuille[1] === "Eau de la rivière : 18,5°, mesurée à La Seine à Fain le 16 août à 14 h 00.",
    JSON.stringify(etiageFeuille));
  /* Jalon 18, lot 2 : le sol et l'arrosage. L'humidité se classe en quatre, le
     bilan oppose la pluie à l'évaporation, le conseil suit sa règle. */
  const solDit = await pg.evaluate(async () => {
    const E = await import("/src/eau.js");
    const jours = Array.from({ length: 11 }, (_, k) => `2026-07-${String(10 + k).padStart(2, "0")}`);
    const charge = (v, pluie) => ({ hourly: { time: [`2026-07-17T12:00`], soil_moisture_9_to_27cm: [v] },
      daily: { time: jours, precipitation_sum: pluie, et0_fao_evapotranspiration: jours.map(() => 3) } });
    const sec = E.bilanSol(charge(0.13, jours.map(() => 0)), "2026-07-17");
    const mouille = E.bilanSol(charge(0.2, jours.map((_, k) => (k === 8 ? 8 : 0))), "2026-07-17");
    const frais = E.bilanSol(charge(0.26, jours.map((_, k) => (k < 7 ? 4 : 0))), "2026-07-17");
    return { sec: `${sec.classe} ${sec.humidite} ${sec.pluie7} ${sec.eau7} ${sec.pluie3}`,
      conseils: [E.conseilArrosage(sec, null), E.conseilArrosage(mouille, { rang: 3 }), E.conseilArrosage(frais, null),
        E.conseilArrosage(frais, { rang: 2 })].join(" | ") };
  });
  ok("l'humidité du sol se classe, et le conseil d'arrosage suit la pluie attendue, la sécheresse et la restriction",
    solDit.sec === "très sec 13 0 21 0"
    && solDit.conseils === "Arrosage utile : le sol a perdu 21 mm en une semaine. | Inutile d'arroser : 8 mm de pluie attendus d'ici après-demain. | "
      + "Pas besoin d'arroser pour l'instant. | Pas besoin d'arroser pour l'instant ; l'arrosage reste encadré par l'arrêté en vigueur.",
    JSON.stringify(solDit));

  /* Le sol et l'arrosage dans la feuille de l'eau, pour la commune d'essai, en
     alerte : un sol sec qui a perdu 21 mm, arrosage utile mais encadré. */
  await tuileEau.first().click();
  await pg.waitForFunction(() => { const c = [...document.querySelectorAll("#feuille-corps .carte")].find(x => /Le sol et l'arrosage/.test(x.textContent));
    return c && !/Lecture du sol/.test(c.textContent); }, null, { timeout: 15000 }).catch(() => {});
  /* Depuis le jalon 20, lot 2, le sol suit l'étiage dans « Plus de détails » :
     le conseil est le dernier paragraphe de la carte. */
  const solFeuille = await pg.evaluate(() => {
    const c = [...document.querySelectorAll("#feuille-corps .carte")].find(x => /Le sol et l'arrosage/.test(x.textContent));
    const dd = t => [...(c?.querySelectorAll("dt") || [])].find(x => x.textContent.replace(/[\u00A0\u202F]/g, " ") === t)?.nextElementSibling?.textContent || "";
    return { humidite: dd("Humidité du sol, 9 à 27 cm"), semaine: dd("Sept derniers jours"), attendue: dd("Pluie attendue d'ici après-demain"),
      conseil: [...(c?.querySelectorAll(".pl-lieu") || [])].pop()?.textContent || "" };
  });
  await pg.evaluate(() => history.back()); await pg.waitForTimeout(400);
  ok("la feuille de l'eau dit l'humidité du sol, la semaine écoulée, la pluie attendue et le conseil d'arrosage",
    solFeuille.humidite === "sec, 18 %" && solFeuille.semaine === "0 mm de pluie, 21 mm évaporés" && solFeuille.attendue === "3 mm"
    && solFeuille.conseil === "Arrosage utile, mais encadré par l'arrêté en vigueur : vérifiez les usages permis.", JSON.stringify(solFeuille));
  /* Jalon 18, lot 3 : le temps d'une ville pour chaque moment. */
  const momentDit = await pg.evaluate(async () => {
    const V = await import("/src/villes.js");
    const time = ["2026-08-18", "2026-08-19"].flatMap(j => Array.from({ length: 24 }, (_, h) => `${j}T${String(h).padStart(2, "0")}:00`));
    const x = { hourly: { time, weather_code: time.map(t => (t === "2026-08-18T16:00" ? 95 : t.startsWith("2026-08-19") ? 3 : 1)),
      temperature_2m: time.map(t => Number(t.slice(11, 13)) + (t.startsWith("2026-08-19") ? 0.4 : 0)), is_day: time.map(t => (+t.slice(11, 13) >= 7 && +t.slice(11, 13) < 20 ? 1 : 0)) } };
    const m = k => { const r = V.tempsMoment(x, k, "2026-08-18"); return `${r.code}${r.jour ? "j" : "n"} ${r.t}${k === "demain" ? ` ${r.min}/${r.max}` : ""}`; };
    return { matin: m("matin"), apres: m("apres"), soir: m("soir"), demain: m("demain"), defauts: [10, 15, 20, 23].map(V.momentDe).join(" ") };
  });
  ok("le temps d'une ville se lit pour chaque moment : 9 h, le maximum de l'après-midi, 21 h, le lendemain",
    momentDit.matin === "1j 9" && momentDit.apres === "95j 17" && momentDit.soir === "1n 21" && momentDit.demain === "3j 12 0/23"
    && momentDit.defauts === "matin apres soir demain", JSON.stringify(momentDit));
  /* Jalon 18, lot 3 : l'espacement des points de la mer et de la neige. */
  const pointsDit = await pg.evaluate(async () => {
    const P = await import("/src/plage.js"), N = await import("/src/neige.js");
    const pl = km => [`P${km}`, "FR", 45, 1 + km / 78.7, null, "33", 1, null];
    const st = (nom, lon, km, dom = null) => [nom, "FR", 45, lon, 1000, 2000, km, dom];
    /* Soixante kilomètres tout juste se mesurent un peu moins sur la sphère : la
       dernière plage d'essai est à soixante-dix de la précédente. */
    return { plages: P.plagesCarte([pl(0), pl(30), pl(70), pl(140)], 60).map(p => p.nom).join(" "),
      domaines: N.domainesCarte([st("Petit", 7, 30), st("Grand", 6, 100), st("Voisin", 6.1, 50), st("Rattaché", 8, 60, "Grand"), st("Loin", 7.5, 45)], 25)
        .map(s => s.nom).join(" ") };
  });
  ok("les plages de la carte s'espacent de soixante kilomètres, les grands domaines de vingt-cinq, les plus grands d'abord",
    pointsDit.plages === "P0 P70 P140" && pointsDit.domaines === "Grand Loin", JSON.stringify(pointsDit));
  /* Jalon 18, lot 3 : la lecture des cours d'eau d'un cadre, regroupée par
     station, quel que soit l'ordre des mesures. */
  const rivPur = await pg.evaluate(async () => {
    const E = await import("/src/eau.js");
    const o = (c, t, v) => ({ code_station: c, date_obs: `2026-08-18T0${t}:00:00Z`, resultat_obs: v, latitude: 47, longitude: 4 });
    const repond = async () => ({ ok: true, json: async () => ({ data: [o("A", 3, 100), o("B", 9, 50), o("A", 9, 130), o("B", 3, 80), o("A", 6, 110)] }) });
    const l = await E.lireRivieresCarte({ o: 3, s: 46, e: 5, n: 48 }, new Date("2026-08-18T10:00:00Z"), repond);
    return l.map(r => `${r.code}:${r.h}:${r.ecart}`).sort().join(" ");
  });
  ok("les cours d'eau d'un cadre se regroupent par station, la hauteur la plus récente et l'écart sur six heures",
    rivPur === "A:130:30 B:50:-30", rivPur);
  ok("le graphique borne sa largeur, et se résume en une phrase",
    semGraphe.borne === "520px"
    && semGraphe.resume === "De 25 à 30 degrés au plus chaud, 5,4 millimètres de pluie en tout.",
    `${semGraphe.borne} | ${semGraphe.resume}`);
  ok("chaque journée à venir porte son niveau de confiance, en un mot",
    semConf.mots.length >= 3 && semConf.passes === 0
    && semConf.mots.every(m => ["fiable", "à confirmer", "incertain"].includes(m)),
    `${semConf.mots.join(", ")} ; jours passés marqués : ${semConf.passes}`);
  ok("la barre s'estompe aux journées moins sûres, et elles seules",
    semConf.incertaines > 0 && semConf.estompe && semConf.nettes,
    `${semConf.incertaines} barres estompées`);

  /* Jalon 12, lot 6 : le second dessin sur Le ciel. Toute carte prend l'arrondi
     de 24 points, et le premier symbole d'une rangée se pose dans une pastille,
     teintée de la couleur du Soleil dans la course du jour. */
  await onglet("ciel");
  const cielDessin = await pg.evaluate(() => {
    const rayons = [...document.querySelectorAll("#ecran .carte")].map(c => getComputedStyle(c).borderTopLeftRadius);
    const symboles = [...document.querySelectorAll("#ecran .rangee > svg:first-child")];
    const soleil = document.createElement("span");
    soleil.style.color = "var(--ic-soleil)"; document.body.append(soleil);
    const teinte = getComputedStyle(soleil).color; soleil.remove();
    const course = symboles.filter(x => x.classList.contains("pa-soleil"));
    return {
      cartes: rayons.length, rondes: rayons.every(r => r === "24px"),
      symboles: symboles.length,
      pastilles: symboles.every(x => !/rgba\(0, 0, 0, 0\)|transparent/.test(getComputedStyle(x).backgroundColor)),
      course: course.length, soleil: course.every(x => getComputedStyle(x).color === teinte),
    };
  });
  await onglet("accueil");
  ok("toute carte prend l'arrondi de 24 points, Le ciel compris",
    cielDessin.cartes > 2 && cielDessin.rondes, `${cielDessin.cartes} cartes`);
  ok("le premier symbole d'une rangée se pose dans une pastille, teintée du Soleil dans la course du jour",
    cielDessin.symboles > 0 && cielDessin.pastilles && cielDessin.course >= 2 && cielDessin.soleil,
    JSON.stringify(cielDessin));

  /* Jalon 12, lot 7 : la justesse publiée, préparée. Le bilan par échéance se
     vérifie sur un journal d'essai connu, et la carte paraît dans les réglages. */
  const justesseDit = await pg.evaluate(async () => {
    const J = await import("/src/justesse.js");
    const l = [];
    for (let d = 1; d <= 12; d++) for (const [e, err] of [[24, 1], [72, -2.5]]) {
      l.push({ l: "x", c: `2026-09-${String(d).padStart(2, "0")}T15`, e, t: 20 + err * (d % 2 ? 1 : 0.5), r: 20 });
    }
    const b = J.bilan(l);
    const peu = J.bilan(l.slice(0, 8)).paliers.find(p => p.e === 24);
    return { b: { jours: b.jours, assis: b.assis, p: b.paliers.filter(p => p.n).map(p => [p.e, p.ecart, p.biais, p.part2]) },
      peu: peu ? peu.ecart : "absent", nom: [J.nomEcheance(6), J.nomEcheance(24), J.nomEcheance(72)] };
  });
  ok("la justesse se calcule par échéance : écart, biais et part à 2° près",
    JSON.stringify(justesseDit.b) === JSON.stringify({ jours: 12, assis: false, p: [[24, 0.8, 0.8, 100], [72, 1.9, -1.9, 50]] })
    && justesseDit.nom.join(" | ") === "dans 6 h | à 1 jour | à 3 jours",
    JSON.stringify(justesseDit));
  ok("une échéance ne paraît qu'avec assez de relevés", justesseDit.peu === undefined, String(justesseDit.peu));
  /* La page des contrôles n'a pas encore de relevé à cet endroit : la carte y
     montrerait sa phrase d'attente, et une phrase sur le délai, qui ne vit que
     dans la carte chiffrée, passerait inaperçue. Un journal de six relevés est
     posé le temps de la mesure, puis le journal d'origine est rendu. */
  const journalAvant = await pg.evaluate(() => {
    const avant = localStorage.getItem("mameteo.justesse.v1");
    const l = [];
    for (let d = 1; d <= 6; d++) l.push({ l: "x", c: `2026-08-0${d}T15`, e: 24, t: 21, r: 20 });
    localStorage.setItem("mameteo.justesse.v1", JSON.stringify({ v: 1, lignes: l }));
    return avant;
  });
  await pg.locator("#btnReglages").click();
  await pg.waitForTimeout(600);
  const carteJustesse = await pg.evaluate(() => {
    const c = [...document.querySelectorAll("#feuille-corps .carte")].find(x => /Justesse des prévisions/.test(x.textContent));
    /* Aucune phrase sur le délai, retirées le 27 septembre 2026. */
    if (c && /assiéront|paraît dès|relevés depuis/.test(c.textContent)) return "délai";
    return c ? (c.querySelectorAll(".rangee").length ? "chiffres" : /Aucun relevé/.test(c.textContent) ? "attente" : "vide") : "absente";
  });
  await pg.evaluate(() => history.back());
  await pg.waitForTimeout(500);
  await pg.evaluate(a => (a === null ? localStorage.removeItem("mameteo.justesse.v1")
    : localStorage.setItem("mameteo.justesse.v1", a)), journalAvant);
  ok("les réglages disent la justesse sans phrase sur le délai",
    carteJustesse === "chiffres", carteJustesse);

  /* L'accueil ne parle que de demain : après-demain se lit dans La semaine
     seulement, demandé le 27 septembre 2026. */
  const suiteDit = await pg.evaluate(() => {
    const b = document.querySelector('#ecran [data-bloc="suite"]');
    return { titre: b?.querySelector("h2")?.textContent || "",
      apres: [...document.querySelectorAll('#ecran [data-bloc="suite"] .cj-l')]
        .map(l => l.dataset.phrase || l.textContent).filter(t => /après-demain/i.test(t)) };
  });
  ok("l'accueil ne parle que de demain, après-demain restant dans La semaine",
    (suiteDit.titre === "" || suiteDit.titre === "Demain") && suiteDit.apres.length === 0,
    `« ${suiteDit.titre} » ${suiteDit.apres.join(" | ")}`);

  /* Le ciel couvert, repris le 28 septembre 2026 : une couche fermée se peint en
     bancs de nuages, et non plus en flou. La mesure est l'écart moyen de
     luminosité entre deux points voisins verticalement, qui grandit avec les
     bords des bancs. Relevée à la reprise, elle valait 1,2 de jour comme de nuit
     pour l'ancienne nappe floutée, 3,6 de jour et 2,3 de nuit pour le plafond. */
  const structureCiel = await pg.evaluate(async () => {
    const V = await import("/src/vues.js"), T = await import("/src/temps.js");
    const g = { lat: 47.63, lon: 4.38 };
    const out = {};
    for (const [nom, q] of [["jour", "2026-09-28T13:00:00+02:00"], ["nuit", "2026-09-28T03:00:00+02:00"]]) {
      const d = document.createElement("div");
      d.style.cssText = "position:fixed;left:0;top:0;width:390px;z-index:99";
      d.innerHTML = `<div class="plein plein-accueil">${V.bandeauAccueil(g, new Date(q), T.depuis(3, 100, 0), 10).ciel}</div>`;
      document.body.append(d);
      await new Promise(res => setTimeout(res, 100));
      const cv = d.querySelector("canvas.ci-temps");
      T.dessiner(cv, 20000);
      const W = cv.width, H = cv.height;
      const px = cv.getContext("2d").getImageData(0, 0, W, H).data;
      const lum = (i, j) => { const k = (j * W + i) * 4; return 0.2126 * px[k] + 0.7152 * px[k + 1] + 0.0722 * px[k + 2]; };
      /* Le pas se compte en points d'écran : à forte densité de pixels, un pas de
         trois pixels de toile mesurait un écart deux ou trois fois plus court. */
      const pas = Math.max(1, Math.round(3 * H / cv.getBoundingClientRect().height));
      let somme = 0, n = 0;
      for (let i = 4; i < W; i += Math.max(1, Math.floor(W / 40))) {
        for (let j = 0; j + pas < H; j += pas) { somme += Math.abs(lum(i, j + pas) - lum(i, j)); n++; }
      }
      out[nom] = Math.round(somme / n * 100) / 100;
      d.remove();
    }
    return out;
  });
  ok("un ciel couvert se peint en bancs de nuages, de jour comme de nuit, et non en flou",
    structureCiel.jour >= 1.7 && structureCiel.nuit >= 1.7, JSON.stringify(structureCiel));

  /* Un couvert sec de plein jour reste clair : Jérôme l'a comparé le 28 septembre
     2026 à une photo du ciel réel, et le premier plafond, comme les voiles de
     lisibilité presque noirs, le faisaient lire comme un ciel d'orage. La clarté
     du haut de la toile valait 196 avec les teintes de nuit, 208 avec le poids ;
     la pluie, 119. Et les voiles se resserrent sur le texte, en bleu-gris. */
  const clarteCouvert = await pg.evaluate(async () => {
    const V = await import("/src/vues.js"), T = await import("/src/temps.js");
    const out = {};
    for (const [nom, code, mm] of [["sec", 3, 0], ["pluie", 61, 2]]) {
      const d = document.createElement("div"); d.style.cssText = "position:fixed;left:0;top:0;width:390px;z-index:99";
      d.innerHTML = `<div class="plein plein-accueil">${V.bandeauAccueil({ lat: 47.63, lon: 4.38 },
        new Date("2026-09-28T12:00:00+02:00"), T.depuis(code, 100, mm), 10).ciel}</div>`;
      document.body.append(d); await new Promise(r => setTimeout(r, 100));
      const cv = d.querySelector("canvas.ci-temps"); T.dessiner(cv, 20000);
      const W = cv.width, H = cv.height, px = cv.getContext("2d").getImageData(0, 0, W, Math.round(H * 0.56)).data;
      let som = 0; for (let k = 0; k < px.length; k += 16) som += 0.2126 * px[k] + 0.7152 * px[k + 1] + 0.0722 * px[k + 2];
      out[nom] = Math.round(som / (px.length / 16));
      if (nom === "sec") {
        const ci = d.querySelector(".ci"), vb = d.querySelector(".ci-voile-bas"), vh = d.querySelector(".ci-voile-haut");
        const hc = ci.getBoundingClientRect().height;
        out.bas = Math.round(vb.getBoundingClientRect().height / hc * 100);
        out.haut = Math.round(vh.getBoundingClientRect().height / hc * 100);
        out.teinte = /rgba\(22, 34, 52/.test(getComputedStyle(vb).backgroundImage);
      }
      d.remove();
    }
    return out;
  });
  ok("un couvert sec de plein jour reste clair, la pluie l'assombrit",
    clarteCouvert.sec >= 202 && clarteCouvert.pluie <= clarteCouvert.sec - 50, JSON.stringify(clarteCouvert));
  ok("les voiles de lisibilité se resserrent sur le texte, en bleu-gris",
    clarteCouvert.bas <= 45 && clarteCouvert.haut <= 23 && clarteCouvert.teinte, JSON.stringify(clarteCouvert));

  /* Jalon 11, lot 4 : le département sous la commune, qu'il se déduise du code
     postal ou manque, et l'arrondi de 24 points des cartes de l'accueil. */
  const enteteDit = await pg.evaluate(async () => {
    const V = await import("/src/vigilance.js");
    const H = await import("/src/horloge.js");
    const r = JSON.parse(localStorage.getItem("mameteo.reglages.v1") || "{}");
    const attendu = V.nomDe(H.departementDe(r.codePostal)) || "";
    const dep = document.getElementById("navLieuDep");
    const rayon = el => el ? getComputedStyle(el).borderTopLeftRadius : "";
    return {
      lecci: V.nomDe(H.departementDe("20137")), paris: V.nomDe(H.departementDe("75011")),
      accord: dep.textContent === attendu && dep.hidden === !attendu,
      hauteur: Math.round(document.getElementById("navLieu").getBoundingClientRect().height),
      rayons: [rayon(document.getElementById("bande")), rayon(document.querySelector("[data-bloc] .carte.retenir"))],
    };
  });
  ok("l'en-tête porte le département sous la commune, sans grandir",
    enteteDit.lecci === "Corse-du-Sud" && enteteDit.paris === "Paris" && enteteDit.accord && enteteDit.hauteur <= 46,
    JSON.stringify(enteteDit));
  ok("les cartes de l'accueil prennent l'arrondi de 24 points",
    enteteDit.rayons.every(x => x === "24px"), enteteDit.rayons.join(" "));

  /* Jalon 11, lot 2 : les conseils en deux lignes, titre et précision, avec un
     chevron vers le détail qu'ils décrivent. Et l'écriture des plages, qui
     donnait « de après-demain 00 h à 00 h » pour une journée entière. */
  const conseilDit = await pg.evaluate(async () => {
    const C = await import("/src/conseils.js");
    const html = C.conseilsHTML([{ i: "brume", t: "Air dégradé de 16 h à 18 h, indice 40.", d: "feuille:air" }]);
    const lignes = [...document.querySelectorAll("#ecran .carte.retenir .cj-l")];
    const voies = new Set(["t", "mm", "v", "nua", "hum", "uv", "pres"]);
    return {
      deuxLignes: html.includes("<b>Air dégradé de 16 h à 18 h</b><em>Indice 40</em>")
        && html.includes('data-feuille="air"') && html.includes("cj-chev"),
      lignes: lignes.length,
      menent: lignes.every(l => l.classList.contains("cj-porte")
        && (voies.has(l.dataset.detail) || ["air", "eau", "neige", "plage"].includes(l.dataset.feuille))),
      plages: [C.ecrirePlage(2, 0, 2, 23, 3), C.ecrirePlage(2, 13, 2, 23, 3), C.ecrirePlage(1, 3, 1, 5, 1)],
    };
  });
  ok("un conseil se lit en deux lignes, titre et précision, avec son chevron", conseilDit.deuxLignes);
  ok("chaque conseil de l'accueil mène au détail qu'il décrit",
    conseilDit.lignes > 0 && conseilDit.menent, `${conseilDit.lignes} conseils`);
  ok("une journée entière se dit « toute la journée », avec l'élision",
    conseilDit.plages.join(" | ") === "toute la journée d'après-demain | d'après-demain 13 h à minuit | demain de 03 h à 06 h",
    conseilDit.plages.join(" | "));

  /* Les deux décisions du lot 2, vérifiées pour elles-mêmes : dans la fenêtre des
     contrôles, sans avis, la marge est assez large pour qu'un ciel d'origine ou
     des chiffres sur deux colonnes tiennent encore, et la garde du premier écran
     ne les verrait pas. */
  /* La tuile de l'eau arrive après la prévision : elle est attendue, pour que la
     garde compte les neuf tuiles. */
  await pg.waitForFunction(() => document.querySelectorAll("#ecran .bd-mesures .bd-m").length === 9, null, { timeout: 8000 }).catch(() => {});
  const lot2 = await pg.evaluate(() => {
    const ci = document.querySelector("#ecran .plein-accueil .ci");
    const cellules = [...document.querySelectorAll("#ecran .bd-mesures .bd-m")];
    const hauts = new Set(cellules.map(c => Math.round(c.getBoundingClientRect().top)));
    const gauches = new Set(cellules.map(c => Math.round(c.getBoundingClientRect().left)));
    return {
      rapport: ci ? ci.getBoundingClientRect().height / ci.getBoundingClientRect().width : null,
      cellules: cellules.length, rangees: hauts.size, colonnes: gauches.size,
    };
  });
  ok("le ciel de l'accueil est plus bas que celui des autres écrans",
    lot2.rapport !== null && lot2.rapport <= 250 / 390 + 0.01,
    lot2.rapport === null ? "ciel introuvable" : `rapport ${lot2.rapport.toFixed(3)}`);
  /* Jalon 11 : les quatre chiffres sur une ligne deviennent huit tuiles sur deux
     colonnes, une par paramètre suivi. */
  /* Depuis le 30 septembre 2026, une neuvième tuile, l'eau, prend toute la
     largeur de la dernière rangée. */
  ok("les neuf tuiles des paramètres se rangent sur deux colonnes, l'eau sur toute la largeur",
    lot2.cellules === 9 && lot2.rangees === 5 && lot2.colonnes === 2,
    `${lot2.cellules} tuiles, ${lot2.rangees} rangées, ${lot2.colonnes} colonnes`);

  ok("la phrase dit la pluie avec son moment, et les rafales fortes",
    bandeDit.plages === "[[2,4]]"
    && bandeDit.phrase === "Pluie cet après-midi de 15 h à 18 h, 0,6 mm, rafales jusqu'à 55 km/h cet après-midi."
    && bandeDit.sechePhrase === null,
    `${bandeDit.phrase} | ${bandeDit.sechePhrase}`);
};
