/* La coque hors ligne. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */
import fs from "node:fs";
import path from "node:path";

export const titre = "La coque hors ligne";
export const avecPage = false;

export default async T => {
  const { ok, ICI } = T;
  /* L'agent de service met en cache une liste de fichiers écrite à la main. Un
     module nouveau qui n'y figure pas ne se voit pas : l'application marche tant
     qu'il y a du réseau, et tombe hors ligne, où rien ne dit pourquoi. La liste
     se compare donc à ce que l'application importe réellement, en suivant les
     `import` depuis son point d'entrée. */
  {
    const lu = f => fs.readFileSync(path.join(ICI, "..", f), "utf8");
    const coque = new Set([...lu("sw.js").matchAll(/"\.\/([^"]+)"/g)].map(m => m[1]));
    const vus = new Set();
    const suivre = f => {
      if (vus.has(f)) return;
      vus.add(f);
      /* Les imports dynamiques comptent aussi : les listes des plages et des
         stations se chargent à la demande depuis la version 128, et doivent
         rester dans la coque pour servir hors connexion. */
      /* Les chemins se lisent depuis le dossier du fichier : depuis le
         2 octobre 2026, les écrans vivent sous src/vues/ et importent
         « ../previsions.js » comme « ./communs.js ». */
      for (const m of lu(f).matchAll(/(?:from\s+|import\(\s*)"(\.\.?\/[^"]+\.js)"/g)) {
        suivre(path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1])));
      }
    };
    suivre("src/app.js");
    const manquants = [...vus].filter(f => !coque.has(f));
    ok("la coque hors ligne porte tous les modules importés",
      manquants.length === 0, manquants.join(", ") || `${vus.size} modules`);
    /* L'inverse vaut aussi : un module retiré de l'application et laissé dans la
       liste ferait échouer l'installation entière de l'agent de service, `addAll`
       étant tout ou rien. */
    const morts = [...coque].filter(f => f.startsWith("src/") && !vus.has(f));
    ok("elle ne porte aucun module que l'application n'importe plus",
      morts.length === 0, morts.join(", "));

    /* La reprise du temps sensible et la table des seuils portent sur les mêmes
       règles : la lame retenue, le risque écrit, la couverture du ciel couvert.
       Le défaut de bruine du 10 septembre venait d'un chiffre écrit deux fois qui
       avait cessé de dire la même chose des deux côtés. La table les reprend
       donc de `previsions.js` au lieu de les réécrire, et cette garde le tient :
       un nombre en dur à l'une de ces trois entrées la fait tomber. */
    const sc = lu("src/conseils.js");
    const durs = ["lame", "risque", "couvert"]
      .filter(k => new RegExp(`^\\s*${k}:\\s*[0-9]`, "m").test(sc));
    ok("les seuils que la reprise du ciel partage ne sont écrits qu'une fois",
      durs.length === 0, durs.join(", ") || "lame, risque, couvert repris");
  }
};
