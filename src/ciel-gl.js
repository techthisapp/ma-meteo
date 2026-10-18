/* Le ciel de l'accueil plein ciel peint par la carte graphique, version 216.
   Demande de Jérôme du 17 octobre 2026, sur maquette : plus de réalisme, à la
   manière de l'application d'Apple, plusieurs plans de nuages à des vitesses
   différentes pour la profondeur, et des ciels variés.

   Les nuages sont des textures calculées à l'avance par un rendu volumique,
   `outils/construire-nuages.mjs`, dans `donnees/nuages/` : la lumière directe
   en rouge, la lumière diffuse en vert, l'opacité en alpha. Le programme ne
   fait que les poser, en quatre plans au plus, du lointain au proche, et les
   teinter des couleurs du ciel du moment, celles de `temps.js` : la palette
   et les réglages de lisibilité restent les mêmes. Un plan lointain est
   petit, lent, pâli par l'air ; un plan proche est grand et rapide. Au
   défilement de la page, chaque plan glisse d'autant plus qu'il est proche.

   La toile est transparente : le dégradé du ciel nu, le Soleil et la Lune
   restent ceux du panneau, dessous. Le programme ajoute l'éblouissement de
   l'astre, le halo irisé sous un voile mince, les reflets d'objectif, la
   pluie, la neige, le brouillard et les éclairs.

   `temps.js` garde la boucle, la pause hors écran et le dessin sur toile en
   repli : sans WebGL, ou quand la toile ne le demande pas, rien ne change. */

import { QUANTILES } from "./etalonnage-nuages.js";

const TEXTURES = ["cumulus", "dense", "stratus", "alto", "fractus", "cirrus"];
const SORTE = { cumulus: 0, dense: 0, stratus: 1, cirrus: 2, alto: 3, fractus: 4 };

