/* La pluie dans l'heure. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */
import { FIGE, FAIN, amorceGardee } from "../faux-services.mjs";

export const titre = "La pluie dans l'heure";
export const avecPage = false;

export default async T => {
  const { nav, etat, ok, brancherRoutes, ouvrirPage, ctxReponse, METEO_NUE } = T;
  /* Le produit « pluie dans l'heure » de Météo-France, sur le service qui porte
     déjà la vigilance. Il devait être l'extrapolation de RainViewer, lue au pixel
     dans les tuiles ; ce champ était vide aux trois relevés des 5 et 6 septembre,
     et une fonction ne se bâtit pas sur ce qu'une source ne sert pas. */
  const avecPluie = async profil => {
    etat.profilPluie = profil;
    const c = await nav.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
      locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
    });
    await c.addInitScript(amorceGardee(FAIN, FIGE));
    await brancherRoutes(c);
    const p = await c.newPage();
    await ouvrirPage(p);
    await p.waitForTimeout(700);
    const dit = await p.evaluate(() => {
      const e = document.querySelector(".pp");
      if (!e) return null;
      return {
        phrase: e.querySelector(".pp-tete b").textContent,
        barres: [...e.querySelectorAll(".pp-b")].map(b => ({
          x: b.style.getPropertyValue("--x"), h: b.style.getPropertyValue("--h"),
          eau: b.classList.contains("pp-b-eau"),
        })),
        lu: e.querySelector(".pp-g").getAttribute("aria-label"),
        /* Ce qui reste dans la première vue quand la vigilance et la pluie
           proche paraissent ensemble. */
        vue: (() => {
          const b = x => (x ? Math.round(x.getBoundingClientRect().bottom) : null);
          const o = document.getElementById("onglets");
          return {
            deg: b(document.querySelector("#ecran .bd-deg")),
            vg: b(document.querySelector("#ecran .vg")),
            graphe: b(e.querySelector(".pp-g")),
            pli: o ? Math.round(o.getBoundingClientRect().top) : null,
          };
        })(),
        /* La place du panneau dans l'écran : après la vigilance, avant le bloc du
           jour. C'est la seule chose de l'écran qui se démente en vingt minutes. */
        apres: (() => {
          const l = [...document.querySelectorAll(".ecran-corps > .section")];
          const k = l.indexOf(e);
          return k > 0 ? (l[k - 1].classList.contains("vg") ? "vigilance" : l[k - 1].dataset.bloc)
            : "rien";
        })(),
        avant: (() => {
          const l = [...document.querySelectorAll(".ecran-corps > .section")];
          const k = l.indexOf(e);
          return k >= 0 && l[k + 1] ? l[k + 1].dataset.bloc : null;
        })(),
      };
    });
    await c.close();
    etat.profilPluie = "sec";
    return dit;
  };

  const ppSec = await avecPluie("sec");
  ok("une heure entièrement sèche ne dit rien", ppSec === null,
    ppSec && ppSec.phrase);

  const ppDebut = await avecPluie("debut");
  ok("une pluie qui commence se dit avec son délai et sa force",
    ppDebut && ppDebut.phrase === "Pluie modérée dans 20 minutes, pendant 20 minutes environ.",
    ppDebut && ppDebut.phrase);
  /* La force annoncée est la plus forte de l'épisode, non celle de sa première
     échéance : une averse qui commence faible et devient modérée se dit modérée. */
  ok("la force annoncée est celle de tout l'épisode",
    ppDebut && /modérée/.test(ppDebut.phrase), ppDebut && ppDebut.phrase);

  /* Les deux panneaux d'horloge courte tiennent ensemble dans la première vue,
     avec le grand chiffre. Ce qui en sort, ce sont les quatre mesures du jour :
     elles résument une journée, quand la vigilance et la pluie de vingt minutes
     sont deux faits qui se démentent dans l'heure. Mesuré le 6 septembre 2026 sur
     une vigilance orange à deux phénomènes : le graphe finit cent soixante-seize
     points au-dessus de la barre d'onglets, les mesures quatre-vingt-seize points
     en dessous. La garde de la vigilance seule reste entière et sert toujours :
     sa charge est une heure sèche, et un panneau bavard la ferait tomber. */
  ok("la vigilance, la pluie proche et le grand chiffre tiennent dans la première vue",
    ppDebut && ppDebut.vue.deg < ppDebut.vue.pli
    && ppDebut.vue.vg < ppDebut.vue.pli
    && ppDebut.vue.graphe < ppDebut.vue.pli,
    ppDebut && `chiffre ${ppDebut.vue.deg}, vigilance ${ppDebut.vue.vg}, `
      + `graphe ${ppDebut.vue.graphe}, pli ${ppDebut.vue.pli}`);

  ok("le panneau vient après la vigilance et avant le bloc du jour",
    ppDebut && ppDebut.apres === "vigilance" && ppDebut.avant === "jour",
    ppDebut && `précédé de ${ppDebut.apres}, suivi de ${ppDebut.avant}`);

  /* Les échéances ne sont pas également espacées : cinq minutes puis dix. Les
     ranger à intervalle constant mentirait sur la durée. */
  ok("le graphe pose chaque échéance à son heure et non à son rang",
    ppDebut && ppDebut.barres.length === 9
    && (() => {
      const x = ppDebut.barres.map(b => parseFloat(b.x));
      if (x[0] !== 0 || Math.abs(x[8] - 100) > 0.01) return false;
      const ecarts = x.slice(1).map((v, k) => v - x[k]);
      // Les six premiers pas valent cinq minutes, les deux derniers dix.
      return Math.abs(ecarts[0] - ecarts[4]) < 0.01
        && ecarts[6] > ecarts[0] * 1.8 && ecarts[7] > ecarts[0] * 1.8;
    })(),
    ppDebut && ppDebut.barres.map(b => b.x).join(" "));

  ok("seules les échéances mouillées portent la couleur de l'eau",
    ppDebut && ppDebut.barres.map(b => (b.eau ? 1 : 0)).join("") === "000111000",
    ppDebut && ppDebut.barres.map(b => (b.eau ? 1 : 0)).join(""));

  ok("le graphe se lit sans le voir",
    ppDebut && /pluie modérée de \d\d[ :]/i.test(ppDebut.lu), ppDebut && ppDebut.lu);

  const ppEnCours = await avecPluie("encours");
  ok("une pluie en cours se dit par sa fin",
    ppEnCours && ppEnCours.phrase === "Pluie faible, qui s'arrête dans 15 minutes.",
    ppEnCours && ppEnCours.phrase);

  const ppSansFin = await avecPluie("sansfin");
  ok("une pluie sans accalmie ne s'invente pas de fin",
    ppSansFin && ppSansFin.phrase === "Pluie modérée, sans accalmie dans l'heure.",
    ppSansFin && ppSansFin.phrase);

  /* Le drapeau de disponibilité fait foi. Mesuré le 6 septembre 2026 : Ajaccio,
     Briançon et Gaillard rendent neuf échéances toutes à « Temps sec » avec le
     drapeau à zéro, le radar ne couvrant pas ces reliefs.

     La garde se lit sur la fonction et non sur l'écran, et c'est voulu. Un produit
     indisponible rend du temps sec, l'encart se tait sur une heure sèche, et une
     faute qui ignorerait le drapeau ne changerait donc rien de visible sur les cas
     observés. Ce que le drapeau protège est le contrat du module : ne rien
     conclure d'une lecture qu'il ne couvre pas, quelles que soient les valeurs
     qu'elle porte. Une charge indisponible portant de la pluie n'a pas été
     observée et ne se fabrique donc pas en réponse de service ; elle se pose ici,
     directement sur la fonction, là où elle ne prétend rien de la source. */
  const ppIndispo = await avecPluie("indispo");
  ok("un produit indisponible ne dit rien à l'écran", ppIndispo === null,
    ppIndispo && ppIndispo.phrase);

  const [ctxDrapeau, pgDrapeau] = await ctxReponse(METEO_NUE, FAIN);
  ok("une lecture non couverte ne conclut rien, quelles que soient ses valeurs",
    await pgDrapeau.evaluate(async () => {
      const M = await import("/src/pluieproche.js");
      const t0 = Date.now();
      const pas = [0, 5, 10, 15, 20, 25, 30, 40, 50]
        .map((m, k) => ({ t: t0 + m * 60000, i: k < 2 ? 1 : 3 }));
      const couvert = M.evenement({ dispo: true, pas }, t0);
      const nu = M.evenement({ dispo: false, pas }, t0);
      if (!couvert) return "la même lecture couverte ne dit rien non plus";
      return nu === null ? "" : `non couverte : ${M.phrase(nu, t0)}`;
    }) === "");
  await ctxDrapeau.close();

  /* Le rang zéro n'est pas du temps sec : c'est l'absence de valeur. Une averse
     suivie d'échéances muettes ne s'arrête pas, on ignore quand elle s'arrête. */
  const ppMuet = await avecPluie("muet");
  ok("une échéance sans valeur n'invente pas une fin de pluie",
    ppMuet && ppMuet.phrase === "Pluie faible, sans accalmie dans l'heure.",
    ppMuet && ppMuet.phrase);

  /* Un trou avant la pluie : la source ne dit rien de ce qui se passe entre les
     deux, et une averse annoncée derrière un trou serait une averse dont on ignore
     si elle a déjà commencé. La lecture s'arrête au trou. */
  const ppSecMuet = await avecPluie("secmuet");
  ok("une échéance sans valeur arrête la lecture avant la pluie qui suit",
    ppSecMuet === null, ppSecMuet && ppSecMuet.phrase);

  /* ---------- Le sens d'arrivée de la pluie ----------

     Le service radar publie son champ extrapolé vide, relevé les 5, 6, 7 et 8
     septembre 2026 : rien ne se prévoit à partir des images. Ce qui se mesure est
     le passé, le déplacement de la masse entre deux images observées.

     La charge d'essai porte des taches qui se déplacent de deux points vers l'est
     et un vers le nord par pas de dix minutes, sur la tuile de zoom cinq qui
     contient la commune. Sur les trois pas que la mesure compare, cela fait une
     provenance de 243 degrés à environ quarante kilomètres par heure, ce qui est
     le cas réel relevé le 8 septembre. */
};
