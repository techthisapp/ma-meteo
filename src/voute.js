/* La peinture de la voûte étoilée, version 176, jalon 24, d'après la maquette
   validée par Jérôme le 5 octobre 2026.

   Un fond de bleu nuit plus clair vers l'horizon ; la Voie lactée calculée sur
   le plan de la galaxie, sans fichier de plus ; les étoiles à cœur blanc, halo
   de leur couleur et aigrettes pour les plus vives ; les noms placés sans se
   chevaucher, en capitales espacées pour les constellations, en jaune pâle
   pour les étoiles brillantes ; sous l'horizon, une eau calme où se devinent
   les étoiles et les noms, bordée d'une crête basse en silhouette.

   Le module ne sait rien de l'écran qui l'emploie : il reçoit une toile, une
   vue et des options, et peint. */

import * as Ciel from "./ciel.js";
import * as Astres from "./astres.js";

const R = Math.PI / 180;

/* Les noms français des étoiles les plus brillantes ; les autres gardent leur
   nom de catalogue, que l'écran n'écrit pas. */
export const ETOILES_FR = {
  Vega: "Véga", Altair: "Altaïr", Deneb: "Deneb", Arcturus: "Arcturus", Antares: "Antarès",
  Spica: "Spica", Capella: "Capella", Aldebaran: "Aldébaran", Betelgeuse: "Bételgeuse", Rigel: "Rigel",
  Sirius: "Sirius", Procyon: "Procyon", Pollux: "Pollux", Castor: "Castor", Regulus: "Régulus",
  Fomalhaut: "Fomalhaut", Polaris: "Étoile polaire", Mirfak: "Mirfak", Alpheratz: "Alphératz",
  Achernar: "Achernar", Canopus: "Canopus", Bellatrix: "Bellatrix", Alnilam: "Alnilam",
  Denebola: "Denebola", Alioth: "Alioth", Dubhe: "Dubhe", Hamal: "Hamal",
};

/* ---------- La Voie lactée ----------

   Le plan de la galaxie converti en coordonnées équatoriales. La matière est un
   bruit fractal posé sur la bande, plus large et plus claire vers le centre
   galactique, dans le Sagittaire ; des filets de poussière la creusent, et la
   Grande Faille entre l'Aigle et le Cygne. Un léger décalage aléatoire des
   points efface la trame régulière de la grille. */
