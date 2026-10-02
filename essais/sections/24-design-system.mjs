/* Design system. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */

export const titre = "Design system";
export const avecPage = true;

export default async T => {
  const { pg, ok } = T;
  const petites = await pg.evaluate(() => {
    const cibles = [...document.querySelectorAll(
      "button:not([hidden]), a[href], input, .onglet, .rangee")];
    return cibles.filter(e => {
      const b = e.getBoundingClientRect();
      if (!b.width || !b.height) return false;
      return b.width < 44 || b.height < 44;
    }).map(e => `${e.className || e.tagName}`).slice(0, 6);
  });
  ok("toute cible interactive tient 44 pt", petites.length === 0, petites.join(" | "));

  ok("le fond du corps est celui du token", await pg.evaluate(() => {
    const attendu = getComputedStyle(document.documentElement).getPropertyValue("--fond").trim();
    const el = document.createElement("div");
    el.style.color = attendu; document.body.append(el);
    const norm = getComputedStyle(el).color; el.remove();
    return getComputedStyle(document.body).backgroundColor === norm;
  }));

  ok("aucune valeur brute de rayon dans les écrans", await pg.evaluate(() => {
    const feuilles = [...document.styleSheets].filter(f => {
      try { return f.cssRules; } catch { return false; }
    });
    return !feuilles.some(f => [...f.cssRules].some(r =>
      r.style && r.selectorText && !r.selectorText.includes(":root")
      && /border-radius:\s*\d+px/.test(r.style.cssText)
      && !/50%|999px/.test(r.style.cssText)));
  }));

  /* Le verre est la matière de la couche navigation. La réponse du matin en est la
     seule exception, arbitrée : posée sur le ciel, elle emploie la matière que la
     barre de tête emploie déjà. L'exception est nommée ici, une exception qui
     n'est pas écrite n'en est plus une. */
  ok("le verre est réservé à la couche navigation et à la réponse du matin",
    await pg.evaluate(() => {
      const flous = [...document.querySelectorAll("body *")].filter(e => {
        const s = getComputedStyle(e);
        const f = s.backdropFilter || s.webkitBackdropFilter || "none";
        return f !== "none" && f !== "";
      });
      return flous.every(e => e.closest(".nav, .onglets") || e.matches(".pt-rep"));
    }));

  const horsEchelle = await pg.evaluate(() => {
    const r = getComputedStyle(document.documentElement);
    const sonde = document.createElement("div");
    document.body.append(sonde);
    const permises = ["--texte-grand-titre","--texte-titre2","--texte-titre3","--texte-entete",
      "--texte-corps","--texte-appel","--texte-sous","--texte-note","--texte-legende",
      "--texte-legende2"].map(t => {
      sonde.style.fontSize = r.getPropertyValue(t).trim();
      return parseFloat(getComputedStyle(sonde).fontSize);
    });
    // Le grand chiffre du bandeau et les libellés du ruban sont hors échelle par nature.
    const dessins = [".bd-deg", ".mg-c", ".mg-p", ".mg-g", ".mg-axe", "svg"];
    const utilisees = [...document.querySelectorAll("#ecran *")]
      .filter(e => e.textContent.trim() && !e.children.length
        && !dessins.some(s => e.closest(s)))
      .map(e => parseFloat(getComputedStyle(e).fontSize));
    sonde.remove();
    return [...new Set(utilisees)]
      .filter(t => !permises.some(p => Math.abs(p - t) < 0.6));
  });
  ok("toutes les tailles de texte viennent de l'échelle",
    horsEchelle.length === 0, horsEchelle.join(", "));
};
