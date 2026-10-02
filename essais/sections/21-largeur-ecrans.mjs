/* Largeur des écrans. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */

export const titre = "Largeur des écrans";
export const avecPage = true;

export default async T => {
  const { pg, ok, onglet, ouvrirEcran } = T;
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

  /* Grand corps de texte. Safari suit le réglage d'accessibilité du système :
     à deux crans au-dessus, une valeur insécable débordait de sa carte et la
     colonne des heures se coupait au bord de l'écran. */
};
