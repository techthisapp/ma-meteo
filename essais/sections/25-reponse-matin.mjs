/* La réponse du matin. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */

export const titre = "La réponse du matin";
export const avecPage = true;

export default async T => {
  const { pg, ok, txt } = T;
  /* Une phrase qui tranche ce qu'il y a à faire, posée dans le ciel. Elle donne
     une instruction là où les conseils donnent un fait, et c'est ce qui la
     distingue du bloc qui la suit. */
  ok("l'encart porte une instruction et non un fait",
    /^(Manteau|Veste|Pull|Manches|Tenue|Aérer)/.test((await txt(".pt-rep")).trim()),
    await txt(".pt-rep"));
  /* Sans pluie, elle n'a qu'une ligne : le silence par défaut vaut ligne par
     ligne, et non pour l'encart entier. */
  ok("sans objet à prendre, elle n'a qu'une ligne",
    await pg.locator(".pt-rep .pt-l").count() === 1,
    String(await pg.locator(".pt-rep .pt-l").count()));
  /* Elle traverse la largeur au-dessus de la ligne de date. En dessous, elle
     rencontrerait le grand chiffre et les bornes du jour. */
  ok("elle est posée au-dessus de la ligne de date et du grand chiffre",
    await pg.evaluate(() => {
      const r = document.querySelector(".pt-rep")?.getBoundingClientRect();
      const jour = document.querySelector(".plein-titre > i")?.getBoundingClientRect();
      const deg = document.querySelector(".bd-deg")?.getBoundingClientRect();
      const ciel = document.querySelector(".ci")?.getBoundingClientRect();
      if (!r || !jour || !deg || !ciel) return "un élément manque";
      if (r.bottom > jour.top + 0.5) return "l'encart déborde sur la ligne de date";
      if (r.bottom > deg.top + 0.5) return "l'encart déborde sur le grand chiffre";
      if (r.top < ciel.top || r.bottom > ciel.bottom) return "l'encart sort du ciel";
      if (r.width < ciel.width * 0.7) return "l'encart ne traverse pas la largeur";
      return "";
    }) === "", await pg.evaluate(() => {
      const r = document.querySelector(".pt-rep")?.getBoundingClientRect();
      return r ? `${Math.round(r.width)} sur ${Math.round(r.height)}` : "absent";
    }));
  /* Chaque ligne est une cible propre : l'objet mène au rappel d'agenda, la tenue
     au réglage du ressenti. Une seule cible pour les deux enverrait l'un des deux
     appuis au mauvais endroit. */
  ok("chaque ligne de l'encart ouvre la feuille qui la concerne",
    await pg.evaluate(() => {
      const l = [...document.querySelectorAll(".pt-rep .pt-l")];
      if (!l.length) return "aucune ligne";
      const f = l.map(x => x.dataset.feuille);
      return f.every(x => x === "parapluie" || x === "ressenti") && new Set(f).size === f.length
        ? "" : f.join(",");
    }) === "");
};
