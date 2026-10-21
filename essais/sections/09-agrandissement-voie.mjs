/* Agrandissement d'une voie. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs.

   Depuis la version 232, la vue ciblée dessine sa seule voie dépliée : la
   section vérifie que chaque voie garde sa hauteur dépliée propre. */

export const titre = "Agrandissement d'une voie";
export const avecPage = true;

export default async T => {
  const { pg, ok, ouvrirVoie, CADRE } = T;
  const voir = async c => { await pg.locator(`.hh-puce[data-grandeur="${c}"]`).click(); await pg.waitForTimeout(320); };
  const haut = async c => { await voir(c); return (await pg.locator(`.mg-v[data-cle="${c}"] svg.mg-s`).boundingBox()).height; };
  await ouvrirVoie(pg, "t");
  ok("la voie de la vue ciblée est dépliée", await pg.locator('.mg-v[data-cle="t"].mg-grand').count() === 1);
  const hT = await haut("t"), hHum = await haut("hum");
  // Le dessin est rendu à la largeur de la carte : c'est le rapport qui tient,
  // non la valeur absolue en points de la boîte de vue.
  ok("chaque voie garde sa hauteur dépliée propre", Math.abs(hT / hHum - 86 / 52) < 0.08,
    `température ${hT.toFixed(0)}, humidité ${hHum.toFixed(0)}`);
  await voir("t");
  /* La phrase de la voie se lit en tête de page depuis la version 232, sa
     notice derrière le « i » sous le dessin. */
  ok("la phrase de la voie se lit en tête de page, sa notice derrière le « i »",
    /\d/.test(await pg.locator(".hh-phrase").innerText()) && await pg.locator(".hh-graphe details.aide").count() === 1
    && await pg.locator(".mg-l").count() === 0);
  /* La pile fait cinq cents points et l'axe est tout en bas : une voie dépliée
     au milieu n'aurait plus de repère de temps. Trois axes en tout, celui du ciel
     en tête, celui de la voie dépliée, celui du pied de pile. */
  ok("la voie dépliée ne répète pas l'axe des heures, le bandeau le porte seul",
    await pg.locator(".mg-a").count() === 0,
    String(await pg.locator(".mg-a").count()));
  /* Les symboles et les valeurs occupent deux bandes distinctes : écrits au même
     niveau, les flèches du vent et les chiffres du vent se recouvraient. */
  await voir("v");
  ok("les symboles et les valeurs ne partagent pas leur bande", await pg.evaluate(() => {
    const v = document.querySelector('.mg-v[data-cle="v"]');
    const fl = [...v.querySelectorAll(".mg-fl")];
    const va = [...v.querySelectorAll("text.mg-p")];
    if (!fl.length || !va.length) return "bande vide";
    const bas = Math.max(...fl.map(e => e.getBoundingClientRect().bottom));
    const haut = Math.min(...va.map(e => e.getBoundingClientRect().top));
    return haut >= bas - 1 ? "" : `chevauchement de ${(bas - haut).toFixed(1)} points`;
  }) === "", await pg.evaluate(() => {
    const v = document.querySelector('.mg-v[data-cle="v"]');
    const fl = [...v.querySelectorAll(".mg-fl")], va = [...v.querySelectorAll("text.mg-p")];
    if (!fl.length || !va.length) return "bande vide";
    return `${Math.max(...fl.map(e => e.getBoundingClientRect().bottom)).toFixed(0)} puis `
      + `${Math.min(...va.map(e => e.getBoundingClientRect().top)).toFixed(0)}`;
  }));

  /* Le symbole du ciel est un SVG dans un SVG. Sa taille passe par des attributs,
     non par la feuille de style : WebKit ignore `width` et `height` venus du CSS
     sur un SVG imbriqué, déploie le dessin sur toute la hauteur du parent, et le
     symbole débordait alors de la carte. */
  await voir("nua");
  ok("les symboles du ciel portent leur taille en attributs", await pg.evaluate(() => {
    const ic = [...document.querySelectorAll('.mg-v[data-cle="nua"] svg.mg-ic')];
    if (ic.length < 6) return `seulement ${ic.length} symboles`;
    const nus = ic.filter(e => !e.getAttribute("width") || !e.getAttribute("height"));
    if (nus.length) return `${nus.length} symboles sans taille`;
    /* Quatorze points, la hauteur de la bande. La mesure à l'écran ne suffit pas
       à le dire : le dessin d'un symbole n'occupe que sept dixièmes de sa boîte,
       et un symbole de trente points passait sous le seuil des vingt-deux. */
    const gros = ic.filter(e => e.getAttribute("width") !== "14" || e.getAttribute("height") !== "14");
    return gros.length ? `${gros.length} symboles hors des quatorze points` : "";
  }) === "", String(await pg.locator('.mg-v[data-cle="nua"] svg.mg-ic').count()));
  /* Le dessin court au delà du cadre, d'une fenêtre de part et d'autre : c'est
     cette réserve que le glissement découvre. Les symboles qui y tombent sont
     légitimes, la découpe les retient. Ceux qui tombent dans le cadre, eux,
     doivent tenir dans leur bande. */
  ok("les symboles du ciel tiennent dans leur bande", await pg.evaluate(`(() => {
  const voie = document.querySelector('.mg-v[data-cle="nua"]');
  const c = ${CADRE}(voie.querySelector("svg.mg-s"));
  if (!c) return "aucune découpe";
  let dedans = 0;
  for (const e of voie.querySelectorAll("svg.mg-ic")) {
    const b = e.getBoundingClientRect();
    if (b.height > 22 || b.width > 22) return "symbole de " + b.width.toFixed(0) + " sur " + b.height.toFixed(0);
    const cx = (b.left + b.right) / 2;
    if (cx < c.gauche || cx > c.droite) {
      /* La découpe est portée par un groupe parent, fixe, depuis le
         24 septembre 2026 : posée sur le groupe mobile, elle glissait avec
         lui. */
      if (!e.closest("g.mg-mob") || !e.closest("g[clip-path]")) return "symbole hors cadre et hors découpe";
      continue;
    }
    dedans++;
    if (b.bottom > c.haut + 40 * c.ech) return "symbole hors de la bande";
    if (b.left < c.gauche - 1 || b.right > c.droite + 1) return "symbole à cheval sur le bord";
  }
  return dedans >= 6 ? "" : "seulement " + dedans + " symboles dans le cadre";
})()`) === "", await pg.evaluate(`(() => {
  const voie = document.querySelector('.mg-v[data-cle="nua"]');
  const c = ${CADRE}(voie.querySelector("svg.mg-s"));
  const ic = [...voie.querySelectorAll("svg.mg-ic")];
  const d = ic.filter(e => {
    const b = e.getBoundingClientRect(), cx = (b.left + b.right) / 2;
    return c && cx >= c.gauche && cx <= c.droite;
  });
  return d.length + " dans le cadre sur " + ic.length;
})()`));
  /* Dépliée, la voie du ciel quitte la densité pour l'aire sous ses bandes
     nommées : une teinte n'a pas d'échelle contre laquelle se lire. Et elle tient
     dans la hauteur commune, l'agrandissement d'une bande plate ne donnant rien. */
  ok("le ciel déplié prend la grammaire du tracé", await pg.evaluate(() => {
    const v = document.querySelector('.mg-v[data-cle="nua"]');
    const svg = v.querySelector("svg.mg-s");
    if (!svg.querySelector("polyline")) return "aucune courbe";
    if (!svg.querySelector('path[fill="currentColor"]')) return "aucune aire";
    const noms = [...svg.querySelectorAll("text.mg-bn")].map(e => e.textContent);
    if (!noms.includes("Couvert") || !noms.includes("Éclaircies")) return `bandes ${noms.join("/")}`;
    const lames = [...svg.querySelectorAll('rect[shape-rendering="crispEdges"]')];
    return lames.length ? `${lames.length} lames de densité subsistent` : "";
  }) === "", await pg.evaluate(() => [...document.querySelectorAll(
    '.mg-v[data-cle="nua"] text.mg-bn')].map(e => e.textContent).join("/") || "aucune bande"));
  const hNua = (await pg.locator('.mg-v[data-cle="nua"] svg.mg-s').boundingBox()).height;
  ok("le ciel déplié tient dans la hauteur commune, sans l'agrandissement des courbes",
    Math.abs(hNua / hT - 86 / 215) < 0.04, `rapport ${(hNua / hT).toFixed(2)}, attendu ${(86 / 215).toFixed(2)}`);
};
