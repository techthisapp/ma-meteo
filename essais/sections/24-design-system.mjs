/* Design system. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */

export const titre = "Design system";
export const avecPage = true;

export default async T => {
  const { pg, ok, onglet, ecranCiel } = T;
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
     n'est pas écrite n'en est plus une. Depuis la version 140, les commandes
     posées sur la carte, panneau des couches, légendes et bouton des sources,
     sont de la couche navigation de la carte et prennent le verre. */
  ok("le verre est réservé à la couche navigation et à la réponse du matin",
    await pg.evaluate(() => {
      const flous = [...document.querySelectorAll("body *")].filter(e => {
        const s = getComputedStyle(e);
        const f = s.backdropFilter || s.webkitBackdropFilter || "none";
        return f !== "none" && f !== "";
      });
      return flous.every(e => e.closest(".nav, .onglets, .ca-panneau, .ca-legende, .ca-src") || e.matches(".pt-rep"));
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

  /* Audit du 1er octobre 2026, constat 4.12 : les espaces insécables. Sur
     l'accueil, « Heure par heure », « À venir », le ciel, la carte et la
     feuille des réglages, aucun texte ne garde une espace ordinaire avant un
     signe double ou « % », dans des guillemets, ou entre un nombre et son
     unité ; et aucun dessin ne reçoit d'espace insécable, ses tracés
     employant « h » et « m » comme commandes. La lecture est brute : le banc
     normalise sinon les espaces de tout texte lu. */
  const releve = () => pg.evaluateBrut(() => {
    const fautes = [];
    const pas = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = pas.nextNode(); n; n = pas.nextNode()) {
      const v = n.nodeValue;
      if (n.parentElement?.closest("svg")) {
        if (/[\u00A0\u202F]/.test(v)) fautes.push(`dessin : ${v.trim().slice(0, 30)}`);
        continue;
      }
      if (n.parentElement?.closest("script, style, textarea, input, code")) continue;
      if (/\d %| [;:!?](?=\s|$)|« | »|\d (?:km\/h|mm|cm|hPa|min)(?![\p{L}\d])/u.test(v)) fautes.push(v.trim().slice(0, 40));
    }
    for (const svg of document.querySelectorAll("svg")) {
      for (const el of [svg, ...svg.querySelectorAll("*")]) {
        for (const a of el.attributes) if (/[\u00A0\u202F]/.test(a.value)) fautes.push(`attribut ${a.name}`);
      }
    }
    return fautes;
  });
  const fautesTypo = [...await releve()];
  for (const cle of ["temps", "semaine", "carte"]) {
    await onglet(cle);
    await pg.waitForTimeout(500);
    fautesTypo.push(...await releve());
  }
  await ecranCiel(pg, "soleil");
  fautesTypo.push(...await releve());
  await onglet("accueil");
  await pg.locator("#btnReglages").click();
  await pg.waitForTimeout(500);
  fautesTypo.push(...await releve());
  await pg.locator("#feuille-fermer").click();
  await pg.waitForTimeout(400);
  const insecables = await pg.evaluateBrut(() => /\u202F%/.test(document.body.innerText) || /\u00A0(?:km\/h|mm|h)/.test(document.body.innerText));
  ok("les espaces insécables tiennent les nombres à leur unité et les signes doubles à leur mot, hors des dessins",
    fautesTypo.length === 0 && insecables, [...new Set(fautesTypo)].slice(0, 6).join(" ; ") || `aucune insécable posée`);
};
