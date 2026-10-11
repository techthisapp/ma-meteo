/* Viser le ciel avec le téléphone, jalon 24, lot 6. Section écrite le
   11 octobre 2026, version 190. Elle part d'un état neuf préparé par
   essais/banc.mjs. L'orientation de l'appareil se simule par des évènements
   `deviceorientationabsolute` envoyés à la page. */
import { FIGE, FAIN, amorceGardee } from "../faux-services.mjs";

export const titre = "Viser le ciel avec le téléphone";
export const avecPage = false;

export default async T => {
  const { nav, ok, brancherRoutes, ouvrirPage } = T;
  const c = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await c.addInitScript(amorceGardee(FAIN, FIGE));
  /* L'autorisation que l'iPhone demande au premier appui : accordée ici par
     une réponse écrite à la place de celle du système ; le refus a son
     propre contrôle plus bas. */
  await c.addInitScript(() => {
    globalThis.__orientation = "granted";
    if (typeof DeviceOrientationEvent === "function") {
      DeviceOrientationEvent.requestPermission = () => Promise.resolve(globalThis.__orientation);
    }
  });
  await brancherRoutes(c);
  const p = await c.newPage();
  await ouvrirPage(p);

  /* Le calcul du regard : le dos du téléphone, dans le repère est, nord,
     zénith. */
  ok("le regard suit le dos du téléphone : debout, incliné, à plat, tourné, et le cap de l'iPhone",
    await p.evaluate(async () => {
      const V = await import("/src/vues/etoiles.js");
      const r = x => [Math.round(x.az) % 360, Math.round(x.haut) + 0].join("/");
      return [V.viseeDuTelephone(0, 90, 0), V.viseeDuTelephone(0, 135, 0), V.viseeDuTelephone(0, 0, 0),
        V.viseeDuTelephone(90, 90, 0), V.viseeDuTelephone(0, 90, 0, 90)].map(r).join(" ");
    }) === "0/0 0/45 180/-90 270/0 90/0");

  ok("le lissage prend le plus court chemin en azimut",
    await p.evaluate(async () => {
      const V = await import("/src/vues/etoiles.js");
      const a = V.lisser({ az: 358, haut: 10 }, { az: 6, haut: 30 }, 0.5);
      return `${Math.round(a.az)} ${Math.round(a.haut)}`;
    }) === "2 20");

  /* L'écran : le bouton paraît sur un appareil tactile, la visée suit les
     mesures, un doigt sur le ciel l'éteint. */
  await p.locator('[data-onglet="ciel"]').click();
  await p.waitForTimeout(600);
  await p.locator('[data-ciel="etoiles"]').click();
  await p.waitForTimeout(1500);
  await p.locator("#ciBandeau").click();
  await p.waitForTimeout(700);
  const envoyer = (alpha, beta, gamma, n = 40) => p.evaluate(async ([a, b, g, n]) => {
    for (let k = 0; k < n; k++) {
      window.dispatchEvent(new DeviceOrientationEvent("deviceorientationabsolute", { alpha: a, beta: b, gamma: g, absolute: true }));
      await new Promise(r => setTimeout(r, 5));
    }
    await new Promise(r => setTimeout(r, 200));
    return document.getElementById("ciVisee").textContent;
  }, [alpha, beta, gamma, n]);

  /* Six boutons en haut : la direction regardée passe dessous, en entier. */
  const visee = await p.evaluate(() => {
    const v = document.getElementById("ciVisee"), b = document.getElementById("ciFermer");
    return { entiere: v.scrollWidth <= v.clientWidth + 1, dessous: v.getBoundingClientRect().top >= b.getBoundingClientRect().bottom };
  });
  ok("la direction regardée s'écrit en entier, sous les six boutons", visee.entiere && visee.dessous, JSON.stringify(visee));
  const bouton = await p.evaluate(() => document.getElementById("ciViser")?.getAttribute("aria-pressed"));
  await p.locator("#ciViser").click();
  const presse = await p.evaluate(() => document.getElementById("ciViser").getAttribute("aria-pressed"));
  const est = await envoyer(270, 120, 0);
  const zenith = await envoyer(270, 175, 0);
  ok("la visée suit l'orientation : vers l'est à trente degrés, puis au zénith",
    bouton === "false" && presse === "true" && /^Est, 30°/.test(est) && /^Au zénith/.test(zenith),
    JSON.stringify({ bouton, presse, est, zenith }));

  const box = await p.locator("#ciToilePE").boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down(); await p.mouse.up();
  const eteint = await p.evaluate(() => document.getElementById("ciViser").getAttribute("aria-pressed"));
  const fige = await envoyer(0, 90, 0, 10);
  ok("un doigt sur le ciel reprend la main et éteint la visée",
    eteint === "false" && /^Au zénith/.test(fige), JSON.stringify({ eteint, fige }));

  /* Sans mesure, la visée s'éteint et le dit. */
  await p.locator("#ciViser").click();
  await p.waitForTimeout(1900);
  const muet = await p.evaluate(() => ({ b: document.getElementById("ciViser").getAttribute("aria-pressed"),
    dit: document.getElementById("ciVisee").textContent }));
  ok("un téléphone qui ne donne pas son orientation le dit",
    muet.b === "false" && muet.dit === "Ce téléphone ne donne pas son orientation.", JSON.stringify(muet));

  /* Le refus de l'autorisation se dit, avec où la rendre. */
  await p.evaluate(() => { globalThis.__orientation = "denied"; });
  await p.locator("#ciViser").click();
  await p.waitForTimeout(300);
  const refus = await p.evaluate(() => ({ b: document.getElementById("ciViser").getAttribute("aria-pressed"),
    dit: document.getElementById("ciVisee").textContent }));
  ok("un refus de l'autorisation se dit, avec où l'accorder",
    refus.b === "false" && refus.dit === "L'accès à l'orientation est refusé ; il s'autorise dans les réglages de Safari.",
    JSON.stringify(refus));
  await c.close();

  /* Sur un ordinateur, sans écran tactile, le bouton ne paraît pas. */
  const c2 = await nav.newContext({ viewport: { width: 1200, height: 800 }, locale: "fr-FR", timezoneId: "Europe/Paris" });
  await c2.addInitScript(amorceGardee(FAIN, FIGE));
  await brancherRoutes(c2);
  const p2 = await c2.newPage();
  await ouvrirPage(p2);
  await p2.locator('[data-onglet="ciel"]').click();
  await p2.waitForTimeout(600);
  await p2.locator('[data-ciel="etoiles"]').click();
  await p2.waitForTimeout(1500);
  await p2.locator("#ciBandeau").click();
  await p2.waitForTimeout(700);
  ok("sur un ordinateur, le bouton de visée ne paraît pas",
    await p2.evaluate(() => !!document.getElementById("ciPleinEcran") && !document.getElementById("ciViser")));
  await c2.close();
};
