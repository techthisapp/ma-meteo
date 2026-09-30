"""Construit src/plages.js, la liste embarquée des plages.

Jalon 15, lot 1. La source est la liste officielle des eaux de baignade
déclarées à la Commission européenne au titre de la directive 2006/7/CE,
publiée par l'Agence européenne de l'environnement : chaque site y porte son
nom, ses coordonnées et son type. Seuls les sites de mer et d'estuaire sont
retenus, en France et sur les côtes voisines d'où une commune française peut
être à une heure de route, comme pour les stations de ski ; le tri fin à une
heure se fait dans l'application, par la durée de trajet réelle. Ce sont les
plages surveillées, non chaque bout de sable nommé sur une carte.

Usage : python3 outils/construire-plages.py
"""

import json
import re
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date

COUCHE = ("https://marine.discomap.eea.europa.eu/arcgis/rest/services/"
          "WISE_WFD/WFD2016_ProtectedArea_WM/MapServer/1/query")
TYPES = {"coastalBathingWater", "transitionalBathingWater", "transitionalWater"}


def voisin_proche(pays, lat, lon):
    if pays == "FR":
        # La métropole et la Corse : l'outre-mer, aussi déclaré sous « FR »,
        # n'est à une heure de route d'aucune commune de métropole, et le reste
        # de l'application ne le couvre pas.
        return 41.0 < lat < 51.5 and -5.5 < lon < 9.8
    if pays == "ES":
        # Le Guipuscoa, à moins d'une heure d'Hendaye, et la Catalogne du nord,
        # jusqu'à Barcelone exclue. Une première version gardait tout ce qui
        # était à l'ouest de 1,5° Ouest, soit la côte cantabrique et la Galice.
        return (-2.6 < lon < -1.5 and lat > 43.2) or (lon > 2.8 and lat > 41.9)
    if pays == "IT":
        return lon < 8.6 and lat > 43.7
    if pays == "BE":
        return True
    return False


# Les noms officiels sont en capitales, sans accents. Ils reviennent en
# minuscules avec les majuscules d'usage ; les accents ne se rétablissent que
# sur les mots courants du littoral, là où ils sont sûrs.
ACCENTS = {
    "cote": "côte", "cotes": "côtes", "ile": "île", "iles": "îles", "ilot": "îlot", "etang": "étang",
    "greve": "grève", "greves": "grèves", "eglise": "église", "ecole": "école", "chateau": "château",
    "foret": "forêt", "epi": "épi", "prefet": "préfet", "pres": "prés", "presqu": "presqu", "phare": "phare",
    "anse": "anse", "etel": "étel", "ecluse": "écluse", "elancourt": "élancourt", "hotel": "hôtel",
    "centre": "centre", "rocher": "rocher", "benodet": "bénodet", "treguier": "tréguier",
    "etretat": "étretat", "fecamp": "fécamp", "carteret": "carteret", "sete": "sète", "frejus": "fréjus",
    "theoule": "théoule", "saint-tropez": "saint-tropez", "cap": "cap", "pointe": "pointe", "digue": "digue",
    "marees": "marées", "debarquement": "débarquement", "etoile": "étoile", "vieux": "vieux",
}
PETITS = {"de", "du", "des", "la", "le", "les", "et", "à", "a", "au", "aux", "en", "sur", "sous", "d", "l", "dit", "dite"}


def propre(nom):
    """« GRANDE PLAGE SUD (CASINO) » devient « Grande Plage Sud (Casino) » : une
    majuscule à chaque mot sauf les articles et prépositions, y compris après
    une apostrophe, « Chambre d'Amour » ; « St » devient « Saint » ; les
    accents du dictionnaire. Une première version ne gardait la majuscule qu'au
    premier mot, « Côte des basques », et laissait « St » faute d'expressions
    régulières correctement échappées."""
    t = re.sub(r"\b(st|ste)\b\.?", lambda x: {"st": "saint", "ste": "sainte"}[x.group(1)], nom.lower())
    out, premier = [], True
    for j in re.split(r"(\s+|\(|\)|'|-)", t):
        if not j or j.isspace() or j in "()'-":
            out.append(j)
            if j == "(":
                premier = True
            continue
        j = ACCENTS.get(j, j)
        if premier or j not in PETITS:
            j = j[0].upper() + j[1:]
        premier = False
        out.append(j)
    return re.sub(r"\s+", " ", "".join(out)).strip()


