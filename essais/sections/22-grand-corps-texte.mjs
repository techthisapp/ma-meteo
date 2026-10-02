/* Grand corps de texte. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */

export const titre = "Grand corps de texte";
export const avecPage = true;

export default async T => {
  const { pg, ok, onglet, ouvrirEcran } = T;
  await pg.addStyleTag({ content: ":root{font-size:22px}" });
  for (const cle of ["accueil", "temps", "semaine", "soleil", "lune", "carte"]) {
    await ouvrirEcran(cle);
    /* Deux fautes se cherchent ici : un contenu qui sort de sa rangée, et une
       rangée dont le contenu vient toucher le bord de sa carte. La seconde ne
       déborde pas au sens strict, mais la valeur se colle au bord et la coupure
       paraît la même à la lecture. */
    const deborde = await pg.evaluate(() => {
      const fautifs = [];
      for (const r of document.querySelectorAll("#ecran .rangee, #ecran .bd-m, #ecran .tm > div")) {
        const b = r.getBoundingClientRect();
        const carte = r.closest(".carte, .groupe");
        const c = carte ? carte.getBoundingClientRect() : b;
        for (const e of r.children) {
          const z = e.getBoundingClientRect();
          if (!z.width) continue;
          // Sur un SVG, `className` n'est pas une chaîne : le nom de balise suffit.
          const nom = typeof e.className === "string" && e.className
            ? e.className : e.tagName.toLowerCase();
          if (z.right > b.right + 1 || z.left < b.left - 1) fautifs.push(`hors rangée : ${nom}`);
          else if (z.right > c.right - 8 || z.left < c.left + 8) fautifs.push(`collé au bord : ${nom}`);
        }
      }
      return [...new Set(fautifs)].slice(0, 4);
    });
    ok(`aucune valeur ne touche le bord sur ${cle}`, deborde.length === 0, deborde.join(" | "));

    /* Le titre porté par le ciel doit y tenir : à grand corps de texte, un
       chiffre de plusieurs centimètres à côté d'un libellé long débordait du
       panneau par le bas, et passait sous la grille des mesures. */
    const sort = await pg.evaluate(() => {
      const t = document.querySelector("#ecran .plein-titre");
      const ci = document.querySelector("#ecran .ci");
      if (!t || !ci) return null;
      const a = t.getBoundingClientRect(), b = ci.getBoundingClientRect();
      if (a.bottom > b.bottom + 1) return `dépasse de ${Math.round(a.bottom - b.bottom)}px par le bas`;
      if (a.top < b.top - 1) return "dépasse par le haut";
      if (a.right > b.right + 1 || a.left < b.left - 1) return "dépasse sur les côtés";
      return null;
    });
    ok(`le titre du ciel tient dans le panneau sur ${cle}`, sort === null, sort);
  }
  await pg.evaluate(() => {
    for (const s of document.querySelectorAll("style")) {
      if (s.textContent.includes("font-size:22px")) s.remove();
    }
  });
  await onglet("accueil");
};
