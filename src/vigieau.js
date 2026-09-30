/* Les restrictions d'eau, VigiEau, jalon 18, décidé par Jérôme le 30 septembre
   2026. VigiEau publie, pour chaque département, le niveau le plus grave des
   arrêtés en vigueur, toutes ressources confondues : eaux de surface, eaux
   souterraines, eau potable. Une lecture de trente et un kilooctets, gardée
   trois heures. Le service accepte les requêtes de l'application, vérifié le
   30 septembre 2026 depuis son adresse publiée. */

const API = "https://api.vigieau.gouv.fr/api";
export const NIVEAUX = ["vigilance", "alerte", "alerte_renforcee", "crise"];
export const NOMS = { vigilance: "Vigilance", alerte: "Alerte", alerte_renforcee: "Alerte renforcée", crise: "Crise" };
export const rangDe = n => NIVEAUX.indexOf(n) + 1;
const GARDE = 3 * 3600 * 1000;

let lu = null;

/* Le rang de chaque département en restriction, de 1 pour la vigilance à 4
   pour la crise ; un département sans arrêté ne paraît pas dans la table. */
export function versRangs(liste) {
  const t = new Map();
  for (const d of Array.isArray(liste) ? liste : []) {
    const r = rangDe(d?.niveauGraviteMax);
    if (d?.code && r > 0) t.set(String(d.code).padStart(2, "0"), r);
  }
  return t;
}

export async function departements(fetcheur = fetch) {
  if (lu && Date.now() - lu.t < GARDE) return lu.rangs;
  const r = await fetcheur(`${API}/departements`);
  if (!r.ok) throw new Error(`vigieau ${r.status}`);
  const rangs = versRangs(await r.json());
  lu = { t: Date.now(), rangs };
  return rangs;
}
