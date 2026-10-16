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
  /* Depuis la version 210, accueil en plein ciel, demande de Jérôme : elle
     se pose sous les bornes du jour, centrée, sans encadré, comme sur la
     maquette. */
  ok("elle est posée sous les bornes du jour, centrée, sans encadré",
    await pg.evaluate(() => {
      const r = document.querySelector(".pt-rep")?.getBoundingClientRect();
      const bornes = document.querySelector(".plein-titre .bd-bornes")?.getBoundingClientRect();
      if (!r || !bornes) return "un élément manque";
      if (r.top < bornes.bottom - 0.5) return "l'encart passe au-dessus des bornes";
      const milieu = (r.left + r.right) / 2;
      if (Math.abs(milieu - innerWidth / 2) > 4) return "l'encart n'est pas centré";
      const st = getComputedStyle(document.querySelector(".pt-rep"));
      if (st.backgroundColor !== "rgba(0, 0, 0, 0)" || (st.backdropFilter || st.webkitBackdropFilter || "none") !== "none") return "l'encart garde sa matière";
      return "";
    }) === "", await pg.evaluate(() => {
      const r = document.querySelector(".pt-rep")?.getBoundingClientRect();
      return r ? `${Math.round(r.width)} sur ${Math.round(r.height)} à ${Math.round(r.top)}` : "absent";
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
