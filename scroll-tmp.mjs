import { chromium } from "/tmp/claude-0/-home-user-AGB-Finder/23562c87-f7b3-5d39-be92-b268d7c76cb9/scratchpad/node_modules/playwright-core/index.mjs";
const ok = [], ko = [];
const check = (c, n, e = "") => (c ? ok : ko).push(n + (e ? ` — ${e}` : ""));
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });

for (const [label, viewport] of [["mobile", { width: 375, height: 700 }], ["desktop", { width: 1440, height: 900 }]]) {
  const p = await (await b.newContext({ viewport })).newPage();
  await p.goto("http://localhost:3000/login");
  await p.fill("#email", "admin@utensilferramenta.it");
  await p.fill("#password", "change-me-strong-password");
  await p.click('button[type="submit"]');
  await p.waitForTimeout(3000);

  // Lista lunga: i 139 codici di KIT.
  await p.goto("http://localhost:3000/maniglie?tipo=KIT");
  await p.waitForTimeout(3500);
  await p.evaluate(() => window.scrollTo(0, 900));
  await p.waitForTimeout(500);
  const prima = await p.evaluate(() => Math.round(window.scrollY));

  // Clic su una riga visibile → salvataggio su pointerdown, poi la scheda.
  const link = await p.evaluateHandle(() => {
    const as = [...document.querySelectorAll('a[href^="/maniglie/"]')];
    return as.find((a) => { const r = a.getBoundingClientRect(); return r.top > 100 && r.bottom < window.innerHeight - 50; }) ?? as[0];
  });
  await link.asElement().click();
  await p.waitForTimeout(3000);
  const suScheda = /\/maniglie\/[a-z0-9]+/.test(p.url());
  check(suScheda, `[${label}] la riga apre la scheda`, p.url());

  await p.goBack();
  await p.waitForTimeout(3500);
  const dopo = await p.evaluate(() => Math.round(window.scrollY));
  check(Math.abs(dopo - prima) <= 40, `[${label}] tornando indietro riprende da dov'era`, `${prima} → ${dopo}`);
  await p.screenshot({ path: "/tmp/claude-0/-home-user-AGB-Finder/23562c87-f7b3-5d39-be92-b268d7c76cb9/scratchpad/shots/" + label + "-7-ritorno.png" });

  // Troncamento del nome a 375px
  if (label === "mobile") {
    await p.goto("http://localhost:3000/maniglie?tipo=LARA&fam=CB71R");
    await p.waitForTimeout(3500);
    const tronc = await p.evaluate(() => [...document.querySelectorAll("li span.text-sm.font-medium")].filter((s) => s.scrollHeight > s.clientHeight + 1).length);
    check(tronc === 0, "[mobile] nessun nome tagliato nell'elenco di una famiglia", `tagliati: ${tronc}`);
    await p.screenshot({ path: "/tmp/claude-0/-home-user-AGB-Finder/23562c87-f7b3-5d39-be92-b268d7c76cb9/scratchpad/shots/mobile-8-nomi.png" });
  }
}
await b.close();
console.log("✅ VERDI (" + ok.length + ")"); ok.forEach((s) => console.log("   " + s));
if (ko.length) { console.log("❌ ROSSI (" + ko.length + ")"); ko.forEach((s) => console.log("   " + s)); }