const VS = "attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }";
const FS = `
precision highp float;
uniform vec2 uRes; uniform float uT, uDefile, uApparition;
uniform vec3 uHaut, uBas, uClair, uSombre, uAstre;
uniform float uNuit, uChaud, uPluie, uNeige, uVent, uOrage, uN, uHalo, uMiroir, uBrouillard, uVoile, uDoux;
uniform vec4 uDecal; // la dérive de chaque plan, en carreaux, ramenée entre zéro et un
uniform vec4 uC[4]; // sorte, profondeur, seuil d'opacité, opacité
uniform vec4 uD[4]; // ombre, largeur du bord, graine, libre
uniform sampler2D uTex[4];
uniform sampler2D uBrume;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float asp = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec3 ciel = mix(uBas, uHaut, smoothstep(0.0, 1.0, uv.y));
  vec4 acc = vec4(0.0);

  vec2 a = vec2(uAstre.x * asp, 1.0 - uAstre.y);
  vec2 centre = vec2(asp * 0.5, 0.5);
  float d = length(p - a);
  bool soleil = uAstre.z > 0.5;
  vec3 lum = soleil ? mix(vec3(1.0, 0.94, 0.82), vec3(1.0, 0.72, 0.45), uChaud) : vec3(0.82, 0.86, 0.95);
  float ouvert = 1.0 - smoothstep(0.35, 0.9, uVoile);
  float bloom = exp(-d * d * 30.0) * 0.45 + exp(-d * 4.5) * 0.12;
  bool jour = soleil && uNuit < 0.5;

  /* Le cœur du Soleil, surexposé, posé avant les nuages : un nuage qui passe
     devant le cache. Il remplace le disque du panneau, que la feuille de
     style rend transparent sous ce ciel. Bas sur l'horizon, derrière le
     texte, il s'adoucit comme le disque, version 207. */
  const float RC = 0.026;
  if (jour) {
    float coeur = smoothstep(RC, RC * 0.72, d);
    float auree = exp(-d * d * 700.0) * 0.9;
    float a0 = max(coeur, auree) * mix(1.0, 0.4, uDoux);
    vec3 blancChaud = mix(vec3(1.0, 0.99, 0.96), lum, 0.25);
    acc = vec4(blancChaud * a0, a0);
  }
  float nuageA = 0.0;

  float eclair = 0.0;
  if (uOrage > 0.0) eclair = pow(max(0.0, sin(uT * 0.9) * sin(uT * 2.7 + 1.3) * sin(uT * 0.37)), 6.0);
  vec2 lueur = vec2(asp * (0.3 + 0.4 * fract(floor(uT * 0.9 / 6.283) * 0.618)), 0.75);

  for (int i = 0; i < 4; i++) {
    if (float(i) >= uN) break;
    vec4 c = uC[i]; vec4 e = uD[i];
    float prof = c.y;
    float carreau = mix(0.42, 0.95, prof);
    vec2 q = p / carreau;
    q.x = q.x * uMiroir;
    /* La dérive vient du programme, déjà ramenée entre zéro et un : ajoutée
       au temps écoulé, elle grandissait sans fin et la carte graphique
       finissait par arrondir les coordonnées, version 221. */
    q.x += (i == 0 ? uDecal.x : i == 1 ? uDecal.y : i == 2 ? uDecal.z : uDecal.w) + e.z * 0.13;
    /* Un relief à peine sensible au défilement, version 218 : le ciel reste
       fixe, seuls les plans proches glissent un peu. */
    q.y += uDefile * mix(0.0, 0.1, prof) / carreau + e.z * 0.071;
    vec4 t = texture2D(uTex[i], q);
    /* Le grain des bords, version 221 : la nappe, lue trois fois plus fine,
       creuse et gonfle les bords autour de sa médiane ; le cœur et le ciel
       nu n'en sont pas touchés, et la part couverte reste la même. */
    float grain = texture2D(uBrume, q * 3.3 + vec2(0.37 * float(i), 0.21)).a;
    float bord = 1.0 - abs(2.0 * t.a - 1.0);
    t.a = clamp(t.a + (grain - 0.87) * 0.9 * bord, 0.0, 1.0);
    /* Le seuil vient de l'étalonnage de la texture : la part de ciel couverte
       est celle qu'annonce la prévision. */
    float dens = smoothstep(c.z - e.y, c.z + e.y, t.a) * c.w * uApparition;
    if (dens < 0.003) continue;
    /* Sous un ciel ouvert, l'ombre des nuages reste claire, éclairée par le
       bleu du ciel ; sous un ciel fermé, elle prend le gris de la couche. */
    vec3 ombreCiel = mix(uSombre, mix(uClair, ciel, 0.45) * 0.86, ouvert * (1.0 - e.x * 0.5));
    vec3 teinte = mix(ombreCiel, uClair + lum * 0.06, clamp(pow(t.r, 0.75) * (1.1 - e.x * 0.4) + 0.06, 0.0, 1.0)) * (0.84 + 0.16 * t.g);
    teinte += lum * (bloom * 0.5 + exp(-d * 4.0) * 0.25) * (1.0 - t.a) * ouvert * (1.0 - uNuit);
    /* Un nuage mince devant le Soleil s'illumine, traversé par la lumière ;
       peint dans sa teinte d'ombre, il faisait un disque gris dans le halo,
       version 222. */
    if (uAstre.z > 0.5 && uNuit < 0.5) teinte = mix(teinte, vec3(1.0, 0.98, 0.95), exp(-d * d * 260.0) * (1.0 - t.a * 0.55) * mix(1.0, 0.35, uDoux));
    teinte += vec3(0.8, 0.84, 1.0) * eclair * exp(-length(p - lueur) * 2.2) * (0.6 + 0.6 * t.a);
    teinte = mix(teinte, ciel, (1.0 - prof) * 0.28);
    acc = vec4(teinte * dens, dens) + acc * (1.0 - dens);
    nuageA = dens + nuageA * (1.0 - dens);
  }

  /* Le brouillard, une nappe laiteuse qui dérive lentement. */
  if (uBrouillard > 0.0) {
    float b = texture2D(uBrume, p * 0.6 + vec2(uT * 0.006, 0.0)).a;
    float fb = uBrouillard * (0.72 + 0.28 * b) * uApparition;
    vec3 lait = mix(uClair, vec3(0.93, 0.94, 0.95), 0.35);
    acc = vec4(lait * fb, fb) + acc * (1.0 - fb);
  }

  /* L'astre sous un ciel ouvert : éblouissement en trois couches, rayons
     fins de longueurs inégales qui naissent hors du cœur et tournent très
     lentement, halo irisé sous un voile mince, reflets d'objectif sur l'axe
     qui va du Soleil au centre de l'écran. Lumière ajoutée, atténuée là où
     un nuage passe devant. */
  if (jour) {
    float ang = atan(p.y - a.y, p.x - a.x) + uT * 0.004;
    float k = ang / 6.2832 * 46.0;
    float id = floor(k);
    float largeur = 0.12 + 0.22 * h21(vec2(id, 5.0));
    float trait = 1.0 - smoothstep(0.0, largeur, abs(fract(k) - 0.5));
    float longueur = 0.05 + 0.2 * h21(vec2(id, 3.0)) * h21(vec2(id, 11.0));
    float rayons = trait * exp(-(d - RC) / longueur) * smoothstep(RC * 1.1, RC * 2.6, d);
    float eclatBloom = exp(-d * d * 160.0) * 0.55 + exp(-d * d * 22.0) * 0.28 + exp(-d * 5.0) * 0.1;
    float doux = mix(1.0, 0.28, uDoux);
    vec3 eclat = lum * (eclatBloom + rayons * 0.16) * ouvert * (1.0 - nuageA * 0.7) * doux;
    /* La lueur blanche du cœur traverse un nuage mince. */
    eclat += vec3(1.0, 0.98, 0.94) * exp(-d * d * 450.0) * 0.6 * (1.0 - nuageA * 0.55) * doux * ouvert;
    /* Le cœur brille par lui-même, plus fort que son halo : sous le voile de
       lecture, il paraissait gris au milieu d'un anneau clair. */
    eclat += vec3(1.0, 0.99, 0.96) * smoothstep(RC * 1.1, RC * 0.6, d) * (1.0 - nuageA * 0.5) * doux;
    if (uHalo > 0.0) {
      float x = (d - 0.34) / 0.028;
      vec3 iris = clamp(vec3(x + 0.6, 1.0 - abs(x) * 1.2, 0.6 - x), 0.0, 1.0);
      eclat += iris * exp(-x * x * 0.9) * 0.09 * uHalo * ouvert;
    }
    vec2 axe = centre - a;
    for (int k = 0; k < 4; k++) {
      float tk = k == 0 ? 0.55 : k == 1 ? 1.1 : k == 2 ? 1.45 : 1.9;
      float rr = k == 0 ? 0.035 : k == 1 ? 0.06 : k == 2 ? 0.025 : 0.08;
      float dg = length(p - (a + axe * tk));
      float anneau = smoothstep(rr, rr * 0.7, dg) * 0.6 + smoothstep(rr * 1.05, rr, dg) * smoothstep(rr * 0.85, rr, dg) * 0.8;
      eclat += vec3(0.75, 0.85, 1.0) * anneau * 0.035 * ouvert * ouvert * doux;
    }
    acc.rgb += eclat;
  }

  /* La pluie en traits obliques sur deux plans, la neige en flocons. */
  if (uPluie > 0.0) {
    float dens = clamp(uPluie / 6.0, 0.18, 0.75);
    for (int k = 0; k < 2; k++) {
      float ech = k == 0 ? 120.0 : 70.0;
      vec2 r = (gl_FragCoord.xy + float(k) * 37.0) / uRes.y * ech; r.x += r.y * 0.18;
      float hh = h21(vec2(floor(r.x), 7.0 + float(k)));
      float y = fract(r.y * 0.09 + uT * (k == 0 ? 1.3 : 1.9) * (0.8 + 0.4 * hh) + hh * 13.0);
      float trait = smoothstep(0.0, 0.015, y) * smoothstep(0.11, 0.0, y) * (1.0 - smoothstep(0.0, 0.16, abs(fract(r.x) - 0.5)));
      float ap = trait * step(hh, dens) * (k == 0 ? 0.25 : 0.4);
      acc = vec4(vec3(0.86, 0.9, 0.96) * ap, ap) + acc * (1.0 - ap);
    }
  }
  if (uNeige > 0.0) {
    for (int k = 0; k < 2; k++) {
      float ech = k == 0 ? 26.0 : 15.0;
      vec2 r = gl_FragCoord.xy / uRes.y * ech;
      r.y += uT * (k == 0 ? 0.9 : 1.5);
      r.x += sin(r.y * 0.7 + uT * 0.8 + float(k)) * 0.35;
      vec2 cel = floor(r); vec2 f = fract(r) - 0.5;
      vec2 o = vec2(h21(cel), h21(cel + 5.3)) - 0.5;
      float fl = smoothstep(k == 0 ? 0.09 : 0.13, 0.0, length(f - o * 0.6)) * step(h21(cel + 9.1), clamp(uNeige / 4.0, 0.25, 0.8));
      float ap = fl * (k == 0 ? 0.55 : 0.85);
      acc = vec4(vec3(0.97) * ap, ap) + acc * (1.0 - ap);
    }
  }
  acc.rgb += vec3(0.75, 0.8, 0.95) * eclair * 0.12;
  gl_FragColor = acc;
}`;

