/* Requêtes vers les sources, avec reprise à attente croissante.

   Le seau de data.gouv limite le débit : une rafale de requêtes se solde par des
   échecs de connexion que le navigateur rapporte comme « Failed to fetch », sans
   distinguer un refus d'origine croisée d'une limitation. Sondé le 19 août 2026,
   le même appel échouait trois fois de suite après une rafale, et réussissait
   trois fois de suite en espaçant les envois de trois secondes.

   Toutes les lectures des sources data.gouv passent donc par ici. */

const ATTENTES = [0, 900, 2400, 5000];

async function tenter(url, options) {
  let derniere = null;
  for (const attente of ATTENTES) {
    if (attente) await new Promise(r => setTimeout(r, attente));
    try {
      const r = await fetch(url, options);
      if (r.ok) return r;
      /* Un 404 ne se retente pas : la ressource n'existe pas, elle n'existera
         pas davantage dans cinq secondes. Un 429 ou un 5xx, si. */
      if (r.status === 404 || r.status === 403) return r;
      derniere = new Error(`statut ${r.status}`);
    } catch (e) {
      derniere = e;
    }
  }
  throw derniere || new Error("injoignable");
}

export async function texte(url, options) {
  const r = await tenter(url, options);
  if (!r.ok) throw new Error(`statut ${r.status}`);
  return await r.text();
}

export async function json(url, options) {
  const r = await tenter(url, options);
  if (!r.ok) throw new Error(`statut ${r.status}`);
  return await r.json();
}

/* Un flux gzip décompressé au vol. `DecompressionStream` est disponible sur les
   quatre moteurs depuis mai 2023. Le fichier départemental de pluie pèse environ
   330 kilo-octets compressés pour un peu plus de deux mégaoctets décompressés :
   le décompresser en mémoire d'un bloc serait tenable, le faire au fil de l'eau
   l'est davantage sur un téléphone. */
export async function texteGzip(url) {
  const r = await tenter(url);
  if (!r.ok) throw new Error(`statut ${r.status}`);
  if (!("DecompressionStream" in globalThis)) throw new Error("décompression indisponible");
  return await new Response(r.body.pipeThrough(new DecompressionStream("gzip"))).text();
}

/* Listage d'un préfixe du seau, au format S3 version 2. Les sous-dossiers
   arrivent dans des balises `CommonPrefixes`, non dans le `Prefix` de tête que
   la réponse répète. */
export async function listerPrefixes(seau, prefixe) {
  const u = `${seau}?list-type=2&prefix=${prefixe}&delimiter=/&max-keys=400`;
  const t = await texte(u);
  return [...t.matchAll(/<CommonPrefixes>\s*<Prefix>([^<]+)<\/Prefix>/g)].map(m => m[1]);
}

export async function listerCles(seau, prefixe) {
  const u = `${seau}?list-type=2&prefix=${prefixe}&max-keys=400`;
  const t = await texte(u);
  return [...t.matchAll(/<Key>([^<]+)<\/Key>/g)].map(m => m[1]);
}