function galEnEq(l, b) {
  const aN = 192.85948 * R, dN = 27.12825 * R, lN = 122.93192 * R;
  const L = l * R, B = b * R;
  const dec = Math.asin(Math.sin(B) * Math.sin(dN) + Math.cos(B) * Math.cos(dN) * Math.cos(lN - L));
  const ra = aN + Math.atan2(Math.cos(B) * Math.sin(lN - L),
    Math.sin(B) * Math.cos(dN) - Math.cos(B) * Math.sin(dN) * Math.cos(lN - L));
  return [((((ra / R) % 360) + 360) % 360) / 15, dec / R];
}
const ecart = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const hach = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };
function bruit(x, y, periode) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const m = k => ((k % periode) + periode) % periode;
  const a = hach(m(xi), yi), b = hach(m(xi + 1), yi), c = hach(m(xi), yi + 1), d = hach(m(xi + 1), yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(l, b, base, oct = 5) {
  let s = 0, amp = 0.5, f = 1, tot = 0;
  for (let k = 0; k < oct; k++) {
    s += amp * bruit(l / base * f, b / base * f + k * 17, Math.round(360 / base * f));
    tot += amp; amp *= 0.5; f *= 2;
  }
  return s / tot;
}

let VOIE = null, POUSSIERE = null;
/* La bande se calcule une fois, au premier tracé : un peu plus de six mille
   points. */
export function voie() {
  if (VOIE) return { voie: VOIE, poussiere: POUSSIERE };
  VOIE = []; POUSSIERE = [];
  for (let l = 0; l < 360; l += 1.5) {
    for (let b = -26; b <= 26; b += 1.5) {
      const larg = 7 + 7 * Math.exp(-((ecart(l, 0) / 45) ** 2));
      const profil = Math.exp(-((b / larg) ** 2));
      const eclat = 0.35 + 0.75 * Math.exp(-((ecart(l, 2) / 32) ** 2))
        + 0.3 * Math.exp(-((ecart(l, 75) / 25) ** 2)) + 0.18 * Math.exp(-((ecart(l, 300) / 30) ** 2));
      const i = profil * eclat * (0.25 + 1.9 * Math.max(0, fbm(l, b, 9) - 0.3) ** 1.25);
      if (i > 0.04) {
        const [ra, dec] = galEnEq(l + (hach(l, b) - 0.5) * 1.6, b + (hach(b, l) - 0.5) * 1.6);
        VOIE.push({ ra, dec, i, chaud: Math.max(0, fbm(l + 50, b, 14) - 0.55) * 2 });
      }
      const faille = (l > 10 && l < 90) ? Math.exp(-(((b - 2) / 3.2) ** 2)) * 0.9 : 0;
      const filets = Math.max(0, fbm(l + 200, b, 4.5) - 0.55) * 2.4 * Math.exp(-((b / 6) ** 2));
      const p = Math.min(1, faille * (0.6 + 0.6 * fbm(l, b + 40, 5)) + filets);
      if (p > 0.08) {
        const [ra, dec] = galEnEq(l + (hach(b, l + 7) - 0.5) * 1.6, b + (hach(l + 3, b) - 0.5) * 1.6);
        POUSSIERE.push({ ra, dec, p });
      }
    }
  }
  return { voie: VOIE, poussiere: POUSSIERE };
}

/* ---------- Les motifs ---------- */

const toileDe = n => { const t = document.createElement("canvas"); t.width = t.height = n; return t; };
const sprite = (couleur, n = 64) => {
  const t = toileDe(n), g = t.getContext("2d");
  const d = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  d.addColorStop(0, `rgba(${couleur},1)`); d.addColorStop(0.35, `rgba(${couleur},.45)`); d.addColorStop(1, `rgba(${couleur},0)`);
  g.fillStyle = d; g.fillRect(0, 0, n, n); return t;
};
let MOTIFS = null;
function motifs() {
  if (MOTIFS) return MOTIFS;
  const couleurs = { "#cddcf5": "170,200,255", "#e6eefc": "205,220,255", "#fdf6e6": "255,245,220",
    "#fbe3c2": "255,215,165", "#f7cfae": "255,185,140" };
  const aigrette = toileDe(128), g = aigrette.getContext("2d");
  for (const [w, a] of [[1, 0.9], [3, 0.25]]) {
    for (const vertical of [false, true]) {
      const d = vertical ? g.createLinearGradient(0, 0, 0, 128) : g.createLinearGradient(0, 0, 128, 0);
      d.addColorStop(0, "rgba(255,255,255,0)"); d.addColorStop(0.5, `rgba(255,255,255,${a})`); d.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = d;
      if (vertical) g.fillRect(64 - w / 2, 0, w, 128); else g.fillRect(0, 64 - w / 2, 128, w);
    }
  }
  MOTIFS = {
    froide: sprite("150,165,235"), chaude: sprite("205,150,215"), sombre: sprite("0,0,0"),
    halos: Object.fromEntries(Object.entries(couleurs).map(([k, v]) => [k, sprite(v)])),
    aigrette,
  };
  return MOTIFS;
}

/* La crête basse à l'horizon, tirée du bruit selon l'azimut, en degrés. */
export const crete = az => 0.3 + 2.4 * fbm(az, 3, 14, 4) ** 2;

/* ---------- Le placement des noms ----------

   Les noms se posent par ordre d'importance ; un nom qui en chevauche un autre
   se décale d'une ligne vers le bas, puis vers le haut, et renonce ensuite. */
export function placeur(ctx) {
  const pris = [];
  return (texte, x, y, police, prioritaire = false) => {
    ctx.font = police;
    const w = ctx.measureText(texte).width + 6, h = 14;
    /* Le pas vaut la hauteur d'un nom : à treize points, un nom posé sous un
       autre le chevauchait d'un point et renonçait toujours. */
    for (const dy of prioritaire ? [0, h, -h, 2 * h] : [0, h, -h]) {
      const b = { x: x - w / 2, y: y + dy - h + 3, w, h };
      if (!pris.some(p => b.x < p.x + p.w && b.x + b.w > p.x && b.y < p.y + p.h && b.y + b.h > p.y)) {
        pris.push(b); return { x, y: y + dy };
      }
    }
    return null;
  };
}

/* ---------- La peinture ---------- */

const POLICE = "-apple-system, system-ui, sans-serif";
const CARDINAUX = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
const caches = new WeakMap();

/* `vue` porte az, haut, champ, instant, sel et cible ; les options portent
   l'affichage, les cardinaux, la couverture nuageuse de l'instant, en part de
   un, l'heure de l'animation et le mouvement réduit. Rend la position d'écran
   de la constellation cherchée, ou `null`. */
export function peindre(cv, vue, g, options = {}) {
  const affichage = options.affichage || "visibles";
  const t = options.t || 0;
  const calme = options.calme === true;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = cv.clientWidth, H = cv.clientHeight;
  if (!W || !H) return null;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }
  const ctx = cv.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const date = vue.instant || new Date();
  const jj = Astres.jourJulien(date);
  const unite = Math.min(W, H) / 2;
  const ecranDe = p => [W / 2 + p.x * unite, H / 2 + p.y * unite];
  const proj = (az, h) => Ciel.projeter(az, h, vue.az, vue.haut, vue.champ);
  const bords = [W / 2 / unite + 0.05, H / 2 / unite + 0.05];
  const dedans = ([x, y]) => x > -20 && x < W + 20 && y > -20 && y < H + 20;
  const zoom = 60 / vue.champ;
  const echelle = Math.sqrt(zoom) * unite / 195;

  /* Le fond, et la lueur du Soleil quand il n'est pas assez bas. */
  const soleil = Astres.position("soleil", date, g.lat, g.lon);
  const lueur = Math.max(0, Math.min(1, (soleil.hauteur + 18) / 14));
  const ph = proj(vue.az, 0);
  const horizonY = ph ? ecranDe(ph)[1] : (vue.haut > 0 ? H * 2 : -H);
  const fond = ctx.createLinearGradient(0, horizonY - H * 1.1, 0, horizonY);
  fond.addColorStop(0, "#05082a");
  fond.addColorStop(0.6, "#0b1146");
  fond.addColorStop(1, `rgb(${Math.round(26 + 110 * lueur)},${Math.round(34 + 50 * lueur)},${Math.round(98 - 10 * lueur)})`);
  ctx.fillStyle = fond;
  ctx.fillRect(0, 0, W, H);
  if (!Ciel.chargees()) return null;
  const M = motifs();

  /* La Voie lactée, sur une toile au quart de la taille, gardée tant que la vue
     ne bouge pas, puis agrandie, ce qui l'adoucit. */
  const k = 4;
  let cache = caches.get(cv);
  if (!cache) { cache = { toile: document.createElement("canvas"), cle: "" }; caches.set(cv, cache); }
  const cle = [vue.az.toFixed(1), vue.haut.toFixed(1), vue.champ.toFixed(1), Math.round(date / 300000), W, H].join("|");
  if (cle !== cache.cle) {
    cache.cle = cle;
    const vt = cache.toile;
    vt.width = Math.ceil(W / k); vt.height = Math.ceil(H / k);
    const gv = vt.getContext("2d");
    gv.clearRect(0, 0, vt.width, vt.height);
    const pxDeg = unite / vue.champ * 1.05;
    const { voie: bande, poussiere } = voie();
    gv.globalCompositeOperation = "lighter";
    for (const v of bande) {
      const { hauteur, azimut } = Ciel.surHorizon(v.ra, v.dec, jj, g.lat, g.lon);
      const p = proj(azimut, hauteur); if (!p) continue;
      const [x, y] = ecranDe(p); if (x < -60 || x > W + 60 || y < -60 || y > H + 60) continue;
      const r = 3.2 * pxDeg / k;
      const air = hauteur < 0 ? 0.5 : Math.min(1, 0.3 + hauteur / 22);
      gv.globalAlpha = Math.min(1, v.i * 0.3 * air);
      gv.drawImage(v.chaud > 0.15 ? M.chaude : M.froide, x / k - r, y / k - r, 2 * r, 2 * r);
    }
    gv.globalCompositeOperation = "destination-out";
    for (const d of poussiere) {
      const { hauteur, azimut } = Ciel.surHorizon(d.ra, d.dec, jj, g.lat, g.lon);
      const p = proj(azimut, hauteur); if (!p) continue;
      const [x, y] = ecranDe(p); if (x < -60 || x > W + 60 || y < -60 || y > H + 60) continue;
      const r = 2.4 * pxDeg / k;
      gv.globalAlpha = d.p * 0.6;
      gv.drawImage(M.sombre, x / k - r, y / k - r, 2 * r, 2 * r);
    }
  }
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.95 * (1 - 0.85 * lueur);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(cache.toile, 0, 0, W, H);
  ctx.restore();

  const figures = Ciel.figuresVues(date, g.lat, g.lon, vue.az, vue.haut, vue.champ, true);
  const etoiles = Ciel.etoilesVues(date, g.lat, g.lon, vue.az, vue.haut, vue.champ, affichage, bords, true);
  const trait = (f, couleur, ep) => {
    ctx.beginPath();
    f.points.forEach((p, i) => { const [x, y] = ecranDe(p); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.strokeStyle = couleur; ctx.lineWidth = ep; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
  };

  /* Les figures : un fil discret. La constellation cherchée ou désignée
     s'illumine d'un double trait, un voile large et une ligne nette, qui
     respire. */
  const respire = calme ? 1 : 0.8 + 0.2 * Math.sin(t / 500);
  const vive = s => s && (s === vue.cible || s === vue.sel);
  for (const f of figures) {
    if (vive(f.sigle)) {
      trait(f, `rgba(255,236,190,${(0.22 * respire).toFixed(3)})`, 7);
      trait(f, f.sous ? "rgba(255,240,210,.55)" : "rgba(255,248,230,.95)", 1.6);
    } else {
      trait(f, f.sous ? "rgba(190,205,255,.12)" : "rgba(200,215,255,.26)", 0.8);
    }
  }

  /* Les étoiles. Sous l'eau, un reflet flou et pâli. Au-dessus, un halo de leur
     couleur, des aigrettes pour les plus vives, un cœur blanc ; les basses
     scintillent. */
  const nommees = [];
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const e of etoiles) {
    const [x, y] = ecranDe(e);
    const eclat = Math.max(0, Math.min(1, (6.2 - e.mag) / 7.2));
    const halo = M.halos[Ciel.couleur(e.ci)] || M.halos["#e6eefc"];
    if (e.sous) {
      const r = (2 + 7 * eclat ** 1.5) * echelle;
      ctx.globalAlpha = 0.28 + 0.4 * eclat;
      ctx.drawImage(halo, x - r, y - r, 2 * r, 2 * r);
      continue;
    }
    const sc = !calme && e.hauteur < 25
      ? 0.75 + 0.25 * Math.sin(t / 160 + x * 0.37 + y * 0.71) * (1 - e.hauteur / 25) : 1;
    const rh = (1.5 + 13 * eclat ** 2.2) * echelle;
    ctx.globalAlpha = (0.25 + 0.75 * eclat) * sc;
    ctx.drawImage(halo, x - rh, y - rh, 2 * rh, 2 * rh);
    if (e.mag < 2) {
      const ra = (14 + 22 * (2 - e.mag) / 3.5) * echelle;
      ctx.globalAlpha = (0.35 + 0.25 * (2 - e.mag) / 3.5) * sc;
      ctx.drawImage(M.aigrette, x - ra, y - ra, 2 * ra, 2 * ra);
    }
    const rc = (0.35 + 1.5 * eclat ** 1.8) * echelle;
    ctx.globalAlpha = sc;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(x, y, rc, 0, 2 * Math.PI); ctx.fill();
    if (e.mag < 1.6 && ETOILES_FR[e.nom]) nommees.push({ nom: ETOILES_FR[e.nom], x, y: y + rh * 0.45 + 13, mag: e.mag });
  }
  ctx.restore();

  /* La Lune à sa phase, et les planètes. */
  const poser = placeur(ctx);
  const noms = [];
  for (const a of Ciel.astresVus(date, g.lat, g.lon, vue.az, vue.haut, vue.champ, bords, true)) {
    const [x, y] = ecranDe(a);
    const r = a.cle === "lune" ? unite * 0.04 * zoom : 1.4 + 1.2 * echelle;
    ctx.globalAlpha = a.sous ? 0.35 : 1;
    if (a.cle === "lune") {
      const ecl = Astres.phase(date).eclairee;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Astres.angleLimbe(date, g.lat, g.lon));
      ctx.fillStyle = "#2a2f3a"; ctx.beginPath(); ctx.arc(0, 0, r, 0, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = "#ece8d6"; ctx.beginPath();
      ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
      const q = 1 - 2 * ecl;
      ctx.ellipse(0, 0, Math.abs(q) * r, r, 0, Math.PI / 2, -Math.PI / 2, q > 0);
      ctx.fill(); ctx.restore();
    } else {
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      const rh = r * 6;
      ctx.drawImage(M.halos["#fdf6e6"], x - rh, y - rh, 2 * rh, 2 * rh);
      ctx.restore();
      ctx.fillStyle = "#fff4d6"; ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fill();
    }
    ctx.globalAlpha = 1;
    noms.push({ texte: a.nom, x, y: y + r + 14, police: `500 12px ${POLICE}`,
      couleur: a.sous ? "rgba(246,226,170,.45)" : "rgba(246,226,170,.95)", prio: true });
  }
  if (options.cardinaux !== false) {
    for (const [h, mot] of [[90, "Zénith"], [-90, "Nadir"]]) {
      const p = proj(vue.az, h); if (!p) continue;
      const [x, y] = ecranDe(p); if (!dedans([x, y])) continue;
      ctx.strokeStyle = "rgba(220,230,245,.45)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, 5, 0, 2 * Math.PI); ctx.stroke();
      noms.push({ texte: mot, x, y: y + 18, police: `11px ${POLICE}`, couleur: "rgba(220,230,245,.65)", prio: true });
    }
  }
  for (const n of nommees.sort((a, b) => a.mag - b.mag)) {
    noms.push({ texte: n.nom, x: n.x, y: n.y, police: `400 12px ${POLICE}`, couleur: "rgba(246,226,170,.92)", prio: true });
  }

  /* Les noms des constellations, au-dessus comme sous l'eau. */
  let cible = null;
  for (const [sigle, [nom, ra, dec]] of Object.entries(Ciel.chargees().noms)) {
    const { hauteur, azimut } = Ciel.surHorizon(ra, dec, jj, g.lat, g.lon);
    const p = proj(azimut, hauteur); if (!p) continue;
    const [x, y] = ecranDe(p);
    if (sigle === vue.cible) cible = { x, y };
    if (!dedans([x, y])) continue;
    const sous = hauteur < 0, vif = vive(sigle);
    noms.push({ texte: nom.toLocaleUpperCase("fr"), x, y, espace: true,
      police: `${vif ? "600 14px" : "400 11px"} ${POLICE}`,
      couleur: vif ? "rgba(255,250,236,1)" : sous ? "rgba(185,200,240,.42)" : "rgba(222,230,250,.78)", prio: vif });
  }
  ctx.textAlign = "center";
  ctx.lineJoin = "round";
  for (const n of noms.sort((a, b) => (b.prio ? 1 : 0) - (a.prio ? 1 : 0))) {
    if ("letterSpacing" in ctx) ctx.letterSpacing = n.espace ? "1.5px" : "0px";
    const x = Math.max(36, Math.min(W - 36, n.x));
    const ici = poser(n.texte, x, n.y, n.police, n.prio);
    if (!ici) continue;
    ctx.font = n.police;
    ctx.shadowColor = "rgba(3,6,30,.95)"; ctx.shadowBlur = 6;
    ctx.fillStyle = n.couleur;
    ctx.fillText(n.texte, ici.x, ici.y);
    ctx.shadowBlur = 0;
  }
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";

  /* L'eau, calme, et la crête en silhouette. */
  const bord = [], crt = [];
  for (let az = 0; az <= 360; az += 2) {
    const p = proj(az, 0); if (p) bord.push(ecranDe(p));
    const q = proj(az, crete(az)); if (q) crt.push(ecranDe(q));
  }
  if (bord.length > 1) {
    bord.sort((a, b) => a[0] - b[0]); crt.sort((a, b) => a[0] - b[0]);
    const surface = Math.max(0, Math.min(...bord.map(p => p[1])));
    const eau = new Path2D(); eau.moveTo(-10, H + 10);
    for (const [x, y] of bord) eau.lineTo(x, y);
    eau.lineTo(W + 10, H + 10); eau.closePath();
    const prof = ctx.createLinearGradient(0, surface, 0, H);
    prof.addColorStop(0, "rgba(14,22,72,.62)"); prof.addColorStop(0.35, "rgba(8,12,48,.78)"); prof.addColorStop(1, "rgba(4,6,26,.9)");
    ctx.fillStyle = prof; ctx.fill(eau);
    ctx.save(); ctx.clip(eau);
    const reflet = ctx.createLinearGradient(0, surface, 0, surface + 70);
    reflet.addColorStop(0, `rgba(${Math.round(70 + 120 * lueur)},${Math.round(90 + 50 * lueur)},170,.22)`);
    reflet.addColorStop(1, "rgba(60,80,160,0)");
    ctx.fillStyle = reflet; ctx.fillRect(0, surface, W, 70);
    ctx.restore();
    if (crt.length > 1) {
      const sil = new Path2D(); sil.moveTo(-10, bord[0][1] + 2);
      for (const [x, y] of crt) sil.lineTo(x, y);
      for (let i = bord.length - 1; i >= 0; i--) sil.lineTo(bord[i][0], bord[i][1] + 1.5);
      sil.closePath();
      ctx.fillStyle = "#04061c"; ctx.fill(sil);
      ctx.beginPath();
      crt.forEach(([x, y], i) => { if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.strokeStyle = "rgba(120,140,210,.35)"; ctx.lineWidth = 0.8; ctx.stroke();
    }
  }
  if (options.cardinaux !== false) {
    for (let az = 0; az < 360; az += 15) {
      const p = proj(az, 0); if (!p || Math.abs(p.x) > 1.2) continue;
      const [x, y] = ecranDe(p); if (y < 0 || y > H) continue;
      if (az % 45 === 0) {
        ctx.font = `600 12px ${POLICE}`; ctx.fillStyle = "rgba(220,230,250,.9)";
        ctx.fillText(CARDINAUX[az / 45], x, Math.min(y + 22, H - 6));
      } else if (zoom > 1.4) {
        ctx.font = `10px ${POLICE}`; ctx.fillStyle = "rgba(220,230,250,.5)";
        ctx.fillText(`${az}°`, x, Math.min(y + 20, H - 6));
      }
    }
  }

  /* Les nuages prévus à l'instant choisi voilent la carte. */
  const couv = options.nuages || 0;
  if (couv > 0.12) {
    if (!MOTIFS.nuages) {
      const n = toileDe(512), gn = n.getContext("2d");
      /* Chaque tache se répète de part et d'autre des bords : la tuile se
         raccorde à elle-même, sans joint visible. */
      for (let i = 0; i < 160; i++) {
        const x0 = hach(i, 1) * 512, y0 = hach(i, 2) * 512, r = 30 + hach(i, 3) * 90;
        for (const dx of [-512, 0, 512]) {
          for (const dy of [-512, 0, 512]) {
            const x = x0 + dx, y = y0 + dy;
            if (x + r < 0 || x - r > 512 || y + r < 0 || y - r > 512) continue;
            const d = gn.createRadialGradient(x, y, 0, x, y, r);
            d.addColorStop(0, "rgba(120,130,150,.45)"); d.addColorStop(1, "rgba(120,130,150,0)");
            gn.fillStyle = d; gn.beginPath(); gn.arc(x, y, r, 0, 2 * Math.PI); gn.fill();
          }
        }
      }
      MOTIFS.nuages = n;
    }
    ctx.save();
    ctx.globalAlpha = Math.min(0.85, couv * 0.95);
    const d = calme ? 0 : (t / 60) % 512;
    for (let x = -512; x < W + 512; x += 512) {
      for (let y = -512; y < H + 512; y += 512) {
        ctx.drawImage(MOTIFS.nuages, x + d - ((vue.az * 6) % 512), y - ((vue.haut * 6) % 512), 512, 512);
      }
    }
    ctx.restore();
  }
  return cible;
}
