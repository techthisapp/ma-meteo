/* La suite des contrôles. Chaque section vit dans son fichier sous
   essais/sections/, numéroté dans l'ordre de passage, et part d'un état neuf
   que prépare essais/banc.mjs. Les sections passent côte à côte, trois à la
   fois par défaut ; leurs comptes rendus s'écrivent dans l'ordre des fichiers.

   Variables d'environnement :
   - SECTIONS : motifs séparés par des virgules ; seules passent les sections
     dont le titre ou le nom de fichier contient l'un d'eux, sans égard à la
     casse ni aux accents ;
   - JUSQUA : la passe s'arrête après la section nommée ;
   - PARALLELE : le nombre de sections qui passent côte à côte, trois par défaut.
     Mesure du 2 octobre 2026 sur le Mac : 337 secondes à deux, 183 à trois,
     138 à quatre, la plus longue section en prenant 86 ;
   - CHRONO=1 : le temps de chaque section, à la fin de la passe. */
import fs from "node:fs";
import path from "node:path";
import { sortantes, fermer, mesure, preparer, ICI } from "./banc.mjs";

const sansAccent = t => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const DOSSIER = path.join(ICI, "sections");
const fichiers = fs.readdirSync(DOSSIER).filter(f => /^\d\d-.+\.mjs$/.test(f)).sort();
let sections = [];
for (const f of fichiers) sections.push({ fichier: f, ...(await import(path.join(DOSSIER, f))) });

const SECTIONS = (process.env.SECTIONS || "").split(",").map(x => sansAccent(x.trim())).filter(Boolean);
const JUSQUA = sansAccent((process.env.JUSQUA || "").trim());
if (SECTIONS.length) {
  sections = sections.filter(s => SECTIONS.some(m => sansAccent(s.titre).includes(m) || s.fichier.includes(m)));
}
if (JUSQUA) {
  const k = sections.findIndex(s => sansAccent(s.titre).includes(JUSQUA));
  if (k >= 0) sections = sections.slice(0, k + 1);
}
const PARALLELE = Math.max(1, Number(process.env.PARALLELE) || 3);
const CHRONO = process.env.CHRONO === "1";

/* Les sections passent dans l'ordre, PARALLELE à la fois. Un compte rendu ne
   s'écrit que lorsque ceux des sections qui le précèdent sont écrits. */
const resultats = new Array(sections.length);
let suivante = 0, ecrite = 0;
const ecrire = () => {
  while (ecrite < sections.length && resultats[ecrite]) {
    const r = resultats[ecrite];
    console.log(`\n--- ${sections[ecrite].titre} ---`);
    for (const l of r.lignes) console.log(l);
    ecrite++;
  }
};
const passer = async s => {
  const t0 = Date.now();
  const T = await preparer(s.titre, s.avecPage);
  try {
    await s.default(T);
  } catch (e) {
    /* Une section interrompue le dit : les contrôles qui la suivaient manquent
       au compte, et ce contrôle échoue à leur place. */
    T.ok(`la section « ${s.titre} » va jusqu'au bout`, false,
      String(e && e.stack || e).split("\n").slice(0, 4).join(" ~ "));
  }
  return { ...(await T.finir()), ms: Date.now() - t0 };
};
const ouvrier = async () => {
  while (suivante < sections.length) {
    const k = suivante++;
    resultats[k] = await passer(sections[k]);
    ecrire();
  }
};
await Promise.all(Array.from({ length: Math.min(PARALLELE, sections.length) }, ouvrier));

let n = 0, ko = 0;
const erreurs = [];
for (const r of resultats) { n += r.n; ko += r.ko; erreurs.push(...r.erreurs); }
const ok = (nom, cond, detail) => {
  n++; if (!cond) { ko++; console.log(`  ÉCHEC  ${nom}${detail ? " | " + detail : ""}`); }
  else console.log(`  ok     ${nom}`);
};
console.log("\n--- Fin de la passe ---");
/* Les erreurs relevées sur la page principale de chaque section. */
ok("aucune erreur de page", erreurs.length === 0, erreurs.slice(0, 3).join(" ~ "));
/* Le filet du réseau se juge à la fin de toute passe, entière ou écourtée. */
ok("aucune requête ne sort vers le vrai réseau", !sortantes.length, [...new Set(sortantes)].join(" "));

if (mesure.repliesOuverture) {
  console.log(`\n${mesure.repliesOuverture} ouverture(s) de page repliées sur le chargement du document,`
    + " le réseau n'étant pas revenu au repos dans les quinze secondes.");
}
if (CHRONO) {
  console.log("\n--- Temps par section ---");
  const tries = resultats.map((r, k) => [sections[k].titre, r.ms]).sort((x, y) => y[1] - x[1]);
  for (const [nom, ms] of tries.slice(0, 18)) console.log(`  ${(ms / 1000).toFixed(1).padStart(6)} s  ${nom}`);
  console.log(`  total des sections ${(tries.reduce((t, x) => t + x[1], 0) / 1000).toFixed(1)} s,`
    + ` ${PARALLELE} à la fois`);
  console.log(`  dont ${(mesure.coutOuvertures / 1000).toFixed(1)} s pour ${mesure.nbOuvertures} ouvertures`
    + ` de page, soit ${(mesure.coutOuvertures / Math.max(1, mesure.nbOuvertures) / 1000).toFixed(2)} s chacune`
    + `, ${mesure.repliesOuverture} en repli`);
  console.log(`  ${mesure.repos} attentes du repos d'une page, ${(mesure.coutRepos / 1000).toFixed(1)} s,`
    + ` dont ${mesure.reposPlafond} au plafond`);
}
console.log(`\n${n - ko} contrôles sur ${n}${ko ? `, ${ko} en échec` : ", tous vérifiés"}.`);
if (SECTIONS.length || JUSQUA) {
  console.log(`Passe partielle : ${sections.length} section(s) sur ${fichiers.length}.`);
}
fermer();
process.exit(ko ? 1 : 0);
