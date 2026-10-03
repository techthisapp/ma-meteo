/* Le soleil. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */

export const titre = "Le soleil";
export const avecPage = true;

export default async T => {
  const { pg, nav, ok, txt, ecranCiel } = T;
  await ecranCiel(pg, "soleil");
  await pg.waitForTimeout(600);
  const soleilTxt = await txt("#ecran");
  ok("la durée du jour est écrite", /\d+ h \d\d/.test(soleilTxt));
  ok("le midi solaire est écrit", /Midi solaire/.test(soleilTxt));
  ok("le midi solaire porte la hauteur maximale",
    /Midi solaire[\s\S]{0,40}\d+° de hauteur/.test(soleilTxt), soleilTxt.slice(0, 120));
  ok("les trois crépuscules sont nommés",
    ["Crépuscule civil", "Crépuscule nautique", "Crépuscule astronomique"]
      .every(x => soleilTxt.includes(x)));
  ok("le lever porte un point cardinal", /Lever[\s\S]{0,40}(nord|est|sud|ouest)/.test(soleilTxt), soleilTxt.slice(0, 80));

  /* Les deux écrans jumeaux portent la même sous-ligne : une vignette de l'astre
     peinte, puis son état. Dans le ciel du bandeau chaque astre est à sa place
     réelle et peut n'y être pas visible du tout ; la vignette le montre toujours. */
  ok("le Soleil porte sa vignette devant son état", await pg.evaluate(() => {
    const v = document.querySelector(".plein-titre em canvas#ptSoleil");
    if (!v) return false;
    const t = document.querySelector(".plein-titre em span");
    return !!t && v.compareDocumentPosition(t) === Node.DOCUMENT_POSITION_FOLLOWING;
  }));
  ok("elle est peinte, opaque et chaude", await pg.evaluate(() => {
    const cv = document.getElementById("ptSoleil");
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    let n = 0, r = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 200) continue;
      n++; r += d[i]; b += d[i + 2];
    }
    // Le disque couvre environ les trois quarts du carré, et le feu est chaud.
    if (n < (d.length / 4) * 0.5) return `${n} pixels opaques`;
    return r / n > b / n + 40 ? "" : `rouge ${Math.round(r / n)} contre bleu ${Math.round(b / n)}`;
  }) === "");
  /* Le même alignement des deux côtés : c'est la vignette qui décale le texte,
     et une seule règle de taille la porte pour les deux écrans. */
  const decalage = async cle => {
    await ecranCiel(pg, cle);
    return pg.evaluate(() => {
      const em = document.querySelector(".plein-titre em");
      const sp = em?.querySelector("span");
      const cv = em?.querySelector("canvas");
      const t = document.querySelector(".plein-titre > b");
      if (!em || !sp || !cv || !t) return null;
      const b = em.getBoundingClientRect();
      return [Math.round(sp.getBoundingClientRect().left - b.left),
        Math.round(cv.getBoundingClientRect().width),
        Math.round(b.left - t.getBoundingClientRect().left)];
    });
  };
  const alSoleil = await decalage("soleil");
  const alLune = await decalage("lune");
  ok("les deux écrans jumeaux alignent leur sous-ligne au même endroit",
    !!alSoleil && JSON.stringify(alSoleil) === JSON.stringify(alLune),
    `${JSON.stringify(alSoleil)} contre ${JSON.stringify(alLune)}`);
  await ecranCiel(pg, "soleil");
  await pg.waitForTimeout(500);

  /* La plainte d'origine : la même heure écrite deux fois. Le bandeau annonce le
     prochain évènement et redit donc son heure, il reste hors du compte. */
  ok("aucune heure n'est écrite deux fois dans le corps", await pg.evaluate(() => {
    const h = (document.querySelector("#ecran .ecran-corps").innerText.match(/\b\d\d:\d\d\b/g) || []);
    return h.length === new Set(h).size;
  }), await pg.evaluate(() =>
    (document.querySelector("#ecran .ecran-corps").innerText.match(/\b\d\d:\d\d\b/g) || []).join(" ")));

  const dureeTxt = await txt(".tm > div:first-child b");
  ok("la durée du jour n'est écrite qu'une fois",
    dureeTxt !== "" && soleilTxt.split(dureeTxt).length - 1 === 1,
    `${dureeTxt} | ${soleilTxt.split(dureeTxt).length - 1}`);

  /* Le seconde plainte : la note nommait trois crépuscules, la carte en montrait
     deux. Les deux listes doivent coïncider, dans le même ordre. */
  const nomsCrep = await pg.evaluate(() => {
    const carte = document.querySelector("#ecran .cp").closest(".carte");
    const note = (carte.querySelector(".note") || { textContent: "" }).textContent.toLowerCase();
    const rangs = [...carte.querySelectorAll(".cp-n b")].map(e => e.textContent.toLowerCase());
    const cles = ["civil", "nautique", "astronomique"];
    return {
      note: cles.filter(k => note.includes(k)),
      rangs: cles.filter(k => rangs.some(r => r.includes(k))),
    };
  });
  ok("la note ne nomme que les crépuscules montrés",
    nomsCrep.note.length === 3 && nomsCrep.note.join() === nomsCrep.rangs.join(),
    `${nomsCrep.note.join("/")} | ${nomsCrep.rangs.join("/")}`);

  /* La troisième : deux heures nues sans dire laquelle est le matin. Chaque
     rangée porte donc deux colonnes, et chaque heure tombe dans sa moitié. */
  const crepRangs = await pg.evaluate(() => {
    const tete = [...document.querySelectorAll(".cp-t")].map(e => e.textContent.trim());
    if (tete[1] !== "Le matin" || tete[2] !== "Le soir") return "entête " + tete.join("/");
    const cases = [...document.querySelectorAll(".cp > *")];
    const enMin = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
    let i = 3, rangs = 0;
    while (i < cases.length) {
      if (!cases[i].classList.contains("cp-n")) return "rangée sans nom en " + i;
      const a = cases[i + 1], b = cases[i + 2];
      /* La case d'absence dit pourquoi il n'y a pas d'heure. Si elle en porte
         une, les deux moments sont retombés dans la même case. */
      if (a && a.classList.contains("cp-abs")) {
        if (/\d\d:\d\d/.test(a.textContent)) return "deux moments dans une case: " + a.textContent;
        i += 2; rangs++; continue;
      }
      if (!a || !b || !a.classList.contains("cp-h") || !b.classList.contains("cp-h")) {
        return "heures manquantes en " + i;
      }
      if (enMin(a.textContent) >= 720 || enMin(b.textContent) <= 720) {
        return `hors de sa moitié ${a.textContent} ${b.textContent}`;
      }
      i += 3; rangs++;
    }
    return rangs === 3 ? "" : "rangées " + rangs;
  });
  ok("chaque crépuscule dit son matin et son soir", crepRangs === "", crepRangs);

  // Le ruban de la lumière : il couvre le jour entier et montre ses cinq états.
  const ruban = await pg.evaluate(() => {
    const r = [...document.querySelectorAll(".lm-r rect.lm")];
    return {
      largeur: r.reduce((a, e) => a + Number(e.getAttribute("width")), 0),
      etats: new Set(r.map(e => e.getAttribute("class").split(" ")[1])).size,
    };
  });
  ok("le ruban de la lumière couvre les vingt-quatre heures",
    Math.abs(ruban.largeur - 334) < 1.5, String(ruban.largeur));
  ok("le ruban montre les cinq états de la lumière", ruban.etats === 5, String(ruban.etats));
  /* Le découpage doit couvrir la journée entière et sans trou, quel que soit le
     ciel : un jour sans nuit noire, un jour sans coucher, un jour ordinaire. */
  const decoupe = await pg.evaluate(async () => {
    const { bandesLum } = await import("/src/vues.js");
    const courbe = f => {
      const out = [];
      for (let m = 0; m <= 1440; m += 5) out.push({ m, h: f(m) });
      return out;
    };
    const cas = {
      ordinaire: m => 55 * -Math.cos(2 * Math.PI * m / 1440) + 5,
      "sans nuit noire": m => 20 * -Math.cos(2 * Math.PI * m / 1440) + 5,
      "sans coucher": () => 12,
      "sans lever": () => -40,
    };
    const maux = [];
    for (const [nom, f] of Object.entries(cas)) {
      const b = bandesLum(courbe(f));
      if (!b.length) { maux.push(`${nom}: aucune bande`); continue; }
      if (b[0].a !== 0) maux.push(`${nom}: débute à ${b[0].a}`);
      if (b[b.length - 1].b !== 1440) maux.push(`${nom}: finit à ${b[b.length - 1].b}`);
      for (let k = 1; k < b.length; k++) {
        if (Math.abs(b[k].a - b[k - 1].b) > 1e-6) maux.push(`${nom}: trou en ${b[k].a}`);
        if (b[k].z === b[k - 1].z) maux.push(`${nom}: deux bandes du même état`);
      }
    }
    return maux;
  });
  ok("le découpage de la lumière couvre la journée sans trou",
    decoupe.length === 0, decoupe.join(" | "));

  ok("chaque crépuscule porte la teinte de sa bande", await pg.evaluate(() => {
    const sonde = document.createElement("div");
    document.body.append(sonde);
    const attendu = n => {
      sonde.style.background = `var(${n})`;
      return getComputedStyle(sonde).backgroundColor;
    };
    const vu = c => {
      const e = document.querySelector(c);
      return e ? getComputedStyle(e).backgroundColor : "";
    };
    const bon = vu(".cp-p.p-civil") === attendu("--lum-civil")
      && vu(".cp-p.p-naut") === attendu("--lum-naut")
      && vu(".cp-p.p-astro") === attendu("--lum-astro");
    sonde.remove();
    return bon;
  }));

  // Bandeau plein cadre : le ciel monte sous la barre de tête et la déshabille.
  ok("le bandeau du ciel occupe toute la largeur", await pg.evaluate(() => {
    const ci = document.querySelector(".ci");
    if (!ci) return false;
    const b = ci.getBoundingClientRect();
    return b.left <= 0.5 && Math.abs(b.right - window.innerWidth) < 0.5 && b.top <= 0.5;
  }));
  ok("aucun grand titre ne double celui du ciel",
    await pg.locator("#ecran .titre-ecran").count() === 0);
  ok("le ciel porte le prochain évènement et son heure",
    /^\d\d h( \d\d)?$/.test(await txt(".plein-titre b")), await txt(".plein-titre b"));

  /* Le grand chiffre est le même sur les trois bandeaux : la température de
     l'accueil, l'heure du soleil, l'heure de la lune. Deux traitements pour un
     même rôle donnaient trois écrans qui ne se ressemblaient pas. */
  const grandChiffre = await pg.evaluate(() => {
    const faire = html => {
      const d = document.createElement("div");
      d.style.position = "absolute"; d.style.visibility = "hidden";
      d.innerHTML = html;
      document.body.append(d);
      return d;
    };
    const a = faire('<div class="plein-titre"><b>0</b></div>');
    const b = faire('<div class="plein-titre"><div class="pt-temps">'
      + '<span class="bd-deg">0</span></div></div>');
    const lire = e => {
      const s = getComputedStyle(e);
      return [s.fontSize, s.fontWeight, s.letterSpacing].join("/");
    };
    const r = [lire(a.querySelector("b")), lire(b.querySelector(".bd-deg"))];
    a.remove(); b.remove();
    return r;
  });
  ok("le grand chiffre du ciel est le même sur les trois bandeaux",
    grandChiffre[0] === grandChiffre[1], grandChiffre.join("  contre  "));
  ok("la barre de tête se déshabille sur le ciel",
    await pg.locator("#nav.sur-ciel").count() === 1);
  ok("la barre de tête reprend son verre au défilement", await pg.evaluate(async () => {
    window.scrollTo({ top: 400, behavior: "instant" });
    await new Promise(r => setTimeout(r, 200));
    const nav = document.getElementById("nav");
    const bon = !nav.classList.contains("sur-ciel") && nav.classList.contains("pose");
    window.scrollTo({ top: 0, behavior: "instant" });
    await new Promise(r => setTimeout(r, 200));
    return bon;
  }));

  // La toile du Soleil : elle est peinte, et elle bouge.
  ok("le Soleil est peint sur une toile", await pg.locator("canvas#ciFeu").count() === 1);
  ok("la toile est teintée d'après la hauteur", await pg.evaluate(() => {
    const v = Number(document.getElementById("ciFeu").dataset.chaud);
    return Number.isFinite(v) && v >= 0 && v <= 1;
  }));
  ok("la toile porte des pixels", await pg.evaluate(() => {
    const cv = document.getElementById("ciFeu");
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    for (let i = 3; i < d.length; i += 400) if (d[i] > 8) return true;
    return false;
  }));
  ok("la matière bouge d'une image à l'autre", await pg.evaluate(async () => {
    const cv = document.getElementById("ciFeu");
    const lire = () => cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    const a = lire();
    await new Promise(r => setTimeout(r, 700));
    const b = lire();
    let som = 0, n = 0;
    for (let i = 0; i < b.length; i += 16) { som += Math.abs(b[i] - a[i]); n++; }
    return som / n > 0.5;
  }));
  ok("la trajectoire couvre les vingt-quatre heures", await pg.evaluate(() => {
    const t = [...document.querySelectorAll(".tr-txt")].map(e => e.textContent);
    return t.includes("00 h") && t.includes("24 h") && t.includes("90°");
  }));
  ok("la nuit est en pointillé, le jour en trait plein",
    await pg.locator(".tr-ligne").count() === 1 && await pg.locator(".tr-ligne-nuit").count() === 2);
  ok("la course du jour se lit dans l'ordre", await pg.evaluate(() => {
    const n = [...document.querySelectorAll(".ch .rangee-txt > b")].map(e => e.textContent);
    return n.length === 3 && n[0] === "Lever" && n[1] === "Midi solaire" && n[2] === "Coucher";
  }), await pg.evaluate(() =>
    [...document.querySelectorAll(".ch .rangee-txt > b")].map(e => e.textContent).join("/")));
  ok("les trois mesures tiennent sur une ligne",
    await pg.locator(".tm > div").count() === 3);
};