ECHECS = [0]


def commune(lat, lon):
    """La commune de l'adresse la plus proche, par le service d'adresses de
    l'État : un point de baignade tombe souvent en mer, hors de tout contour
    de commune, et l'adresse la plus proche reste juste. C'est un
    enrichissement : une seule tentative courte, et abandon après vingt
    échecs. Le 30 septembre 2026, le service a cessé de répondre en pleine
    construction et les tentatives répétées l'enlisaient ; le département,
    tiré du lien de chaque site, situe toujours la plage."""
    if ECHECS[0] >= 20:
        return None
    u = f"https://api-adresse.data.gouv.fr/reverse/?lat={lat}&lon={lon}&limit=1"
    try:
        d = json.load(urllib.request.urlopen(u, timeout=6))
        f = d.get("features") or []
        return f[0]["properties"].get("city") if f else None
    except Exception:
        ECHECS[0] += 1
        return None


def lire(pays):
    sites, depart = [], 0
    while True:
        q = urllib.parse.urlencode({"where": f"countryCode='{pays}'", "outFields": "nameText,specialisedZoneType,lat,lon,link",
                                    "f": "json", "returnGeometry": "false", "resultOffset": depart,
                                    "resultRecordCount": 1000, "orderByFields": "OBJECTID"})
        d = json.load(urllib.request.urlopen(f"{COUCHE}?{q}", timeout=120))
        lot = [f["attributes"] for f in d.get("features", [])]
        sites += lot
        if len(lot) < 1000:
            return sites
        depart += 1000


def main():
    retenus = []
    for pays in ("FR", "ES", "IT", "BE"):
        for a in lire(pays):
            if a.get("specialisedZoneType") not in TYPES or not a.get("nameText"):
                continue
            lat, lon = a.get("lat"), a.get("lon")
            if lat is None or lon is None or not voisin_proche(pays, lat, lon):
                continue
            dep = re.search(r"codeDept=([0-9AB]{2,3})", a.get("link") or "")
            code = dep.group(1).lstrip("0").zfill(2) if dep and pays == "FR" else None
            # Un code d'outre-mer sur une plage de métropole est une erreur de la
            # source : la « Petite Plage » de Concarneau portait le 971.
            if code and code.startswith("97"):
                code = None
            # Les noms espagnols portent le code du point de prélèvement, « Pm1 ».
            nom = re.sub(r"\s+Pm\s*\d+$", "", a["nameText"].strip(), flags=re.I)
            retenus.append([propre(nom), pays, round(lat, 4), round(lon, 4), code])
    francaises = [x for x in retenus if x[1] == "FR"]
    with ThreadPoolExecutor(max_workers=6) as ex:
        communes = list(ex.map(lambda x: commune(x[2], x[3]), francaises))
    for x, c in zip(francaises, communes):
        x.insert(4, c)
    for x in retenus:
        if len(x) == 5:
            x.insert(4, None)
    print("communes trouvées :", sum(1 for x in francaises if x[4]), "sur", len(francaises))
    retenus.sort(key=lambda x: (x[1] != "FR", x[1], x[5] or "", x[4] or "", x[0]))
    tete = (
        "/* Les plages de France et des côtes voisines proches, jalon 15.\n"
        f"   Construit le {date.today().isoformat()} par outils/construire-plages.py.\n"
        "   Source : eaux de baignade déclarées au titre de la directive 2006/7/CE,\n"
        "   Agence européenne de l'environnement ; communes françaises par le\n"
        "   service d'adresses de l'État. Chaque plage : [nom, pays, latitude,\n"
        "   longitude, commune ou null, département ou null]. */\n"
    )
    corps = "export const PLAGES = [\n" + ",\n".join("  " + json.dumps(x, ensure_ascii=False) for x in retenus) + ",\n];\n"
    open("src/plages.js", "w", encoding="utf-8").write(tete + corps)
    compte = {}
    for x in retenus:
        compte[x[1]] = compte.get(x[1], 0) + 1
    print(len(retenus), "plages :", compte)


if __name__ == "__main__":
    main()