/* Les textures se chargent une fois pour toutes les toiles. */
const images = {};
const chargement = Promise.all(TEXTURES.map(n => new Promise(ok => {
  if (typeof Image !== "function") { ok(); return; }
  const im = new Image();
  im.onload = () => { images[n] = im; ok(); };
  im.onerror = () => ok();
  im.src = new URL(`../donnees/nuages/${n}.webp`, import.meta.url).href;
})));

/* Les contrôles gardent le dessin sur toile, sauf la section qui éprouve ce
   ciel-ci : `__cielSimple` est posé par le banc d'essai. */
const simple = () => globalThis.__cielSimple === true && globalThis.__cielGL !== true;

/* Les trois étages de l'heure en cours glissent vers ceux de l'heure
   suivante au fil des minutes, version 218 : bas, moyens, hauts, de zéro à
   un. Rend null quand la prévision ne les porte pas. */
export function etagesA(brut, f) {
  if (!Array.isArray(brut) || brut.length !== 6 || brut.some(v => !Number.isFinite(v))) return null;
  const k = Math.max(0, Math.min(1, f));
  const v = i => (brut[i] + (brut[i + 1] - brut[i]) * k) / 100;
  return { b: v(0), m: v(2), h: v(4) };
}

/* Le seuil d'opacité qui couvre la part c de la texture, d'après son
   étalonnage. Au delà de ce que la texture couvre, le seuil passe sous zéro
   et le plan se ferme peu à peu en nappe. Rend aussi la largeur du bord :
   étroite près de zéro, pour qu'un seuil bas ne voile pas tout le ciel. */
