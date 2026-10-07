/* La pluie tombée sur 48 et 72 heures. Section écrite le 7 octobre 2026,
   version 179, demande de Jérôme. Elle part d'un état neuf préparé par
   essais/banc.mjs ; la grille fabriquée est décrite dans `passeeCorps` des
   faux services : du sud-est arrosé pendant les 48 dernières heures, la
   Bretagne seulement pendant les 24 heures d'avant. */
import { FAIN } from "../faux-services.mjs";

export const titre = "La pluie tombée";
export const avecPage = false;

export default async T => {
  const { ok, etat, ouvrirCarte, reposer } = T;
  const [, p] = await ouvrirCarte({ ...FAIN, pluiecarte: false, foudrecarte: false, vigicarte: false }, 0, { sansFond: true });
  await reposer(p, 1500);

  /* La lecture : les 48 dernières heures et les 72 dernières, sur une série
     écrite à la main ; une heure manquante ne compte pas, un point sans
     valeur reste vide. */
  const lu = await p.evaluate(async () => {
    const PP = await import("/src/pluie-passee.js");
    const N = await import("/src/nappe.js");
    const n = N.COLS * N.RANGS;
    const time = Array.from({ length: 72 }, (_, k) => k * 3600);
    const d = Array.from({ length: n }, (_, i) => ({ hourly: { time,
      precipitation: i === 1 ? time.map(() => null) : time.map((_, k) => (k === 10 ? null : k < 24 ? 2 : 1)) } }));
    const l = PP.lire(d);
    const u = new URL(PP.adresse());
    return { p48: l.pluie48[0], p72: l.pluie72[0], vide: Number.isNaN(l.pluie72[1]),
      requete: [u.searchParams.get("past_hours"), u.searchParams.get("forecast_hours"), u.searchParams.get("hourly")].join(",") };
  });
  ok("les cumuls se font sur les 48 et les 72 dernières heures",
    lu.p48 === 48 && lu.p72 === 94 && lu.vide && lu.requete === "72,0,precipitation", JSON.stringify(lu));

  /* Les deux nappes sont au panneau, dans la famille de l'eau. */
  const tuiles = await p.evaluate(() => ["caPluie48", "caPluie72"].map(id => {
    const b = document.getElementById(id);
    return b ? `${b.closest(".ca-fam")?.getAttribute("aria-label")}:${b.querySelector("span")?.textContent}` : null;
  }));
  ok("le panneau porte la pluie passée sur 48 et sur 72 heures, avec l'eau",
    tuiles.join(" | ") === "Eau:48 h passées | Eau:72 h passées", tuiles.join(" | "));

  const peindre = async id => {
    await p.locator("#caCouches").click();
    await p.waitForTimeout(150);
    await p.locator(`#${id}`).click();
    await p.locator("#caCouches").click();
    await reposer(p, 1500);
  };
  await peindre("caPluie48");
  const p48 = await p.evaluate(async () => {
    const PP = await import("/src/pluie-passee.js"), N = await import("/src/nappe.js");
    const d = await PP.charger();
    const C = await import("/src/carte.js");
    const peinte = C.derniereNappe.valeurA;
    return { titre: document.getElementById("caLegTitre").textContent,
      peinte: peinte ? Math.round(peinte(43.8, 5.8)) : null,
      bretagne: N.valeurA(d.pluie48, 48.2, -3), provence: N.valeurA(d.pluie48, 43.8, 5.8),
      bretagne72: N.valeurA(d.pluie72, 48.2, -3), provence72: N.valeurA(d.pluie72, 43.8, 5.8) };
  });
  ok("la pluie passée se lit d'une seule requête, la Bretagne arrosée sur 72 h et sèche sur 48 h",
    etat.appelsPassee.length === 1 && p48.titre === "Pluie des 48 h passées, estimée (mm)"
    && p48.bretagne === 0 && p48.bretagne72 > 20 && p48.provence > 20 && p48.provence72 === p48.provence
    && p48.peinte === Math.round(p48.provence),
    JSON.stringify({ appels: etat.appelsPassee.length, ...p48 }));

  await peindre("caPluie72");
  ok("passer de 48 à 72 heures ne relit pas la grille", etat.appelsPassee.length === 1, `${etat.appelsPassee.length} appels`);
};
