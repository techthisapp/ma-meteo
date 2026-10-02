/* Le fond enrichi de la carte : relief, cours d'eau, villes. Section écrite le
   3 octobre 2026 pour le jalon 19, lot 2 ; elle part d'un état neuf préparé
   par essais/banc.mjs. */

export const titre = "Le fond de la carte";
export const avecPage = true;

export default async T => {
  const { pg, ok, onglet, reposer, RACINE_HTTP } = T;
  await onglet("carte");
  await reposer(pg, 2000);

  /* Les données embarquées : le relief, des cours d'eau entiers, les villes.
     La Saône se compte en points : la première source essayée ne donnait que
     des fragments de quelques points. */
  const donnees = await pg.evaluate(async () => {
    const F = await import("/src/fond.js");
    const r = await F.charger();
    const v = F.villesChargees() || [], rv = F.rivieresChargees() || [];
    return { ...r, villes: ["Paris", "Dijon", "Montbard"].filter(n => !v.some(x => x.nom === n)),
      riv: ["Seine", "Saône", "Armançon", "Brenne"].filter(n => !rv.some(x => x.nom === n)),
      saone: Math.max(0, ...rv.filter(x => x.nom === "Saône").map(x => x.traces.reduce((a, t) => a + t.length / 2, 0))) };
  });
  ok("le fond embarqué porte le relief, des cours d'eau entiers et les villes",
    donnees.relief && donnees.rivieres > 2000 && donnees.villes.length === 0 && donnees.riv.length === 0
    && donnees.saone > 150, JSON.stringify(donnees));

  /* Un point hors de toute commune se nomme par la ville proche : au large
     d'Arcachon, Arcachon ou La Teste-de-Buch ; au milieu de l'Atlantique,
     rien. */
  const proche = await pg.evaluate(async () => {
    const F = await import("/src/fond.js");
    return { large: F.villeProche(44.66, -1.3)?.nom || null, ocean: F.villeProche(45.5, -8) };
  });
  ok("un point hors de toute commune se nomme par la ville proche, et rien au large",
    /Arcachon|La Teste|Gujan|Lège/.test(proche.large || "") && proche.ocean === null, JSON.stringify(proche));

  /* Les fichiers du fond sont dans la coque : sans eux, la carte hors
     connexion perdrait son fond. */
  const sw = await (await fetch(`${RACINE_HTTP}sw.js`)).text();
  const manque = await pg.evaluate(async sw => {
    const F = await import("/src/fond.js");
    return [...F.FICHIERS, "./src/fond.js"].filter(f => !sw.includes(`"${f}"`));
  }, sw);
  ok("les fichiers du fond sont gardés dans la coque hors ligne", manque.length === 0, manque.join(" "));

  /* Les noms : sur le pays entier, seulement des grandes villes ; aucun nom
     n'en chevauche un autre, ni un repère, ni une commande. */
  const noms = async () => pg.evaluate(async () => {
    const F = await import("/src/fond.js");
    const { poses, pris } = F.derniersNoms();
    const v = F.villesChargees() || [];
    const pop = n => v.find(x => x.nom === n)?.pop || 0;
    const croise = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
    let heurts = 0;
    poses.forEach((p, k) => {
      for (let j = k + 1; j < poses.length; j++) if (croise(p.b, poses[j].b)) heurts++;
      for (const q of pris) if (croise(p.b, q)) heurts++;
    });
    return { villes: poses.filter(p => p.type === "ville").map(p => [p.nom, pop(p.nom)]),
      rivieres: poses.filter(p => p.type === "riviere").map(p => p.nom), heurts, pris: pris.length };
  });
  const pays = await noms();
  ok("sur le pays entier, seules les grandes villes sont nommées, sans chevauchement",
    pays.villes.some(([n]) => n === "Paris") && pays.villes.length >= 5
    && pays.villes.every(([, p]) => p >= 100000) && pays.heurts === 0 && pays.pris >= 2,
    JSON.stringify(pays));

  /* Au plus près de Fain : les rivières du coin et les petites villes. */
  await pg.locator("#caIci").click();
  await pg.locator("#caToile").press("+");
  await pg.locator("#caToile").press("+");
  await reposer(pg, 1500);
  const pres = await noms();
  ok("au plus près, les rivières du coin et les petites villes portent leur nom, sans chevauchement",
    pres.rivieres.some(n => n === "Armançon" || n === "Brenne") && pres.villes.some(([n]) => n === "Montbard")
    && pres.heurts === 0, JSON.stringify(pres));

  /* Le relief : la même vue dessinée avec et sans relief, sur une toile à
     part. Dans les Alpes, le relief change la clarté de chaque point ; dans
     la Beauce, presque rien. */
  const relief = await pg.evaluate(async () => {
    const C = await import("/src/carte.js");
    const cadre = document.querySelector(".ca-cadre");
    const vue = { lat: 46.4, lon: 3.5, z: 6.4 };
    const image = force => {
      const cv = document.createElement("canvas");
      cv.style.cssText = `position:absolute;left:0;top:0;width:390px;height:600px;visibility:hidden;--ca-relief:${force}`;
      cadre.appendChild(cv);
      C.dessiner(cv, vue, []);
      const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height);
      cv.remove();
      return d;
    };
    const avec = image(2), sans = image(0);
    const ecart = (la, lo) => {
      const p = C.surEcran(vue, la, lo, 390, 600);
      let t = 0, n = 0;
      for (let y = Math.round(p.y * 2) - 30; y < Math.round(p.y * 2) + 30; y++) {
        for (let x = Math.round(p.x * 2) - 30; x < Math.round(p.x * 2) + 30; x++) {
          const i = (y * avec.width + x) * 4;
          t += Math.abs(avec.data[i] - sans.data[i]) + Math.abs(avec.data[i + 1] - sans.data[i + 1]);
          n += 2;
        }
      }
      return Math.round(t / n * 10) / 10;
    };
    return { alpes: ecart(45.1, 6.6), beauce: ecart(48.25, 1.55) };
  });
  ok("le relief se voit dans les montagnes et pas en plaine",
    relief.alpes > 4 && relief.alpes > relief.beauce * 3, JSON.stringify(relief));
};
