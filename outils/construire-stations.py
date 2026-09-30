"""Construit src/stations.js, la liste embarquée des stations de ski.

Jalon 16, lot 1, décidé par Jérôme le 30 septembre 2026 : les stations de
France et celles des pays voisins proches, Suisse, Italie, Andorre, Espagne et
Allemagne. La source est OpenSkiMap, qui publie chaque nuit, à partir
d'OpenStreetMap, les domaines skiables du monde avec les altitudes minimale et
maximale de leurs pistes et remontées, calculées sur un modèle de terrain.
Données © contributeurs OpenStreetMap, licence ODbL, par OpenSkiMap :
l'application le cite.

Usage :
    curl -o /tmp/ski_areas.geojson https://tiles.openskimap.org/geojson/ski_areas.geojson
    python3 outils/construire-stations.py /tmp/ski_areas.geojson

Un domaine est retenu s'il est en exploitation, nommé, pratiqué en ski alpin,
et porte au moins une remontée et deux kilomètres de pistes. Des pays voisins
ne restent que les régions d'où une commune française peut être à une heure de
route ; le tri fin à une heure se fait ensuite dans l'application, par la durée
de trajet réelle.
"""

import json
import sys
from datetime import date

PAYS = {"FR", "CH", "IT", "AD", "ES", "DE"}


def voisin_proche(pays, lat, lon):
    """Les régions des pays voisins proches de la France."""
    if pays in ("FR", "AD"):
        return True
    if pays == "CH":
        return lon < 9.0
    if pays == "IT":
        return lon < 8.6 and lat > 43.8
    if pays == "ES":
        # Les Pyrénées seulement : la cordillère Cantabrique, plus à l'ouest,
        # est à plus de deux heures de la France.
        return lat > 42.0 and lon > -2.0
    if pays == "DE":
        return lon < 8.8 and lat < 48.9
    return False


def point(p, g):
    """Un point représentatif : le centre de la vue proposée par OpenSkiMap,
    sinon le point de la géométrie, sinon le centre du premier anneau."""
    c = (p.get("viewportHint") or {}).get("center")
    if c:
        return c[1], c[0]
    t = (g or {}).get("type")
    co = (g or {}).get("coordinates")
    if t == "Point":
        return co[1], co[0]
    anneau = co[0] if t == "Polygon" else co[0][0] if t == "MultiPolygon" else None
    if not anneau:
        return None
    return sum(x[1] for x in anneau) / len(anneau), sum(x[0] for x in anneau) / len(anneau)


def main(chemin):
    d = json.load(open(chemin, encoding="utf-8"))
    retenus = []
    for f in d["features"]:
        p = f["properties"]
        pays = sorted({pl.get("iso3166_1Alpha2") for pl in (p.get("places") or [])} & PAYS)
        if not pays or p.get("status") != "operating" or not p.get("name"):
            continue
        if "downhill" not in (p.get("activities") or []):
            continue
        st = p.get("statistics") or {}
        remontees = sum(v.get("count", 0) for v in ((st.get("lifts") or {}).get("byType") or {}).values())
        pistes = sum(v.get("lengthInKm", 0) for v in
                     (((st.get("runs") or {}).get("byActivity") or {}).get("downhill") or {}).get("byDifficulty", {}).values())
        bas, haut = st.get("minElevation"), st.get("maxElevation")
        if remontees < 1 or pistes < 2 or bas is None or haut is None or haut <= bas:
            continue
        pt = point(p, f.get("geometry"))
        if not pt:
            continue
        lat, lon = pt
        if not voisin_proche(pays[0], lat, lon):
            continue
        retenus.append([p["name"], pays[0], round(lat, 4), round(lon, 4), round(bas), round(haut), round(pistes)])
    retenus.sort(key=lambda x: (x[1] != "FR", x[1], x[0]))
    tete = (
        "/* Les stations de ski de France et des pays voisins proches, jalon 16.\n"
        f"   Construit le {date.today().isoformat()} par outils/construire-stations.py.\n"
        "   Données © contributeurs OpenStreetMap, licence ODbL, par OpenSkiMap.\n"
        "   Chaque station : [nom, pays, latitude, longitude, altitude du pied,\n"
        "   altitude du sommet, kilomètres de pistes de ski alpin]. */\n"
    )
    corps = "export const STATIONS = [\n" + ",\n".join(
        "  " + json.dumps(x, ensure_ascii=False) for x in retenus) + ",\n];\n"
    open("src/stations.js", "w", encoding="utf-8").write(tete + corps)
    compte = {}
    for x in retenus:
        compte[x[1]] = compte.get(x[1], 0) + 1
    print(len(retenus), "stations :", compte)


if __name__ == "__main__":
    main(sys.argv[1])
