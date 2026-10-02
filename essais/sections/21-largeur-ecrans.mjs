/* Largeur des écrans. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */

export const titre = "Largeur des écrans";
export const avecPage = true;

export default async T => {
  const { pg, ok, onglet, ouvrirEcran, ecranCiel } = T;
  for (const cle of ["accueil", "temps", "semaine", "soleil", "lune", "carte"]) {
    await ouvrirEcran(cle);
    /* Le débord se mesure sur la couche de contenu, non sur le document : le
       document est écrêté par `overflow-x:hidden`, ce qui masque la faute au
       lieu de la corriger. Un bloc qui sort de la fenêtre coupe la colonne des
       valeurs sur téléphone, et c'est lui qu'on cherche. */
    const trop = await pg.evaluate(() => {
      const ecran = document.getElementById("ecran");
      const debord = ecran.scrollWidth - ecran.clientWidth;
      const large = window.innerWidth;
      const coupables = [...ecran.querySelectorAll(".carte, .section, .plein, .bandeau, .groupe")]
        .filter(e => {
          const b = e.getBoundingClientRect();
          return b.width > 0 && (b.right > large + 1 || b.left < -1);
        })
        .map(e => e.className).slice(0, 3);
      if (debord <= 1 && !coupables.length) return null;
      return `${debord}px de débord | ${coupables.join(" | ")}`;
    });
    ok(`aucun débord horizontal sur ${cle}`, trop === null, trop);
  }
  await onglet("accueil");

  /* Audit du 1er octobre 2026, constat 4.8 : en paysage, les marges latérales
     de l'encoche. Chromium ne simule pas l'encoche ; le contrôle force les
     deux jetons à 47 points, la marge d'un iPhone récent, et mesure que les
     onglets, le ruban, les commandes de la carte et le bouton de fermeture du
     ciel plein écran se tiennent au-delà. */
  await pg.setViewportSize({ width: 844, height: 390 });
  await pg.waitForTimeout(300);
  /* Les onglets se répartissent d'eux-mêmes sur la largeur : le premier se tient
     loin du bord avec ou sans marge. Le contrôle compare donc sa place sans
     marge et avec. */
  const premierOnglet = () => pg.evaluate(() => document.querySelector(".onglets [data-onglet]").getBoundingClientRect().left);
  const ongletSansMarge = await premierOnglet();
  await pg.evaluate(() => {
    document.documentElement.style.setProperty("--gauche", "47px");
    document.documentElement.style.setProperty("--droite", "47px");
  });
  await pg.waitForTimeout(300);
  const dans = sel => pg.evaluate(s => {
    const e = document.querySelector(s);
    if (!e) return `${s} absent`;
    const b = e.getBoundingClientRect();
    return b.left >= 47 && b.right <= window.innerWidth - 47 ? "" : `${s} de ${Math.round(b.left)} à ${Math.round(b.right)}`;
  }, sel);
  const decalage = (await premierOnglet()) - ongletSansMarge;
  const encoche = [await dans(".onglets [data-onglet]"), await dans(".onglets [data-onglet]:last-child"),
    decalage > 10 ? "" : `onglets décalés de ${Math.round(decalage)} points seulement`];
  await onglet("temps");
  encoche.push(await dans("#ecran .mg-v"));
  await onglet("carte");
  await pg.waitForTimeout(400);
  encoche.push(await dans("#caIci"), await dans("#caEchelle"));
  await ecranCiel(pg, "etoiles");
  await pg.waitForTimeout(400);
  if (await pg.locator("#ciBandeau").count()) {
    await pg.locator("#ciBandeau").click();
    await pg.waitForTimeout(500);
    encoche.push(await dans("#ciFermer"));
    await pg.locator("#ciFermer").click();
  } else encoche.push("bandeau du ciel absent");
  await pg.evaluate(() => {
    document.documentElement.style.removeProperty("--gauche");
    document.documentElement.style.removeProperty("--droite");
  });
  await pg.setViewportSize({ width: 390, height: 844 });
  await onglet("accueil");
  ok("en paysage, rien ne passe sous les marges latérales de l'encoche",
    encoche.every(x => x === ""), encoche.filter(Boolean).join(" ; "));

  /* Grand corps de texte. Safari suit le réglage d'accessibilité du système :
     à deux crans au-dessus, une valeur insécable débordait de sa carte et la
     colonne des heures se coupait au bord de l'écran. */
};
