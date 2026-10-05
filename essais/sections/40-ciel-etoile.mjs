/* Le ciel étoilé. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */
import { FIGE, FAIN, FEUX_JOUR } from "../faux-services.mjs";

export const titre = "Le ciel étoilé";
export const avecPage = true;

export default async T => {
  const { ctx, etat, ok, txt, onglet, ctxReponse, METEO_NUE, ouvrirCarte } = T;
  const [ctxCiel, pgCiel] = await ouvrirCarte(FAIN, 0);
  const cielDit = await pgCiel.evaluate(async () => {
    const C = await import("/src/ciel.js");
    const r = await fetch("/donnees/ciel.json");
    const d = await r.json();
    await C.charger(async () => ({ ok: true, json: async () => d }));
    const date = new Date("2026-09-20T22:00:00+02:00");
    const sud = C.etoilesVues(date, 48.86, 2.35, 180, 45, 60);
    const nord = C.nomsVus(date, 48.86, 2.35, 0, 45, 60);
    const fig = C.figuresVues(date, 48.86, 2.35, 180, 45, 60);
    const brillantes = sud.filter(x => x.nom).sort((a, b) => a.mag - b.mag)
      .slice(0, 6).map(x => x.nom);
    return {
      total: d.etoiles.length, figures: Object.keys(d.figures).length,
      noms: Object.keys(d.noms).length,
      vues: sud.length, brillantes, nord: nord.map(x => x.nom),
      sousSol: sud.filter(x => x.hauteur < 0).length,
      segments: fig.length,
      soleil: d.etoiles.some(e => e[4] === "Sol"),
      magMax: Math.max(...d.etoiles.map(e => e[2])),
      rayons: [C.rayon(-1), C.rayon(2), C.rayon(6)],
      derriere: C.projeter(0, 45, 180, 45, 60),
      marquees: d.etoiles.filter(e => e[7] === 1).length,
      latin: [d.noms.UMa?.[3], d.noms.CVn?.[3]],
      modes: Object.fromEntries(["visibles", "toutes", "constellations"].map(m =>
        [m, C.etoilesVues(date, 48.86, 2.35, 180, 45, 60, m)])),
    };
  });

  ok("le fichier porte les étoiles, les figures et leurs noms",
    cielDit.total === 5070 && cielDit.figures === 88 && cielDit.noms === 88,
    `${cielDit.total} étoiles, ${cielDit.figures} figures, ${cielDit.noms} noms`);

  /* Le catalogue porte le Soleil, à l'origine des coordonnées : le laisser
     mettrait une étoile de magnitude moins vingt-sept au point zéro de la carte,
     sa place se calculant ailleurs, à l'heure dite. */
  ok("le Soleil ne figure pas parmi les étoiles", !cielDit.soleil);

  ok("le catalogue s'arrête à la magnitude six",
    cielDit.magMax <= 6, `magnitude la plus faible ${cielDit.magMax}`);

  /* La voûte s'arrête au sol : une étoile sous l'horizon ne se peint pas. Le
     compte seul ne suffit pas à le dire : sans filtre, seules les étoiles juste
     sous le sol et dans le champ s'ajoutent, et le total reste plausible. La
     garde vérifie donc qu'aucune étoile retenue n'est sous l'horizon. */
  ok("les étoiles sous l'horizon sont écartées",
    cielDit.sousSol === 0 && cielDit.vues > 500 && cielDit.vues < 3000,
    `${cielDit.sousSol} étoiles sous l'horizon, ${cielDit.vues} dans le champ`);

  ok("le ciel de septembre est celui qu'on voit",
    ["Vega", "Altair", "Deneb"].every(n => cielDit.brillantes.includes(n)),
    cielDit.brillantes.join(", "));

  ok("la Grande Ourse et Cassiopée se tiennent au nord",
    ["Grande Ourse", "Cassiopée"].every(n => cielDit.nord.includes(n)),
    cielDit.nord.slice(0, 6).join(", "));

  ok("les figures se tracent par segments coupés à l'horizon",
    cielDit.segments > 20 && cielDit.segments < 149,
    `${cielDit.segments} segments`);

  /* Une étoile brillante fait un disque net, une étoile de magnitude six un
     point à peine visible : l'échelle est inversée. */
  ok("le rayon d'une étoile suit sa magnitude, à l'envers",
    cielDit.rayons[0] > cielDit.rayons[1] && cielDit.rayons[1] > cielDit.rayons[2],
    cielDit.rayons.map(r => r.toFixed(2)).join(" > "));

  ok("un point derrière l'observateur ne se projette pas",
    cielDit.derriere === null, JSON.stringify(cielDit.derriere));

  /* Le choix de ce qui s'affiche, mesuré le 21 septembre 2026 : 523 étoiles
     jusqu'à la magnitude 4 pour les plus visibles, 5070 pour toutes, 749 qui
     portent les figures pour les constellations. */
  ok("le fichier marque les étoiles des figures",
    cielDit.marquees === 749, `${cielDit.marquees} marquées`);

  ok("les noms latins entrent dans le fichier, sous leur forme officielle",
    cielDit.latin.join(" | ") === "Ursa Major | Canes Venatici", cielDit.latin.join(" | "));

  ok("les plus visibles s'arrêtent à la magnitude 4",
    cielDit.modes.visibles.length > 50
    && cielDit.modes.visibles.every(e => e.mag <= 4)
    && cielDit.modes.visibles.length < cielDit.modes.toutes.length / 3,
    `${cielDit.modes.visibles.length} contre ${cielDit.modes.toutes.length}`);

  ok("le mode des constellations ne retient que les étoiles des figures",
    cielDit.modes.constellations.length > 50
    && cielDit.modes.constellations.every(e => e.figure === 1),
    `${cielDit.modes.constellations.length} étoiles`);

  /* Sous le bandeau, les informations de la nuit, vérifiées sur des dates dont
     on connaît le ciel. */
  const infosDit = await pgCiel.evaluate(async () => {
    const V = await import("/src/vues.js");
    const paris = { lat: 48.86, lon: 2.35 };
    const h = d => d ? d.getHours() + d.getMinutes() / 60 : null;
    const sept = V.nuitNoire(new Date("2026-09-20T12:00:00+02:00"), paris);
    const juin = V.nuitNoire(new Date("2026-06-21T12:00:00+02:00"), paris);
    const nuit = { debut: new Date("2026-09-20T22:00"), fin: new Date("2026-09-21T05:00") };
    const heures = ["2026-09-20T22:00", "2026-09-20T23:00", "2026-09-21T00:00",
      "2026-09-21T01:00", "2026-09-21T02:00", "2026-09-21T03:00", "2026-09-21T04:00"];
    const ciel = c => V.cielDeLaNuit(nuit, { hourly: { time: heures, cloud_cover: c } });
    const vus = V.aVoirCeSoir(new Date("2026-08-18T09:00:00+02:00"), { lat: 47.5, lon: 4.3 });
    /* Sans essaim trouvé, la garde doit échouer et non la suite tomber. */
    const essaim = d => {
      const e = V.prochainEssaim(new Date(d));
      return e ? `${e.nom} ${e.date.getFullYear()}-${e.date.getMonth() + 1}-${e.date.getDate()}` : "aucun";
    };
    return {
      septDebut: h(sept?.debut), septFin: h(sept?.fin), juin,
      eclaircie: ciel([90, 90, 90, 10, 10, 10, 90]),
      couvert: ciel([90, 90, 90, 90, 90, 90, 90]),
      vus: vus.map(x => x.nom), vusHauts: vus.every(x => x.hauteur > 20),
      aout: essaim("2026-08-18T12:00:00"), decembre: essaim("2026-12-20T12:00:00"),
    };
  });

  /* Le crépuscule astronomique, quand le Soleil passe à dix-huit degrés sous
     l'horizon : vers 21 h 20 à Paris le 20 septembre, et la fin vers 5 h 40. */
  ok("la nuit noire commence et finit aux crépuscules astronomiques",
    infosDit.septDebut > 20.8 && infosDit.septDebut < 21.9
    && infosDit.septFin > 5.0 && infosDit.septFin < 6.2,
    `de ${infosDit.septDebut?.toFixed(2)} à ${infosDit.septFin?.toFixed(2)}`);

  ok("près du solstice d'été, à Paris, la nuit noire ne vient pas",
    infosDit.juin === null, JSON.stringify(infosDit.juin));

  /* Une plage dégagée se dit de sa première heure à la fin de sa dernière. */
  ok("les nuages disent la plus longue éclaircie de la nuit noire",
    infosDit.eclaircie?.mot === "Dégagé" && infosDit.eclaircie?.sous.replace(/[\u00A0\u202F]/g, " ") === "de 01 h à 04 h"
    && infosDit.couvert?.mot === "Couvert",
    `${JSON.stringify(infosDit.eclaircie)} ${JSON.stringify(infosDit.couvert)}`);

  ok("à voir ce soir, les constellations les plus hautes d'une nuit d'août",
    infosDit.vusHauts && ["Lyre", "Cygne"].every(n => infosDit.vus.slice(0, 3).includes(n)),
    infosDit.vus.join(", "));

  /* La fiche d'une constellation, vérifiée le 20 septembre 2026 à 22 h depuis
     Paris, sur des constellations dont on connaît le ciel. */
  const ficheDit = await pgCiel.evaluate(() => (async () => {
    const C = await import("/src/ciel.js");
    const date = new Date("2026-09-20T22:00:00+02:00");
    const nuit = { debut: new Date("2026-09-20T21:20:00+02:00"), fin: new Date("2026-09-21T05:40:00+02:00") };
    const f = s => C.fiche(s, date, 48.86, 2.35, nuit);
    const ori = f("Ori"), lyr = f("Lyr"), eri = f("Eri");
    const figures = [{ sigle: "A", points: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }];
    const noms = [{ sigle: "B", x: 0.5, y: 0.5 }];
    return {
      ori: [ori.hauteur < 0, ori.moisCulmine, ori.brillante.nom, ori.visible?.debut ? ori.visible.debut.getHours() : null],
      lyr: [lyr.hauteur > 45, lyr.moisCulmine, lyr.brillante.nom],
      eri: [eri.brillante.nom, eri.brillante.jamais],
      latin: f("UMa").latin,
      designe: [C.designee(0.5, 0.02, figures, noms), C.designee(0.5, 0.46, figures, noms),
        C.designee(3, 3, figures, noms)],
      lettre: C.lettreDe("58Alp Ori"),
    };
  })());

  ok("la fiche dit la hauteur, le mois du passage à minuit et l'étoile la plus brillante",
    JSON.stringify(ficheDit.ori.slice(0, 3)) === '[true,11,"Rigel"]'
    && ficheDit.ori[3] >= 0 && ficheDit.ori[3] <= 3
    && JSON.stringify(ficheDit.lyr) === '[true,6,"Vega"]'
    && ficheDit.latin === "Ursa Major",
    `${JSON.stringify(ficheDit.ori)} ${JSON.stringify(ficheDit.lyr)} ${ficheDit.latin}`);

  ok("la fiche dit qu'une étoile ne se lève jamais ici",
    JSON.stringify(ficheDit.eri) === '["Achernar",true]', JSON.stringify(ficheDit.eri));

  /* On touche une figure : le trait le plus proche d'abord, le nom à défaut, et
     rien quand le toucher tombe loin de tout. */
  ok("le toucher désigne le trait le plus proche, puis le nom",
    JSON.stringify(ficheDit.designe) === '["A","B",null]' && ficheDit.lettre === "α",
    `${JSON.stringify(ficheDit.designe)} ${ficheDit.lettre}`);

  /* Sous l'horizon, les étoiles se voient à travers l'eau. Le module les rend
     sur demande, marquées, et garde sans demande le contrat d'origine. */
  const eauDit = await pgCiel.evaluate(async () => {
    const C = await import("/src/ciel.js");
    const date = new Date("2026-09-20T22:00:00+02:00");
    const sans = C.etoilesVues(date, 48.86, 2.35, 180, 40, 60, "visibles", [0.6, 1.1], false);
    const avec = C.etoilesVues(date, 48.86, 2.35, 180, 40, 60, "visibles", [0.6, 1.1], true);
    const sous = avec.filter(x => x.sous);
    const fig = C.figuresVues(date, 48.86, 2.35, 180, 40, 60, true);
    return {
      sans: sans.length, avec: avec.length, sous: sous.length,
      sousNegatifs: sous.every(x => x.hauteur < 0),
      dessusPositifs: avec.filter(x => !x.sous).every(x => x.hauteur >= 0),
      figSous: fig.filter(x => x.sous).length,
      figDefaut: C.figuresVues(date, 48.86, 2.35, 180, 40, 60).filter(x => x.sous).length,
    };
  });
  ok("sous l'horizon, les étoiles se rendent sur demande, marquées comme telles",
    eauDit.sous > 5 && eauDit.sousNegatifs && eauDit.dessusPositifs
    && eauDit.avec === eauDit.sans + eauDit.sous,
    `${eauDit.sous} sous l'horizon, ${eauDit.sans} sans demande, ${eauDit.avec} avec`);
  ok("les figures se prolongent sous l'horizon, et pas sans demande",
    eauDit.figSous > 5 && eauDit.figDefaut === 0,
    `${eauDit.figSous} tronçons sous l'eau, ${eauDit.figDefaut} sans demande`);

  /* La Lune et les planètes. Deux recoupements indépendants : le Soleil calculé
     par sa série et le Soleil vu depuis la Terre décrite par ses éléments
     d'orbite ne doivent différer que de la précession générale depuis l'an 2000,
     un degré et 397 millièmes par siècle ; et l'opposition de Saturne doit tomber
     début octobre 2026, treize jours après celle de 2025, selon la cadence des
     oppositions de cette planète. */
  const astresDit = await pgCiel.evaluate(async () => {
    const A = await import("/src/astres.js");
    const C = await import("/src/ciel.js");
    const jj = A.jourJulien(new Date("2026-09-22T00:00:00Z"));
    const T = (jj - 2451545) / 36525;
    const t = A.heliocentrique("terre", jj);
    const parTerre = (Math.atan2(t.y, t.x) * 180 / Math.PI + 180 + 360) % 360;
    const ecart = Math.abs(((A.soleil(jj).lambda - parTerre + 540) % 360) - 180);
    let opposition = null;
    for (let k = 0; k < 40; k++) {
      const d = new Date(Date.UTC(2026, 8, 1) + k * 86400000);
      const j = A.jourJulien(d);
      const e = Math.abs(180 - Math.abs(((A.planete("saturne", j).lambda - A.soleil(j).lambda + 540) % 360) - 180));
      if (!opposition || e < opposition.e) opposition = { d: d.toISOString().slice(0, 10), e };
    }
    const vus = C.astresVus(new Date("2026-09-22T21:00:00+02:00"), 48.86, 2.35, 180, 40, 90, [1.2, 1.2], true);
    return {
      ecart, precession: 1.3969 * T, opposition: opposition.d, liste: C.ASTRES,
      saturne: A.planete("saturne", jj).ascension / 15,
      astres: vus.map(x => x.cle), nommes: vus.every(x => x.nom && x.nom.length > 2),
    };
  });
  ok("les planètes tiennent le repère du catalogue, à la précession près",
    Math.abs(astresDit.ecart - astresDit.precession) < 0.05,
    `écart ${(astresDit.ecart * 60).toFixed(1)}', précession ${(astresDit.precession * 60).toFixed(1)}'`);
  ok("l'opposition de Saturne tombe dans les premiers jours d'octobre 2026",
    astresDit.opposition >= "2026-10-01" && astresDit.opposition <= "2026-10-08"
    && astresDit.saturne > 0 && astresDit.saturne < 1.5,
    `${astresDit.opposition}, ascension ${astresDit.saturne.toFixed(2)} h`);
  /* La liste tient la Lune et les cinq planètes ; ce qu'un champ donné en montre
     dépend de l'heure et de la direction, et ne se garde pas. */
  ok("la Lune et les cinq planètes visibles à l'œil nu se placent sur la carte",
    astresDit.liste.length === 6 && astresDit.liste.includes("lune")
    && ["mercure", "venus", "mars", "jupiter", "saturne"].every(p => astresDit.liste.includes(p))
    && astresDit.astres.length > 0 && astresDit.nommes,
    `${astresDit.liste.join(", ")} ; vus : ${astresDit.astres.join(", ")}`);

  ok("le prochain essaim d'étoiles filantes, y compris d'une année sur l'autre",
    infosDit.aout === "Draconides 2026-10-8" && infosDit.decembre === "Quadrantides 2027-1-3",
    `${infosDit.aout} ; ${infosDit.decembre}`);
  await ctxCiel.close();

  /* L'écran des étoiles. Le fichier du ciel pèse 81 kilooctets comprimés : il ne
     se charge qu'à l'ouverture de cet écran, non au démarrage ni sur l'écran du
     Soleil, sans quoi chacun le paierait. L'heure figée des contrôles tombe un
     matin d'août, en plein jour : l'écran doit le dire. */
  const [ctxEt, pgEt] = await ctxReponse(METEO_NUE);
  let demandesCiel = 0;
  pgEt.on("request", r => { if (r.url().includes("donnees/ciel.json")) demandesCiel++; });
  await pgEt.locator('[data-onglet="ciel"]').click();
  await pgEt.waitForTimeout(600);
  const avantEtoiles = demandesCiel;
  await pgEt.locator('[data-ciel="etoiles"]').click();
  /* Une pause fixe : la toile lue ensuite change sans toucher au document, et
     l'attente du repos rendait la main avant qu'elle soit peinte. */
  await pgEt.waitForTimeout(1800);

  ok("l'écran des étoiles se choisit dans le ciel",
    await pgEt.evaluate(() => !!document.getElementById("ciToile")));

  ok("le fichier du ciel ne se charge qu'à l'ouverture de l'écran",
    avantEtoiles === 0 && demandesCiel === 1,
    `${avantEtoiles} avant, ${demandesCiel} après`);

  ok("la toile porte des étoiles",
    await pgEt.evaluate(() => {
      const cv = document.getElementById("ciToile");
      const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
      let clairs = 0;
      for (let i = 0; i < d.length; i += 4) if (Math.max(d[i], d[i + 1], d[i + 2]) > 150) clairs++;
      return clairs > 300 ? "" : `${clairs} points clairs`;
    }) === "");

  /* Les deux sources du ciel se nomment dans la carte des sources des
     réglages depuis le jalon 20, et plus sur l'écran. */
  ok("la mention nomme les deux sources",
    await pgEt.evaluate(async () => {
      const F = await import("/src/vues/feuilles.js");
      const v = F.vueReglages({}, () => {}, () => {});
      const ecran = document.getElementById("ecran").textContent;
      return /HYG/.test(v.corps) && /d3-celestial/.test(v.corps) && !/HYG/.test(ecran);
    }));

  ok("sous le bandeau, la nuit noire, les nuages et la Lune",
    await pgEt.evaluate(() => {
      /* Depuis le jalon 20, lot 3, au format des durées du Soleil. */
      const t = [...document.querySelectorAll(".ci-nuit .tm > div > i")].map(b => b.textContent);
      return ["Nuit noire", "Nuages", "Lune"].every(n => t.includes(n)) ? "" : t.join(", ");
    }) === "");

  ok("à voir ce soir se remplit une fois le ciel chargé",
    await pgEt.evaluate(() =>
      document.querySelectorAll("#ciAVoir .rangee").length >= 3));

  ok("les étoiles filantes annoncent le prochain essaim",
    await pgEt.evaluate(() => {
      const t = document.querySelector(".ci-filantes")?.textContent || "";
      return /Draconides/.test(t) && /8 octobre/.test(t) ? "" : t.slice(0, 60);
    }) === "");

  /* Hors plein écran, l'écran suit la mise en page du Soleil et de la Lune : le
     ciel en bandeau, et sa ligne de titre donne le prochain événement du ciel.
     L'heure figée des contrôles tombe un matin d'août : c'est la nuit noire du
     soir qui s'annonce. */
  ok("le bandeau annonce le prochain événement du ciel",
    await pgEt.evaluate(() => {
      const t = document.querySelector(".plein-titre");
      const i = t?.querySelector("i")?.textContent || "";
      const b = t?.querySelector("b")?.textContent || "";
      return /^Nuit noire$/.test(i) && /^\d{2}\s?h(\s?\d{2})?$/.test(b) ? "" : `« ${i} » « ${b} »`;
    }) === "");

  ok("la visée se dit par une direction, et au zénith à la verticale",
    await pgEt.evaluate(async () => {
      const V = await import("/src/vues.js");
      return [V.viseeDe(45, 40), V.viseeDe(200, 84), V.viseeDe(180, 12)].join(" | ");
    }) === "Nord-est, 40° | Au zénith | Sud, 12°");

  /* Un toucher sur le bandeau ouvre le plein écran, qui couvre toute
     l'application, barre de navigation comprise : sur iPhone, l'interface de
     plein écran du navigateur ne vaut que pour les vidéos. */
  await pgEt.locator("#ciBandeau").click();
  await pgEt.waitForTimeout(700);
  ok("un toucher sur le bandeau ouvre le ciel en plein écran",
    await pgEt.evaluate(() => {
      const fe = document.getElementById("ciPleinEcran");
      if (!fe) return "aucun plein écran";
      const r = fe.getBoundingClientRect();
      return r.width >= window.innerWidth - 1 && r.height >= window.innerHeight - 1
        ? "" : `${r.width} sur ${r.height}`;
    }) === "");

  /* L'eau se mesure au pixel sous l'horizon : un bleu nuit, depuis la
     version 176, où le bleu domine le rouge même sous la lueur du jour, et les étoiles d'en
     dessous y font des taches plus claires que l'eau de leur rangée. Les
     traits des figures, plus pâles, ne passent pas ce seuil. */
  const eauPleinDit = await pgEt.evaluate(() => {
      const cv = document.getElementById("ciToilePE");
      if (!cv) return "pas de plein écran";
      const ctx = cv.getContext("2d");
      const y0 = Math.round(cv.height * 0.72), y1 = Math.round(cv.height * 0.88);
      const d = ctx.getImageData(0, y0, cv.width, y1 - y0).data;
      let vert = 0, rouge = 0, n = 0, clairs = 0;
      for (let y = 0; y < y1 - y0; y++) {
        let base = Infinity;
        for (let x = 0; x < cv.width; x++) {
          const i = (y * cv.width + x) * 4;
          base = Math.min(base, d[i] + d[i + 1] + d[i + 2]);
        }
        for (let x = 0; x < cv.width; x++) {
          const i = (y * cv.width + x) * 4;
          vert += d[i + 2]; rouge += d[i]; n++;
          if (d[i] + d[i + 1] + d[i + 2] > base + 40) clairs++;
        }
      }
      const vm = vert / n, rm = rouge / n;
      return vm > 30 && vm > rm * 1.3 && clairs > 20 ? "" : `bleu moyen ${vm.toFixed(0)}, rouge ${rm.toFixed(0)}, ${clairs} points clairs`;
    });
  ok("sous l'horizon, une étendue d'eau laisse deviner les étoiles", eauPleinDit === "", eauPleinDit);

  ok("le plein écran dit qu'il fait jour quand le Soleil efface les étoiles",
    await pgEt.evaluate(() => /Il fait jour/.test(document.getElementById("ciJour")?.textContent || "")));

  /* Le doigt tourne la vue, en plein écran seulement : un glissement vers la
     gauche la porte vers l'ouest, et l'étiquette de visée le dit. */
  /* Sans plein écran ouvert, la suite ne doit pas tomber : les gardes qui
     suivent échouent chacune à leur tour, et c'est la garde du toucher qui dit
     la cause. */
  const pleinOuvert = await pgEt.locator("#ciPleinEcran").count() > 0;
  let viseeDit = "pas de plein écran";
  if (pleinOuvert) {
    const boitePE = await pgEt.locator("#ciToilePE").boundingBox();
    await pgEt.mouse.move(boitePE.x + boitePE.width / 2, boitePE.y + boitePE.height / 2);
    await pgEt.mouse.down();
    await pgEt.mouse.move(boitePE.x + boitePE.width / 2 - 120,
      boitePE.y + boitePE.height / 2, { steps: 6 });
    await pgEt.mouse.up();
    await pgEt.waitForTimeout(300);
    viseeDit = await pgEt.evaluate(() => document.getElementById("ciVisee").textContent);
  }
  ok("le doigt tourne la vue", /^Sud-ouest, 40°$/.test(viseeDit), viseeDit);

  /* Le choix de l'affichage se fait en plein écran : les plus visibles par
     défaut, et le choix se garde d'une visite à l'autre. */
  ok("le choix de l'affichage montre les plus visibles par défaut",
    pleinOuvert && await pgEt.evaluate(() =>
      document.querySelector('#ciChoix [data-affichage="visibles"]')
        ?.getAttribute("aria-pressed") === "true"));

  if (pleinOuvert) {
    await pgEt.locator('#ciChoix [data-affichage="toutes"]').click();
    await pgEt.waitForTimeout(300);
  }
  ok("le choix de l'affichage se garde d'une visite à l'autre",
    await pgEt.evaluate(() => {
      const r = JSON.parse(localStorage.getItem("mameteo.reglages.v1") || "{}");
      return r.affichageCiel === "toutes"
        && document.querySelector('#ciChoix [data-affichage="toutes"]')
          ?.getAttribute("aria-pressed") === "true";
    }));

  if (pleinOuvert) {
    await pgEt.locator("#ciSources").click();
    await pgEt.waitForTimeout(200);
  }
  ok("la fenêtre des sources nomme les deux sources et leurs licences",
    await pgEt.evaluate(() => {
      const f = document.getElementById("ciFenetre");
      if (!f || f.hidden) return "fenêtre fermée";
      const t = f.textContent;
      return ["HYG", "Creative Commons", "d3-celestial", "BSD"].every(m => t.includes(m))
        ? "" : t.slice(0, 80);
    }) === "");

  if (pleinOuvert) {
    await pgEt.locator("#ciFenetreFermer").click();
    await pgEt.locator("#ciFermer").click();
    await pgEt.waitForTimeout(200);
  }
  ok("fermer rend l'écran des étoiles",
    await pgEt.evaluate(() => !document.getElementById("ciPleinEcran")
      && !!document.getElementById("ciBandeau")));

  /* Le toucher bref désigne, le glissement tourne. Le plein écran rouvert repart
     de la vue fixe du bandeau, ce qui permet de viser le nom d'une constellation
     à sa place calculée. */
  let ficheNom = "", ficheFermee = false, glisseDesigne = true;
  await pgEt.locator("#ciBandeau").click();
  await pgEt.waitForTimeout(700);
  if (await pgEt.locator("#ciPleinEcran").count() > 0) {
    const cible = await pgEt.evaluate(async () => {
      const C = await import("/src/ciel.js");
      const r = document.getElementById("ciToilePE").getBoundingClientRect();
      const unite = Math.min(r.width, r.height) / 2;
      const bords = [r.width / 2 / unite, r.height / 2 / unite];
      const n = C.nomsVus(new Date(), 47.5, 4.3, 180, 40, 60, bords)
        .find(x => Math.abs(x.x) < 0.7 && Math.abs(x.y) < 0.7);
      return n ? { x: r.left + r.width / 2 + n.x * unite, y: r.top + r.height / 2 + n.y * unite } : null;
    });
    if (cible) {
      await pgEt.mouse.click(cible.x, cible.y);
      await pgEt.waitForTimeout(400);
      ficheNom = await pgEt.evaluate(() => {
        const f = document.getElementById("ciFiche");
        return f && !f.hidden ? f.querySelector(".ci-fiche-nom")?.textContent || "" : "";
      });
      if (ficheNom) await pgEt.locator("#ciFicheFermer").click();
      await pgEt.waitForTimeout(200);
      ficheFermee = await pgEt.evaluate(() => document.getElementById("ciFiche")?.hidden === true);
      /* Un glissement court, parti du nom : le ciel suit le doigt, si bien qu'au
         lâcher le nom est encore sous lui. Un glissement long finissait sur un
         ciel vide, et même compté pour un toucher il ne désignait rien : la garde
         ne voyait pas la faute. */
      await pgEt.mouse.move(cible.x, cible.y);
      await pgEt.mouse.down();
      await pgEt.mouse.move(cible.x - 20, cible.y, { steps: 4 });
      await pgEt.mouse.up();
      await pgEt.waitForTimeout(300);
      glisseDesigne = await pgEt.evaluate(() => document.getElementById("ciFiche")?.hidden === false);
    }
    await pgEt.locator("#ciFermer").click();
  }
  ok("un toucher bref désigne une constellation et ouvre sa fiche",
    ficheNom.length > 0, ficheNom || "aucune fiche");
  ok("la fiche se ferme", ficheFermee);

  /* Le curseur parcourt la nuit. Poussé au bout, il change le ciel ; le bouton
     « Maintenant » le ramène à l'instant présent. */
  let curseurDit = null;
  /* Le plein écran a été refermé par la garde précédente : il se rouvre pour le
     curseur, qui n'existe que là. */
  if (await pgEt.locator("#ciPleinEcran").count() === 0) {
    await pgEt.locator("#ciBandeau").click();
    await pgEt.waitForTimeout(700);
  }
  if (await pgEt.locator("#ciPleinEcran").count() > 0) {
    curseurDit = await pgEt.evaluate(async () => {
      const cv = document.getElementById("ciToilePE");
      const c = cv.getContext("2d");
      const somme = () => {
        const d = c.getImageData(0, 0, cv.width, Math.round(cv.height * 0.6)).data;
        let s = 0;
        for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2];
        return s;
      };
      const curseur = document.getElementById("ciCurseur");
      const heure = document.getElementById("ciHeure");
      const dodo = m => new Promise(r => setTimeout(r, m));
      const avant = { somme: somme(), heure: heure.textContent, max: Number(curseur.max) };
      curseur.value = curseur.max;
      curseur.dispatchEvent(new Event("input", { bubbles: true }));
      await dodo(500);
      const apres = { somme: somme(), heure: heure.textContent };
      document.getElementById("ciMaintenant").click();
      await dodo(500);
      return { avant, apres, retour: heure.textContent, minutes: avant.max * 5 };
    });
  }
  ok("le curseur parcourt la nuit, du crépuscule à l'aube",
    curseurDit && curseurDit.minutes > 360 && curseurDit.minutes < 900,
    `${curseurDit ? curseurDit.minutes : 0} minutes`);
  ok("le curseur change le ciel et l'heure qu'il annonce",
    curseurDit && curseurDit.apres.heure !== curseurDit.avant.heure
    && Math.abs(curseurDit.apres.somme - curseurDit.avant.somme) > curseurDit.avant.somme * 0.002,
    curseurDit ? `${curseurDit.avant.heure} puis ${curseurDit.apres.heure}` : "");
  ok("le bouton Maintenant ramène à l'instant présent",
    curseurDit && curseurDit.retour === curseurDit.avant.heure,
    curseurDit ? `${curseurDit.retour} contre ${curseurDit.avant.heure}` : "");
  if (await pgEt.locator("#ciPleinEcran").count() > 0) await pgEt.locator("#ciFermer").click();
  ok("un glissement tourne la vue sans rien désigner", ficheNom.length > 0 && !glisseDesigne);
  await ctxEt.close();

  /* ---------- Les feux sur la carte ----------

     Les foyers relevés par les satellites en orbite polaire. Mesuré le
     20 septembre 2026 sur la tuile de la France : 455 points pour le jour même,
     1334 avec la veille. Les satellites ne passant que deux fois par jour, un
     jour seul montre la moitié de ce qui brûle. */
  etat.appelsFeux.length = 0;
  const [ctxFx, pgFx] = await ouvrirCarte({ ...FAIN, feuxcarte: true }, 0);
  await pgFx.waitForTimeout(800);
  const joursFeux = () => [...new Set(etat.appelsFeux
    .map(u => decodeURIComponent((/[?&]time=([^&]+)/.exec(u) || [])[1] || "")))].sort();

  ok("la couche demande deux jours, le jour même et la veille",
    (() => {
      const j = joursFeux();
      if (j.length !== 2) return false;
      const veille = new Date(FIGE - 86400000).toISOString().slice(0, 10);
      return j[0] === veille && j[1] === FEUX_JOUR;
    })(), joursFeux().join(" "));

  /* La dimension de temps est obligatoire : sans elle le service rend l'année
     2020 et une image vide, ce qui fait croire qu'il ne sert rien. */
  ok("chaque tuile porte sa date",
    etat.appelsFeux.length > 0
    && etat.appelsFeux.every(u => /[?&]time=\d{4}-\d\d-\d\d/.test(u)),
    etat.appelsFeux.find(u => !/[?&]time=/.test(u)) || "toutes datées");

  ok("les tuiles se demandent en projection de Mercator",
    etat.appelsFeux.every(u => /crs=EPSG:3857/.test(u) && /layers=viirs\.hs/.test(u)),
    etat.appelsFeux[0] || "aucune tuile");

  ok("les foyers se posent sur la carte",
    await pgFx.evaluate(async () => {
      const dodo = m => new Promise(r => setTimeout(r, m));
      await dodo(600);
      const cv = document.getElementById("caToile");
      const ctx = cv.getContext("2d");
      let rouges = 0, vus = 0;
      for (let y = 60; y < cv.height - 60; y += 40) {
        for (let x = 60; x < cv.width - 60; x += 40) {
          const d = ctx.getImageData(x, y, 1, 1).data;
          vus++;
          if (d[0] > 190 && d[1] < 110 && d[2] < 90) rouges++;
        }
      }
      return vus > 20 && rouges / vus > 0.3 ? "" : `${rouges} foyers sur ${vus} points`;
    }) === "");

  /* Le nom ne promet pas d'incendie : le satellite voit un point chaud, que
     produisent aussi un brûlage agricole ou une torchère. */
  ok("la légende dit des foyers vus par satellite, non des incendies",
    await pgFx.evaluate(() => {
      const l = document.getElementById("caLegFeux");
      if (l.hidden) return "légende absente";
      const t = l.textContent;
      if (!/[Ff]oyers/.test(t) || !/satellite/.test(t)) return `légende « ${t} »`;
      if (/incendie/i.test(t)) return "la légende promet un incendie";
      return "";
    }) === "");

  /* La mention est une attribution : elle doit se lire sur une couche colorée
     comme sur la carte nue. Le gris clair d'origine s'y perdait. La mesure porte
     sur le rapport de clarté entre le texte et le fond de page, celui que le halo
     de texte pose autour des lettres. */
  ok("la mention se lit assez pour être une attribution",
    await pgFx.evaluate(() => {
      const clarte = c => {
        const [r, g, b] = c.match(/\d+/g).slice(0, 3).map(Number).map(v => {
          const u = v / 255;
          return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const el = document.getElementById("caCredit");
      const texte = clarte(getComputedStyle(el).color);
      const fond = clarte(getComputedStyle(document.body).backgroundColor);
      const haut = Math.max(texte, fond), bas = Math.min(texte, fond);
      const rapport = (haut + 0.05) / (bas + 0.05);
      return rapport >= 4 ? "" : `rapport de clarté ${rapport.toFixed(2)}`;
    }) === "");

  ok("la mention nomme Copernicus tant que les feux sont allumés",
    await pgFx.evaluate(() => {
      const c = document.getElementById("caCredit");
      return /Feux/.test(c.textContent)
        && c.querySelector('a[href*="effis"]') !== null;
    }));
  await ctxFx.close();

  etat.appelsFeux.length = 0;
  const [ctxFxOff, pgFxOff] = await ouvrirCarte(FAIN, 0);
  await pgFxOff.waitForTimeout(500);
  ok("une carte qui s'ouvre les feux éteints ne demande rien au service",
    etat.appelsFeux.length === 0, `${etat.appelsFeux.length} appels`);
  await ctxFxOff.close();

  /* ---------- Le vent sur la carte ----------

     Le vent est la seule des trois nappes qui ne se dise pas par une couleur : ce
     qui compte est sa direction, et une direction se montre par du mouvement. Les
     particules avancent dans le sens où il souffle et laissent une traînée courte.

     Mesuré le 7 septembre 2026 sur une vue de téléphone : 965 particules, image
     médiane de 16,6 millisecondes contre 16,7 sans la couche, pire image de 23,4
     contre 18,2. L'animation tient donc dans le budget d'une image. */
};
