import io

def rep(p, a, b):
    s = io.open(p, encoding="utf-8").read()
    assert s.count(a) == 1, (p, s.count(a), a[:60])
    io.open(p, "w", encoding="utf-8").write(s.replace(a, b))

rep("src/icones.js",
"""   Deux mesures ont réglé la rampe, le 12 septembre 2026. Sur cinquante-quatre
   points de France et sept jours, l'indice va de 1,2 à 6,3, médiane 5,0, rien
   au-dessus de 8 : la plage utile est le bas de l'échelle, et des arrêts posés
   à 0, 3, 6, 8 puis 11 rendraient la France d'une seule couleur. Ils sont donc
   resserrés, comme ceux de la qualité de l'air l'ont été pour la même raison.""",
"""   Trois mesures ont réglé la rampe. Sur cinquante-quatre points de France et
   sept jours, l'indice va de 1,2 à 6,3, médiane 5,0, rien au-dessus de 8 : la
   plage utile est le bas de l'échelle, et des arrêts posés à 0, 3, 6, 8 puis 11
   rendraient la France d'une seule couleur. Ils sont donc resserrés, comme ceux
   de la qualité de l'air l'ont été pour la même raison.

   Un premier réglage, publié le 12 septembre, laissait pourtant la carte
   presque unie : un jour donné, l'étendue sur le pays vaut trois à quatre
   points, mais la médiane se tient à 5,5 et l'essentiel du territoire se serre
   entre 5 et 6. Les arrêts et l'amplitude ont donc été repris ensemble, sous
   une contrainte : l'indice descend à 1 partout en hiver, et une rampe trop
   pâle en bas fait disparaître la nappe sur le fond de carte. Mesuré en
   distance perçue, sur la nappe telle qu'elle est composée à soixante-deux pour
   cent sur ce fond, le réglage retenu porte l'écart entre 5 et 6 de 6,6 à 17,8,
   près du triple, en gardant 15,4 de distance au fond à un indice de 1. Une
   rampe plus étalée montait à 26 d'écart mais tombait à 7,7 du fond, donc
   invisible l'hiver. La vivacité brute ne sert pas à ce réglage : une couleur
   très sombre a moins d'écart entre ses canaux qu'une couleur moyenne, et
   l'écart brut diminue là où l'œil voit une différence.""")

rep("src/icones.js",
"""const ARRETS_UV = [[0, 268], [2, 276], [4, 288], [6, 306], [9, 322]];
const SATS_UV = [[0, 0.38], [2, 0.50], [4, 0.66], [6, 0.84], [9, 0.95]];
const CLARTES_UV = [[0, 0.76], [2, 0.63], [4, 0.53], [6, 0.45], [9, 0.42]];""",
"""const ARRETS_UV = [[1, 252], [2.5, 270], [4.5, 296], [6, 318], [8, 338]];
const SATS_UV = [[1, 0.42], [2.5, 0.56], [4.5, 0.78], [6, 0.95], [8, 1.0]];
const CLARTES_UV = [[1, 0.80], [2.5, 0.70], [4.5, 0.55], [6, 0.43], [8, 0.34]];""")

rep("src/vues.js",
'    arrets: [0, 2, 4, 6, 9], unite: "", couleur: couleurUV },',
'    arrets: [0, 2, 4, 6, 8], unite: "", couleur: couleurUV },')

rep("essais/controle.mjs",
'  rampeUV.arrets.join(" ") === "0 2 4 6 9", rampeUV.arrets.join(" "));',
'  rampeUV.arrets.join(" ") === "0 2 4 6 8", rampeUV.arrets.join(" "));')

rep("essais/controle.mjs",
"    return { deux: lu(2), cinq: lu(5), plage: [I.teinteUV(0), I.teinteUV(9)],",
"    return { deux: lu(2), cinq: lu(5), cinqSix: [lu(5), lu(6)],\n"
"    plage: [I.teinteUV(0), I.teinteUV(9)],")

rep("essais/controle.mjs",
"""ok("elle va du violet au fuchsia, sans traverser le vert ni le rouge",
  rampeUV.plage.every(h => h >= 260 && h <= 330),
  rampeUV.plage.map(h => h.toFixed(0)).join(" a "));""".replace(" a ", " à "),
"""ok("elle va du violet au fuchsia, sans traverser le vert ni le rouge",
  rampeUV.plage.every(h => h >= 245 && h <= 340),
  rampeUV.plage.map(h => h.toFixed(0)).join(" a "));

/* Un jour donne, l'essentiel du pays se tient entre 5 et 6 : c'est la que la
   rampe doit separer, faute de quoi la carte parait unie. Le premier reglage
   n'y mettait que six degres de roue et deux centiemes de clarte. */
ok("elle separe les valeurs ou se serre le pays, de 5 a 6",
  (() => {
    const [a, b] = rampeUV.cinqSix;
    return (b[0] - a[0]) >= 12 && (a[2] - b[2]) >= 6;
  })(), rampeUV.cinqSix.map(c => c.join("/")).join(" puis "));"""
.replace(" a ", " à ").replace("donne,", "donné,").replace("la que", "là que")
.replace("separer", "séparer").replace("parait", "paraît").replace("reglage", "réglage")
.replace("degres", "degrés").replace("centiemes", "centièmes").replace("clarte", "clarté")
.replace("separe", "sépare").replace("ou se serre", "où se serre"))

print("rampe appliquée")