export function seuil(tex, c) {
  const Q = QUANTILES[tex];
  const x = Math.max(0, Math.min(1, 1 - c)) * 32;
  if (!Q) return { s: 1 - c, l: 0.06 };
  const k = Math.min(31, Math.floor(x));
  const v = Q[k] + (Q[k + 1] - Q[k]) * (x - k);
  if (v > 0.015) return { s: v, l: Math.min(0.06, v * 0.8) };
  const vide = Math.max(1, Q.findIndex(q => q > 0.015)) / 32;
  const manque = Math.max(0, Math.min(1, (vide - (1 - c)) / vide));
  return { s: 0.015 - manque * 0.14, l: 0.06 };
}

/* La couverture de chacun de deux plans qui, superposés, couvrent c. */
const moitie = c => 1 - Math.sqrt(1 - Math.max(0, Math.min(1, c)));

/* Les plans d'un ciel, du lointain au proche, quatre au plus. Avec les trois
   étages de la prévision, chaque plan suit le sien : les hauts en cirrus, ou
   en voile de cirrostratus au delà de ce que couvrent les fibres ; les moyens
   en altocumulus, ou en nappe ; les bas en deux plans de cumulus, de cumulus
   denses ou de stratus selon la couverture, et en lambeaux sous la pluie.
   Sans les étages, la couverture totale va aux nuages bas. La variante, tirée
   de la graine, change le mélange des nuages bas d'un tirage à l'autre. */
export function plansDe(d, graine) {
  const v = ((graine % 3) + 3) % 3;
  const E = d.etages || { b: Number.isFinite(d.couv) ? d.couv : Math.max(d.cumulus, d.nappe), m: 0, h: 0 };
  const pluie = d.lame > 0 || d.orage;
  const ombre = Math.min(0.9, 0.3 + E.b * 0.25 + (pluie ? 0.3 : 0) + (d.orage ? 0.2 : 0));
  const plans = [];
  const plan = (tex, prof, couv, op, om) => {
    if (couv < 0.02) return;
    const t = seuil(tex, couv);
    plans.push({ tex, prof, couv, seuil: t.s, bord: t.l, op, ombre: om });
  };
  if (E.h >= 0.02) {
    if (E.h <= 0.18) plan("cirrus", 0, E.h, 0.45, 0);
    else plan("stratus", 0, E.h, 0.32, 0);
  }
  if (E.m >= 0.02) plan(E.m <= 0.7 ? "alto" : "stratus", 0.3, E.m, 0.95, ombre * 0.8);
  if (E.b >= 0.02) {
    const c = moitie(E.b);
    const sorte = cb => (cb > 0.85 ? "stratus" : cb > 0.42 ? "dense" : "cumulus");
    const loin = E.b > 0.85 ? "stratus" : sorte(c);
    plan(loin, 0.6, c, 1, ombre);
    if (pluie) plan("fractus", 0.95, Math.min(0.55, c), 0.92, Math.min(0.95, ombre + 0.1));
    else plan(v === 1 && c > 0.1 ? "dense" : sorte(c), 0.92, c, 1, ombre);
  }
  return plans.slice(-4);
}

