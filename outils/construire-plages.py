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

import subprocess
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


DISCO = "https://discodata.eea.europa.eu/sql"


def sql(requete, lignes=6000):
    u = f"{DISCO}?{urllib.parse.urlencode({'query': requete, 'p': 1, 'nrOfHits': lignes})}"
    return json.load(urllib.request.urlopen(u, timeout=180)).get("results", [])


def classements():
    """Le classement officiel de chaque site pour la dernière saison publiée,
    au titre de la directive 2006/7/CE : 1 excellent, 2 bon, 3 suffisant,
    4 insuffisant, 0 non classé. Demandé par Jérôme le 30 septembre 2026. Une
    qualité de fond, établie sur quatre saisons de prélèvements, non l'état du
    jour."""
    saison = sql("SELECT MAX(season) AS s FROM [WISE_BWD].[latest].[assessment_BathingWaterStatus] WHERE countryCode='FR'", 1)[0]["s"]
    q = {}
    for pays in ("FR", "ES", "IT", "BE"):
        for r in sql(f"SELECT bathingWaterIdentifier AS i, quality AS q FROM [WISE_BWD].[latest].[assessment_BathingWaterStatus] "
                     f"WHERE season={saison} AND countryCode='{pays}'"):
            c = (r.get("q") or "")[:1]
            q[r["i"]] = int(c) if c.isdigit() else None
    return saison, q


def lire(pays):
    sites, depart = [], 0
    while True:
        q = urllib.parse.urlencode({"where": f"countryCode='{pays}'", "outFields": "nameText,specialisedZoneType,lat,lon,link,thematicIdIdentifier",
                                    "f": "json", "returnGeometry": "false", "resultOffset": depart,
                                    "resultRecordCount": 1000, "orderByFields": "OBJECTID"})
        d = json.load(urllib.request.urlopen(f"{COUCHE}?{q}", timeout=120))
        lot = [f["attributes"] for f in d.get("features", [])]
        sites += lot
        if len(lot) < 1000:
            return sites
        depart += 1000


def main():
    saison, qualites = classements()
    print("classement de la saison", saison, ":", len(qualites), "sites")
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
            # La fiche du ministère de la Santé, pour les derniers prélèvements et une
            # éventuelle interdiction temporaire : identifiant du site et code du
            # département, tels que le lien les porte.
            fiche = re.search(r"idSite=([0-9A-Za-z]+)&codeDept=([0-9AB]{2,3})", a.get("link") or "")
            retenus.append([propre(nom), pays, round(lat, 4), round(lon, 4), code,
                            qualites.get(a.get("thematicIdIdentifier")),
                            f"{fiche.group(1)}:{fiche.group(2)}" if fiche and pays == "FR" else None])
    francaises = [x for x in retenus if x[1] == "FR"]
    with ThreadPoolExecutor(max_workers=6) as ex:
        communes = list(ex.map(lambda x: commune(x[2], x[3]), francaises))
    for x, c in zip(francaises, communes):
        x.insert(4, c)
    for x in retenus:
        if len(x) == 7:
            x.insert(4, None)
    print("communes trouvées :", sum(1 for x in francaises if x[4]), "sur", len(francaises))
    retenus.sort(key=lambda x: (x[1] != "FR", x[1], x[5] or "", x[4] or "", x[0]))
    tete = (
        "/* Les plages de France et des côtes voisines proches, jalon 15.\n"
        f"   Construit le {date.today().isoformat()} par outils/construire-plages.py.\n"
        "   Source : eaux de baignade déclarées au titre de la directive 2006/7/CE,\n"
        "   Agence européenne de l'environnement ; communes françaises par le\n"
        "   service d'adresses de l'État. Chaque plage : [nom, pays, latitude,\n"
        "   longitude, commune ou null, département ou null, classement de la\n"
        "   qualité de l'eau (1 excellent, 2 bon, 3 suffisant, 4 insuffisant,\n"
        "   0 non classé) ou null, fiche du ministère « idSite:codeDept » ou null]. */\n"
    )
    corps = f"export const SAISON_QUALITE = {saison};\n\n" + "export const PLAGES = [\n" + ",\n".join("  " + json.dumps(x, ensure_ascii=False) for x in retenus) + ",\n];\n"
    open("src/plages.js", "w", encoding="utf-8").write(tete + corps)
    compte = {}
    for x in retenus:
        compte[x[1]] = compte.get(x[1], 0) + 1
    print(len(retenus), "plages :", compte)
    # L'orientation du rivage se calcule ensuite, sur les contours embarqués.
    subprocess.run(["node", "outils/orienter-plages.mjs"], check=True)


if __name__ == "__main__":
    main()
