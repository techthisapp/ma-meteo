/* La pluie sur la carte. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */
import { FIGE, FAIN, amorceGardee } from "../faux-services.mjs";

export const titre = "La pluie sur la carte";
export const avecPage = true;

export default async T => {
  const { ctx, nav, etat, ok, brancherRoutes, ouvrirPage, onglet, ouvrirCarte } = T;
  /* La couche de pluie vient du service RainViewer, sans clé. Les tuiles d'essai
     sont unies, d'une teinte qui porte le rang de l'image : la toile relue au
     pixel dit alors quelle image est montrée.

     La toile se relit parce que le service sert ses tuiles avec l'origine ouverte,
     ce qui a été mesuré : sans cet en-tête la toile serait souillée et le lot 4b,
     qui lit l'intensité au pixel, ne tiendrait pas non plus. */

  // La teinte la plus fréquente de la toile : c'est la couche, qui couvre tout.
  const teintePleine = `() => {
  const cv = document.getElementById("caToile");
  const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
  const c = new Map();
  for (let i = 0; i < d.length; i += 4 * 53) {
    const k = d[i] + "," + d[i + 1] + "," + d[i + 2];
    c.set(k, (c.get(k) || 0) + 1);
  }
  let mieux = "", n = 0;
  for (const [k, v] of c) if (v > n) { mieux = k; n = v; }
  return mieux;
}`;


  const [ctxNappe, pgNappe] = await ouvrirCarte(FAIN, 2);

  /* Ce contrôle vient en tête de section et ne touche à rien : il regarde la carte
     qu'on vient d'ouvrir. Toute commande envoyée d'abord, fût-ce une flèche,
     arrêterait la lecture avant de la voir partir, et la garde ne tiendrait plus
     rien. Une carte s'ouvre sur ce qu'il pleut maintenant, non sur un film. */
  ok("la chronologie ne se met pas en marche seule",
    await pgNappe.evaluate(async () => {
      const p = document.getElementById("caPiste");
      const j = document.getElementById("caJouer");
      const avant = p.getAttribute("aria-valuenow");
      if (j.getAttribute("aria-label") !== "Lire la chronologie") {
        return `le bouton dit « ${j.getAttribute("aria-label")} »`;
      }
      await new Promise(r => setTimeout(r, 1800));
      return p.getAttribute("aria-valuenow") === avant ? ""
        : `le rang a bougé seul de ${avant} à ${p.getAttribute("aria-valuenow")}`;
    }) === "");

  ok("la chronologie porte les images du service",
    await pgNappe.evaluate(() => {
      const r = document.getElementById("caTemps");
      const p = document.getElementById("caPiste");
      if (!r || r.hidden) return "la chronologie ne paraît pas";
      /* Quinze images du radar, puis douze heures prévues depuis la
         version 151. */
      return p.getAttribute("aria-valuemax") === "26" ? ""
        : `valeur maximale ${p.getAttribute("aria-valuemax")}`;
    }) === "");

  /* Treize images observées et deux extrapolées : la carte s'ouvre sur la
     treizième, non sur la quinzième. L'observé est ce qu'on sait. */
  ok("la carte s'ouvre sur la dernière image observée",
    await pgNappe.evaluate(() => {
      const p = document.getElementById("caPiste");
      const h = document.getElementById("caHeure").textContent;
      return `${p.getAttribute("aria-valuenow")}|${h}`;
    }) === "12|09 h",
    await pgNappe.evaluate(() => document.getElementById("caHeure").textContent));

  /* La couche est translucide : un trait recouvert par elle reste distinct du
     reste, et compter les teintes ne dirait donc pas l'ordre du tracé. Ce qui le
     dit est la distance. Un trait dessiné par-dessus la couche garde sa couleur ;
     un trait recouvert par elle s'en approche à neuf dixièmes. Le contrôle relève
     les traits pleins couche éteinte, puis mesure de quel côté ils penchent une
     fois la couche allumée. */
  ok("la pluie se pose sous les traits, non dessus",
    await pgNappe.evaluate(async () => {
      const cv = document.getElementById("caToile");
      const ctx = cv.getContext("2d");
      const lu = () => ctx.getImageData(0, 0, cv.width, cv.height).data;
      const dodo = m => new Promise(r => setTimeout(r, m));
      const pluie = document.getElementById("caPluie");
      const teinte = (d, i) => [d[i], d[i + 1], d[i + 2]];
      const ecart = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
      const dominante = d => {
        const c = new Map();
        for (let i = 0; i < d.length; i += 4 * 53) {
          const k = `${d[i]},${d[i + 1]},${d[i + 2]}`;
          c.set(k, (c.get(k) || 0) + 1);
        }
        let mieux = "", n = 0;
        for (const [k, v] of c) if (v > n) { mieux = k; n = v; }
        return mieux.split(",").map(Number);
      };

      /* La pluie s'éteint par sa propre tuile, « Aucune » ne touchant plus qu'à
         la nappe depuis qu'elle est une superposition. */
      pluie.click(); await dodo(500);          // couche éteinte
      const a = lu();
      const fond = dominante(a);
      /* Les traits pleins seulement : un trait lissé sur son bord est à demi
         transparent, et sa couleur dépend alors de ce qu'il y a dessous quel que
         soit l'ordre du tracé. */
      const traits = [];
      for (let i = 0; i < a.length && traits.length < 300; i += 4) {
        if (ecart(teinte(a, i), fond) > 40) traits.push(i);
      }
      if (traits.length < 40) return `${traits.length} traits pleins sans la couche`;

      pluie.click(); await dodo(900);          // couche allumée
      const b = lu();
      const nappe = dominante(b);
      if (ecart(nappe, fond) < 30) return "la couche ne couvre rien";
      let dessous = 0;
      for (const i of traits) {
        const apres = teinte(b, i);
        if (ecart(apres, teinte(a, i)) < ecart(apres, nappe)) dessous++;
      }
      return dessous > traits.length * 0.8 ? ""
        : `${dessous} traits sur ${traits.length} gardent leur couleur`;
    }) === "");

  /* Les couleurs de trait sont réglées sur le fond de la carte, et une couche
     posée dessus peut être de n'importe quelle teinte : une limite de département
     gris clair disparaît sous une averse pâle. La gaine, un trait plus large de la
     couleur du fond glissé sous le trait, rend l'écart de clarté quel que soit ce
     qu'il y a dessous. Le contrôle mesure cet écart dans une fenêtre de sept
     points autour de chaque trait.

     Le seuil vient de la carte elle-même. Le contrôle mesure d'abord l'écart sur
     la carte nue, au cadrage où il se trouve, puis le même écart sous la couche,
     et demande que la gaine en rende les sept dixièmes. L'épaisseur des traits
     suit le zoom : un seuil écrit en dur ne vaudrait que pour un cadrage. Sans la
     gaine, la nappe d'essai, pâle à dessein, ne laisse qu'un cinquième de
     l'écart. */
  const gaineDit = await pgNappe.evaluate(async () => {
      const cv = document.getElementById("caToile");
      const ctx = cv.getContext("2d");
      const dodo = m => new Promise(r => setTimeout(r, m));
      const pluie = document.getElementById("caPluie");
      const clarte = (d, i) =>
        (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;

      document.getElementById("caSansNappe").click(); await dodo(500);  // couche éteinte
      const a = ctx.getImageData(0, 0, cv.width, cv.height).data;
      const c = new Map();
      for (let i = 0; i < a.length; i += 4 * 53) {
        const k = `${a[i]},${a[i + 1]},${a[i + 2]}`;
        c.set(k, (c.get(k) || 0) + 1);
      }
      let dom = "", n = 0;
      for (const [k, v] of c) if (v > n) { dom = k; n = v; }
      const fond = dom.split(",").map(Number);
      const loin = i => Math.abs(a[i] - fond[0]) + Math.abs(a[i + 1] - fond[1])
        + Math.abs(a[i + 2] - fond[2]) > 40;
      /* Les traits pleins, pris loin des bords de la toile pour que la fenêtre de
         mesure tienne entière. */
      const larg = cv.width;
      const traits = [];
      for (let y = 40; y < cv.height - 40 && traits.length < 250; y += 3) {
        for (let x = 40; x < larg - 40 && traits.length < 250; x += 3) {
          const i = (y * larg + x) * 4;
          if (loin(i)) traits.push([x, y]);
        }
      }
      if (traits.length < 40) return `${traits.length} traits pleins`;

      /* La référence se mesure sur la carte nue, au cadrage où l'on est, plutôt
         que d'être écrite en dur. L'épaisseur des traits suit le zoom, et un
         seuil fixe vaudrait pour un seul cadrage. */
      const fenetre = (d, x, y) => {
        let bas = 1, haut = 0;
        for (let k = -7; k <= 7; k++) {
          const v = clarte(d, (y * larg + x + k) * 4);
          if (v < bas) bas = v;
          if (v > haut) haut = v;
        }
        return haut - bas;
      };
      const median = l => l.slice().sort((p, q) => p - q)[Math.floor(l.length / 2)];
      const nu = median(traits.map(([x, y]) => fenetre(a, x, y)));

      pluie.click(); await dodo(900);          // couche allumée
      const b = ctx.getImageData(0, 0, cv.width, cv.height).data;

      /* Seuls les traits que la couche recouvre vraiment. Mesurer tous les traits
         relevés sur la carte nue ne dit rien : la pluie ne couvre que 19 % de la
         vue, la médiane tombe hors d'elle, et la garde passait même avec une
         gaine réduite à rien. Un trait est tenu pour recouvert quand la couleur
         de son entourage a changé entre les deux images. */
      const recouvert = ([x, y]) => {
        for (let k = -7; k <= 7; k++) {
          const i = (y * larg + x + k) * 4;
          if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1])
            + Math.abs(a[i + 2] - b[i + 2]) > 24) return true;
        }
        return false;
      };
      const sous = traits.filter(recouvert);
      if (sous.length < 8) return `${sous.length} traits sous la couche`;
      const avec = median(sous.map(([x, y]) => fenetre(b, x, y)));
      const nuSous = median(sous.map(([x, y]) => fenetre(a, x, y)));
      return avec >= nuSous * 0.7 ? ""
        : `écart de ${avec.toFixed(3)} sous la couche contre ${nuSous.toFixed(3)} sur la carte nue`;
  });
  ok("un trait posé sur la couche garde son écart de clarté", gaineDit === "", gaineDit);

  /* La pluie est rallumée d'abord : le contrôle précédent l'éteint, et sans
     pluie ni nappe horaire la piste n'a plus de cadres depuis la version 151. */
  await pgNappe.evaluate(async () => {
    const p = document.getElementById("caPluie");
    if (p.getAttribute("aria-checked") !== "true") { p.click(); await new Promise(r => setTimeout(r, 900)); }
  });
  const extrapoleDit = await pgNappe.evaluate(async () => {
      const p = document.getElementById("caPiste");
      const h = document.getElementById("caHeure");
      if (p.classList.contains("ca-piste-futur")) return "l'observation se dit future";
      p.focus();
      p.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      p.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      await new Promise(r => setTimeout(r, 300));
      if (!p.classList.contains("ca-piste-futur")) return "l'extrapolation ne se dit pas";
      if (!h.classList.contains("ca-heure-futur")) return "l'heure ne porte pas la marque";
      return h.textContent === "09:20" ? "" : `heure ${h.textContent}`;
    });
  ok("une image extrapolée se distingue d'une observation", extrapoleDit === "", extrapoleDit);

  const lectureDit = await pgNappe.evaluate(async () => {
      const p = document.getElementById("caPiste");
      const j = document.getElementById("caJouer");
      p.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
      await new Promise(r => setTimeout(r, 300));
      const depart = Number(p.getAttribute("aria-valuenow"));
      j.click();
      if (j.getAttribute("aria-label") !== "Arrêter la chronologie") {
        return "le bouton ne dit pas qu'il lit";
      }
      await new Promise(r => setTimeout(r, 1700));
      const apres = Number(p.getAttribute("aria-valuenow"));
      j.click();
      await new Promise(r => setTimeout(r, 400));
      const arrete = Number(p.getAttribute("aria-valuenow"));
      await new Promise(r => setTimeout(r, 1400));
      if (Number(p.getAttribute("aria-valuenow")) !== arrete) return "la lecture ne s'arrête pas";
      return apres > depart ? "" : `le rang n'a pas avancé, ${depart} puis ${apres}`;
    });
  ok("la lecture avance d'image en image", lectureDit === "", lectureDit);

  /* Le doigt sur la piste choisit un instant. La piste est un curseur et non
     treize boutons : treize cibles sur trois cents points feraient vingt-deux
     points chacune, la moitié de ce qu'un doigt vise. */
  /* Le doigt est celui de Playwright, non un évènement fabriqué : la piste prend
     le pointeur à l'appui, et un pointeur fabriqué ne se prend pas. */
  /* La pluie est rallumée avant de relever la boîte : la garde précédente
     l'éteint pour mesurer l'ordre du tracé, et la chronologie disparaît avec
     elle depuis que la pluie est une superposition. */
  await pgNappe.evaluate(async () => {
    const dodo = m => new Promise(r => setTimeout(r, m));
    const p = document.getElementById("caPluie");
    if (p.getAttribute("aria-checked") !== "true") { p.click(); await dodo(900); }
  });
  const boitePiste = await pgNappe.locator("#caPiste").boundingBox();
  const lirePiste = async () => ({
    rang: await pgNappe.getAttribute("#caPiste", "aria-valuenow"),
    teinte: await pgNappe.evaluate(`(${teintePleine})()`),
  });
  const poserDoigt = async part => {
    await pgNappe.mouse.move(boitePiste.x + boitePiste.width * part,
      boitePiste.y + boitePiste.height / 2);
    await pgNappe.mouse.down();
    await pgNappe.mouse.up();
    await pgNappe.waitForTimeout(800);
  };
  /* Le doigt se pose vers le milieu de la piste, sur les dernières images du
     radar : le bout porte depuis la version 151 les heures prévues. */
  await poserDoigt(0.5);
  const bout = await lirePiste();
  await poserDoigt(0.02);
  const debut = await lirePiste();
  ok("le doigt sur la piste change l'image montrée",
    bout.rang !== debut.rang && bout.teinte !== debut.teinte,
    `rangs ${debut.rang} et ${bout.rang}, teintes ${debut.teinte} et ${bout.teinte}`);

  ok("la mention du service paraît avec la couche",
    await pgNappe.evaluate(async () => {
      const c = document.getElementById("caCredit");
      const p = document.getElementById("caPluie");
      const dodo = m => new Promise(r => setTimeout(r, m));
      const avec = c.textContent.includes("RainViewer")
        && c.querySelector('a[href*="rainviewer.com"]') !== null;
      /* La pluie s'éteint par sa propre tuile depuis qu'elle est une
         superposition : « Aucune » ne touche plus qu'à la nappe. */
      p.click(); await dodo(400);
      const sans = !c.textContent.includes("RainViewer");
      p.click(); await dodo(600);
      if (!avec) return "la mention manque quand la couche est allumée";
      return sans ? "" : "la mention reste quand la couche est éteinte";
    }) === "");

  await ctxNappe.close();

  /* Le contrat avec le service, relevé sur les adresses réellement émises.

     Une seule image à l'ouverture : la dernière observée, douze tuiles, seize
     kilooctets mesurés. Les douze autres images n'arrivent que si la chronologie
     est mise en marche, et une tuile déjà vue ne se redemande pas. */
  etat.appelsRadar.length = 0;
  const [ctxRad, pgRad] = await ouvrirCarte(FAIN, 0);
  const tuilesDe = () => etat.appelsRadar.filter(u => u.includes("tilecache"));
  const cheminsDe = () => new Set(tuilesDe().map(u => /\/v2\/radar\/([a-z0-9]+)\//.exec(u)[1]));

  ok("l'ouverture ne charge qu'une image",
    cheminsDe().size === 1 && [...cheminsDe()][0] === "obs12",
    `${cheminsDe().size} images : ${[...cheminsDe()].join(", ")}`);

  ok("les tuiles se demandent en deux cent cinquante-six points",
    tuilesDe().length > 0 && tuilesDe().every(u => /\/(obs|nc)\d+\/256\/\d+\/\d+\/\d+\/2\/1_1\.png$/.test(u)),
    tuilesDe()[0] || "aucune tuile");

  /* Le service ne sert le radar que jusqu'au zoom sept. Au delà il rend une image
     grise portant « Zoom Level Not Supported », la même pour toutes les
     coordonnées, et la carte s'ouvre au zoom huit : la couche ne montrait rien.

     Le défaut a vécu une journée entière en production. La mesure qui l'a laissé
     passer ne regardait que le poids des tuiles : douze fois mille trois cent
     soixante-dix octets font seize kilooctets, ce qui ressemblait à une vue de
     pluie faible. Ce que le poids ne dit pas, deux tuiles éloignées le disent :
     au delà de sept elles sont identiques à l'octet près. */
  const zoomsDe = () => [...new Set(tuilesDe()
    .map(u => Number(/\/(?:obs|nc)\d+\/256\/(\d+)\//.exec(u)[1])))].sort((a, b) => a - b);
  ok("aucune tuile n'est demandée au delà du zoom que le service sert",
    zoomsDe().length > 0 && Math.max(...zoomsDe()) <= 7,
    `zooms demandés : ${zoomsDe().join(", ")}`);

  /* Au delà de sept, la couche continue de poser les tuiles de sept, agrandies.
     Une carte de près doit rester couverte : sans cela, zoomer sur sa commune
     effacerait la pluie. */
  ok("la couche couvre encore la carte au zoom le plus fort",
    await pgRad.evaluate(async () => {
      const R = await import("/src/radar.js");
      const l = 390, h = 660;
      const compte = z => R.tuilesVues({ lat: 48.85, lon: 2.35, z }, l, h);
      const huit = compte(8), dix = compte(10);
      if (!huit.length || !dix.length) return "aucune tuile";
      if (huit.some(t => t.z > 7) || dix.some(t => t.z > 7)) return "zoom de tuile trop profond";
      // Les tuiles agrandies doivent couvrir la vue entière, bords compris.
      const couvre = ts => {
        const x0 = Math.min(...ts.map(t => t.px)), x1 = Math.max(...ts.map(t => t.px + t.cote));
        const y0 = Math.min(...ts.map(t => t.py)), y1 = Math.max(...ts.map(t => t.py + t.cote));
        return x0 <= 0 && y0 <= 0 && x1 >= l && y1 >= h;
      };
      if (!couvre(huit)) return "le zoom huit laisse un bord nu";
      if (!couvre(dix)) return "le zoom dix laisse un bord nu";
      // Une tuile agrandie double de côté à chaque cran au delà de la borne.
      return Math.abs(dix[0].cote - huit[0].cote * 4) < 1 ? ""
        : `côtés ${huit[0].cote} et ${dix[0].cote}`;
    }) === "");

  /* Sans image extrapolée, la chronologie s'arrête à la dernière observation. Le
     service en publiait aucune aux deux relevés du 5 septembre 2026 : la couche ne
     l'invente pas. */
  /* Depuis la version 151, les douze heures prévues suivent : la piste porte
     treize images observées puis douze heures, et s'ouvre sur maintenant. */
  ok("sans image extrapolée la chronologie s'arrête à maintenant",
    await pgRad.evaluate(() => {
      const p = document.getElementById("caPiste");
      return `${p.getAttribute("aria-valuemax")}|${p.getAttribute("aria-valuenow")}`
        + `|${p.classList.contains("ca-piste-futur")}`;
    }) === "24|12|false");

  // Une tuile déjà vue ne se redemande pas : la chronologie parcourue deux fois
  // ne coûte pas deux fois.
  const avantAller = tuilesDe().length;
  await pgRad.evaluate(async () => {
    const p = document.getElementById("caPiste");
    for (const k of [0, 1, 0, 1, 0]) {
      p.dispatchEvent(new KeyboardEvent("keydown", { key: k ? "ArrowRight" : "ArrowLeft", bubbles: true }));
      await new Promise(r => setTimeout(r, 250));
    }
  });
  await pgRad.waitForTimeout(400);
  const apresAller = tuilesDe().length;
  ok("une tuile déjà chargée ne se redemande pas",
    apresAller - avantAller <= 24,
    `${apresAller - avantAller} tuiles pour un aller-retour de deux images`);
  await ctxRad.close();

  /* La couche éteinte ne charge rien du tout : ni index, ni tuile. C'est le geste
     de qui ménage son réseau, et il doit valoir quelque chose. */
  etat.appelsRadar.length = 0;
  const [ctxEteint, pgEteint] = await ouvrirCarte({ ...FAIN, radar: false }, 0);
  ok("la couche éteinte ne demande rien au service",
    etat.appelsRadar.length === 0, `${etat.appelsRadar.length} appels`);
  ok("la couche éteinte cache la chronologie",
    await pgEteint.evaluate(() => {
      const r = document.getElementById("caTemps");
      const p = document.getElementById("caPluie");
      return r.hidden && p.getAttribute("aria-checked") === "false";
    }));
  /* Le choix se garde d'une visite à l'autre : rallumée ici, elle doit être
     rallumée au prochain passage sur la carte. */
  ok("le choix de la couche se garde",
    await pgEteint.evaluate(async () => {
      document.getElementById("caPluie").click();
      await new Promise(r => setTimeout(r, 500));
      document.querySelector('[data-onglet="accueil"]').click();
      await new Promise(r => setTimeout(r, 400));
      document.querySelector('[data-onglet="carte"]').click();
      await new Promise(r => setTimeout(r, 900));
      return document.getElementById("caPluie").getAttribute("aria-checked") === "true"
        && !document.getElementById("caTemps").hidden;
    }));
  await ctxEteint.close();

  /* Sans réseau, la carte reste lisible et la pluie se tait en le disant. Le fond
     est dessiné : c'est ce qui distingue cette carte d'une carte en tuiles, qui
     n'aurait rien à montrer. */
  etat.radarFutur = 0;
  const ctxSec = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await ctxSec.addInitScript(amorceGardee(FAIN, FIGE));
  await brancherRoutes(ctxSec);
  await ctxSec.route(/rainviewer\.com/, r => r.abort());
  const pgSec = await ctxSec.newPage();
  await ouvrirPage(pgSec);
  await pgSec.locator('[data-onglet="carte"]').click();
  await pgSec.waitForTimeout(900);
  ok("sans réseau la pluie le dit et la carte reste dessinée",
    await pgSec.evaluate(() => {
      const m = document.getElementById("caMot");
      if (m.hidden || !/réseau/i.test(m.textContent)) return `mot : « ${m.textContent} »`;
      if (!document.getElementById("caTemps").hidden) return "la chronologie paraît sans images";
      const cv = document.getElementById("caToile");
      const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
      const t = new Set();
      for (let i = 0; i < d.length; i += 4 * 97) t.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
      return t.size > 3 ? "" : "le fond n'est pas dessiné";
    }) === "");
  await ctxSec.close();

  /* ---------- Les nappes de la carte ----------

     Une grille de 380 points, une valeur par point, une couleur étalée entre les
     points. Mesuré le 7 septembre 2026 : 13 840 octets compressés pour quatre
     colonnes, et une adresse de 5977 octets, ce qui borne le pas à soixante
     kilomètres, le service refusant au delà.

     Les nappes sont exclusives entre elles : ce sont des étalements de couleur sur
     toute la surface, et deux superposés ne se liraient ni l'un ni l'autre. */
};