/* La dérive d'un plan, en carreaux par seconde, version 221 : un plan proche
   traverse l'écran en une minute environ par vent faible, un plan lointain
   en plusieurs minutes. Dix fois plus lent qu'en version 216, où les nuages
   proches passaient en cinq secondes. */
export const vitesse = (vent, prof) => (0.002 + vent * 0.0003) * (0.3 + 1.3 * prof);
/* La dérive d'un plan au temps t, en carreaux, ramenée entre zéro et un. */
export const decalage = (t, vent, prof) => (t * vitesse(vent, prof)) % 1;

/* Le peintre d'une toile, ou null quand WebGL manque. */
export function peintre(cv) {
  if (simple()) return null;
  let g = null;
  try { g = cv.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: "low-power" }); } catch { g = null; }
  if (!g) return null;

  const compiler = (type, src) => {
    const s = g.createShader(type); g.shaderSource(s, src); g.compileShader(s);
    if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(s) || "programme du ciel");
    return s;
  };
  let prog, U = {}, tex = {}, pret = false, perdu = false;
  let etat = null, plansPoses = [], echelle = 1, somme = 0, nb = 0, apparition = 0, avant = null;

  function monter() {
    prog = g.createProgram();
    g.attachShader(prog, compiler(g.VERTEX_SHADER, VS));
    g.attachShader(prog, compiler(g.FRAGMENT_SHADER, FS));
    g.linkProgram(prog); g.useProgram(prog);
    g.bindBuffer(g.ARRAY_BUFFER, g.createBuffer());
    g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW);
    const loc = g.getAttribLocation(prog, "a");
    g.enableVertexAttribArray(loc); g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
    U = {};
    for (const n of ["uRes", "uT", "uDefile", "uApparition", "uHaut", "uBas", "uClair", "uSombre", "uAstre", "uNuit", "uChaud",
      "uPluie", "uNeige", "uVent", "uOrage", "uN", "uHalo", "uMiroir", "uBrouillard", "uVoile", "uDoux", "uDecal", "uC", "uD", "uBrume"]) {
      U[n] = g.getUniformLocation(prog, n);
    }
    g.uniform1iv(g.getUniformLocation(prog, "uTex"), [0, 1, 2, 3]);
    g.uniform1i(U.uBrume, 4);
    g.enable(g.BLEND); g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
    tex = {};
    chargement.then(() => {
      if (perdu) return;
      for (const n of TEXTURES) {
        if (!images[n]) continue;
        const t = g.createTexture(); g.bindTexture(g.TEXTURE_2D, t);
        g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, images[n]);
        g.generateMipmap(g.TEXTURE_2D);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR_MIPMAP_LINEAR);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.REPEAT);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.REPEAT);
        tex[n] = t;
      }
      pret = true;
      if (etat) poserUniformes();
      objet.surPret?.();
    });
  }

  /* Une perte du contexte, fréquente quand le téléphone reprend la carte
     graphique, se répare au retour : programme et textures sont refaits. */
  cv.addEventListener("webglcontextlost", e => { e.preventDefault(); perdu = true; pret = false; });
  cv.addEventListener("webglcontextrestored", () => { perdu = false; monter(); });

  const taille = () => {
    const L = cv.clientWidth, H = cv.clientHeight;
    if (!L || !H) return false;
    const k = Math.min(2, window.devicePixelRatio || 1) * echelle;
    const w = Math.round(L * k), h = Math.round(H * k);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    g.viewport(0, 0, cv.width, cv.height);
    return true;
  };

  function poserUniformes() {
    const e = etat, rvb = v => v.map(x => x / 255);
    g.useProgram(prog);
    g.uniform3fv(U.uHaut, rvb(e.ciel.hautRVB)); g.uniform3fv(U.uBas, rvb(e.ciel.basRVB));
    g.uniform3fv(U.uClair, rvb(e.teinte.clair)); g.uniform3fv(U.uSombre, rvb(e.teinte.sombre));
    const astre = e.astre || { sorte: "lune", x: 0.5, y: -1 };
    g.uniform3f(U.uAstre, astre.x, astre.y, astre.sorte === "soleil" ? 1 : 0);
    g.uniform1f(U.uMiroir, astre.x > 0.5 ? -1 : 1);
    g.uniform1f(U.uNuit, e.ciel.nuit); g.uniform1f(U.uChaud, e.ciel.chaud);
    g.uniform1f(U.uPluie, e.genre === "pluie" ? e.lame : 0);
    g.uniform1f(U.uNeige, e.genre === "neige" ? e.lame : 0);
    g.uniform1f(U.uVent, e.vent); g.uniform1f(U.uOrage, e.orage ? 1 : 0);
    g.uniform1f(U.uBrouillard, Math.min(0.85, e.brouillard));
    g.uniform1f(U.uVoile, e.voile);
    g.uniform1f(U.uDoux, e.derriere ? 1 : 0);
    const plans = plansDe(e, e.graine);
    plansPoses = plans;
    g.uniform1f(U.uHalo, plans.some(p => p.tex === "cirrus" || (p.tex === "stratus" && p.prof === 0)) && plans.every(p => p.prof === 0 || p.couv < 0.3) ? 0.7 : 0);
    const C = new Float32Array(16), D = new Float32Array(16);
    plans.forEach((p, i) => {
      C.set([SORTE[p.tex], p.prof, p.seuil, p.op], i * 4);
      /* Le décalage du tirage reste petit : ajouté tel quel, un nombre de
         l'ordre de cent mille dépassait la précision de la carte graphique,
         et les nuages sortaient en pavés. */
      D.set([p.ombre, p.bord, ((e.graine * 0.618034) % 1) * 7 + i * 3.7, 0], i * 4);
    });
    g.uniform4fv(U.uC, C); g.uniform4fv(U.uD, D); g.uniform1f(U.uN, plans.length);
    plans.forEach((p, i) => { g.activeTexture(g.TEXTURE0 + i); g.bindTexture(g.TEXTURE_2D, tex[p.tex] || null); });
    g.activeTexture(g.TEXTURE4); g.bindTexture(g.TEXTURE_2D, tex.stratus || null);
  }

  monter();

  const objet = {
    gl: true,
    surPret: null,
    /* L'état lu sur la toile ; les uniformes ne changent que s'il change. */
    poser(e) {
      etat = e;
      if (pret) poserUniformes();
    },
    peindre(t, ms) {
      if (perdu || !prog || !taille()) return;
      /* La taille de rendu s'adapte : au-delà de vingt millisecondes par
         image en moyenne, la toile se réduit, jusqu'à moitié de la taille
         affichée ; les nuages sont flous par nature. */
      if (ms !== undefined) {
        if (avant !== null) {
          somme += ms - avant; nb++;
          if (nb === 60) {
            if (somme / nb > 20 && echelle > 0.5) { echelle = Math.max(0.5, echelle - 0.08); taille(); }
            somme = 0; nb = 0;
          }
        }
        avant = ms;
      }
      /* Les nuages paraissent en fondu une fois les textures chargées : un
         ciel couvert ne passe pas par un ciel nu. */
      apparition = pret ? Math.min(1, apparition + 0.08) : 0;
      g.useProgram(prog);
      g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT);
      g.uniform2f(U.uRes, cv.width, cv.height);
      /* Le temps du programme reste petit, ramené sur dix minutes : la pluie
         et les éclairs n'en gardent pas la trace. La dérive des plans se
         calcule ici, en double précision. */
      g.uniform1f(U.uT, t % 600);
      g.uniform4fv(U.uDecal, [0, 1, 2, 3].map(i => {
        const p = plansPoses[i];
        return p ? decalage(t, etat?.vent || 0, p.prof) : 0;
      }));
      g.uniform1f(U.uDefile, (window.scrollY || 0) / Math.max(1, window.innerHeight));
      g.uniform1f(U.uApparition, ms === undefined ? (pret ? 1 : 0) : apparition);
      g.drawArrays(g.TRIANGLES, 0, 3);
    },
  };
  return objet;
}
