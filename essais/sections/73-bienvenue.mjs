/* La présentation du premier lancement, version 200, audit d'usage du
   13 octobre 2026. Section écrite le 13 octobre 2026 ; elle part d'un état
   neuf préparé par essais/banc.mjs. */
import { FAIN } from "../faux-services.mjs";

export const titre = "La présentation du premier lancement";
export const avecPage = false;

export default async T => {
  const { ok, ctxReponse, METEO_NUE, reposer } = T;

  /* Sans lieu, l'écran de bienvenue porte les deux boutons du lieu, puis les
     trois cartes de la présentation. */
  const [c1, p1] = await ctxReponse(() => METEO_NUE(), { ecriture: "ruban" });
  await reposer(p1, 2000);
  const vide = await p1.evaluate(() => ({
    titre: document.querySelector("#ecran .etat-vide h2")?.textContent || "",
    boutons: [...document.querySelectorAll("#ecran .etat-vide button")].map(b => b.textContent.trim()).join(" / "),
    cartes: [...document.querySelectorAll("#ecran [data-bienvenue]")].map(c => `${c.dataset.bienvenue}:${c.querySelector("h3").textContent}`).join(" | "),
    lien: document.querySelector('#ecran [data-bienvenue="cle"] a')?.getAttribute("href") || "" }));
  ok("au premier lancement, l'écran de bienvenue choisit le lieu et présente l'application, son installation et la clé",
    vide.titre === "Bienvenue" && vide.boutons === "Choisir une commune / Utiliser ma position"
    && vide.cartes === "objet:Ce que fait Ma météo | installer:L'installer sur le téléphone | cle:La clé de Météo-France, facultative"
    && vide.lien === "https://portail-api.meteofrance.fr", JSON.stringify(vide));

  /* Le geste d'installation suit le système, et se tait une fois installée. */
  ok("le geste d'installation suit le système et se tait une fois l'application installée",
    await p1.evaluate(async () => {
      const B = await import("/src/vues/bienvenue.js");
      const ios = B.systeme("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148");
      const android = B.systeme("Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36");
      const pose = B.installee({ matchMedia: () => ({ matches: true }), navigator: {} });
      const html = B.presentationHTML({ dejaInstallee: true, os: "ios" });
      const htmlIos = B.presentationHTML({ dejaInstallee: false, os: "ios" });
      return [ios, android, pose, html.includes('data-bienvenue="installer"'), /bouton Partager/.test(htmlIos)].join(" ");
    }) === "ios android true false true");
  await c1.close();

  /* La présentation se rouvre depuis les réglages. */
  const [c2, p2] = await ctxReponse(() => METEO_NUE(), FAIN);
  await reposer(p2, 2000);
  await p2.locator("#btnReglages").click();
  await p2.waitForTimeout(600);
  await p2.locator('#feuille-corps [data-feuille="bienvenue"]').click();
  await p2.waitForTimeout(600);
  const feuille = await p2.evaluate(() => ({ titre: document.getElementById("feuille-titre")?.textContent || "",
    n: document.querySelectorAll("#feuille-corps [data-bienvenue]").length }));
  ok("la présentation se rouvre depuis les réglages", feuille.titre === "Présentation" && feuille.n === 3, JSON.stringify(feuille));

  /* Une feuille ouverte sur une autre se ferme toujours, version 200,
     signalé par Jérôme le 13 octobre 2026 : la croix ferme toute la pile, la
     flèche remonte d'une feuille, le retour du système aussi, et rien ne sort
     de l'application. */
  const etat = () => p2.evaluate(() => `${document.getElementById("feuille").hidden ? "fermée" : document.getElementById("feuille-titre").textContent}`);
  const suite = [];
  /* Une page sortie de l'application interrompt la suite des gestes : le
     contrôle le note et conclut. */
  try {
  await p2.locator("#feuille-fermer").click(); await p2.waitForTimeout(600); suite.push(await etat());
  const rouvrir = async () => {
    await p2.locator("#btnReglages").click({ timeout: 5000 }); await p2.waitForTimeout(600);
    await p2.locator('#feuille-corps [data-feuille="bienvenue"]').click({ timeout: 5000 }); await p2.waitForTimeout(600);
  };
  await rouvrir();
  await p2.locator("#feuille-retour").click({ timeout: 5000 }); await p2.waitForTimeout(600); suite.push(await etat());
  await p2.locator("#feuille-fermer").click({ timeout: 5000 }); await p2.waitForTimeout(600); suite.push(await etat());
  await rouvrir();
  await p2.goBack(); await p2.waitForTimeout(600); suite.push(await etat());
  await p2.goBack(); await p2.waitForTimeout(600); suite.push(await etat());
  suite.push(new URL(p2.url()).pathname);
  } catch { suite.push(`interrompu sur ${p2.url()}`); }
  ok("une feuille ouverte sur une autre se ferme par la croix, la flèche ou le retour, sans quitter l'application",
    suite.join(" | ") === "fermée | Réglages | fermée | Réglages | fermée | /", suite.join(" | "));
  await c2.close();
};
