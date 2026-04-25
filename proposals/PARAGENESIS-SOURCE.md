# Paragenetic Sequences — Source Material for Educational Pamphlets

**Purpose:** Factual content for the four 3.66"×8.5" pamphlets. Each section is dense by design — copy the sections you need into Claude Design, drop the rest. Citations are real published sources you can footnote.

**Intended pamphlet layout** (designer's reference):
- Header: deposit name + locality + cascade-type tagline
- Vertical paragenesis column (top = oldest/deepest/hottest, bottom = youngest/shallowest/coolest)
- Driver paragraph (1 short paragraph naming the cause)
- Footer: sim scenario reference + key citation

---

## 1. Bisbee, Arizona — Supergene Cu Cascade

**Locality:** Warren District, Cochise County, Arizona, USA. Active mining 1880–1975 (Phelps Dodge / now closed). Famous open pit: Lavender Pit. Famous underground: Copper Queen, Holbrook, Czar.

**Geological setting:** A late-Cretaceous granodiorite stock (Sacramento Stock, ~163 Ma) intruded Paleozoic limestone. Hydrothermal Cu sulfide ore formed in the contact metamorphic / skarn aureole. Twenty-plus million years of subsequent uplift and weathering produced the world-famous oxidation profile — the standard textbook example of supergene Cu enrichment.

**The sequence (top → bottom = deep/old → shallow/young):**

| Generation | Minerals | Formula | Conditions |
|---|---|---|---|
| **Hypogene primary** | pyrite, chalcopyrite, sphalerite, galena, arsenopyrite | FeS₂, CuFeS₂, ZnS, PbS, FeAsS | T 250–400°C, reducing, deep |
| **Enrichment blanket** (the "chalcocite blanket") | chalcocite, bornite, covellite | Cu₂S, Cu₅FeS₄, CuS | T <100°C, just below water table; descending Cu²⁺ meets remaining hypogene sulfide |
| **Oxide cap** | cuprite, native copper, tenorite | Cu₂O, Cu, CuO | Above water table, fully oxidized |
| **Carbonate / silicate suite** | malachite, azurite, brochantite, antlerite, chrysocolla | Cu₂CO₃(OH)₂, Cu₃(CO₃)₂(OH)₂, Cu₄SO₄(OH)₆, Cu₃SO₄(OH)₄, (Cu,Al)₂H₂Si₂O₅(OH)₄·n(H₂O) | Continued weathering; CO₃ from carbonate wall-rock; SO₄ from sulfide oxidation |
| **Native gold rebloom** | native_gold | Au | Gold was trapped at ~1500 ppm in arsenopyrite as "invisible gold" (Reich et al. 2005); released on oxidation, re-precipitates at grain boundaries |

**The driver:** Oxygen infiltrates as the water table descends. Each sulfide gives up its metal in turn: Cu migrates downward, encounters remaining sulfide, re-precipitates as enrichment-blanket sulfides. Above the water table, Cu²⁺ meets atmospheric O₂ and CO₂ — oxides form first (cuprite, tenorite), then carbonates (malachite, azurite), then sulfates and silicates as the chemistry evolves. Trapped invisible-gold returns at the very end.

**How each step makes the next possible:**

*Hypogene → Enrichment blanket:* Hypogene oxidation releases Cu²⁺ + acid into descending groundwater. The Cu²⁺ migrates down, meets unreacted hypogene sulfide below the water table, and replaces iron atom-for-atom: CuFeS₂ + Cu²⁺ → Cu₂S + Fe²⁺. The blanket is the same copper, twice — first as chalcopyrite, then re-precipitated lower as chalcocite. Without the original hypogene pile to oxidize and to react against, no blanket.

*Enrichment blanket → Oxide cap:* Continued uplift drops the water table below the blanket. Chalcocite is now exposed and oxidizes too — Cu²⁺ released here meets atmospheric O₂ above the water table, making cuprite (Cu₂O) and tenorite (CuO). Native copper forms in a thin reducing Eh window, usually right against the limestone wall.

*Oxide cap → Carbonates and silicates:* Cu²⁺ from continuing oxidation meets CO₃²⁻ from limestone dissolution. Without a carbonate host wall, the cap would stop at oxides. The Naco Group limestone is why Bisbee has malachite + azurite specimens and porphyry mines in granite hosts don't.

*Through-runs to native gold:* Arsenopyrite trapped Au¹⁺ as solid solution at hypogene crystallization (~1500 ppm; Reich et al. 2005). When arsenopyrite oxidizes much later, the trapped gold is released. It re-precipitates as native metal at grain boundaries where the fluid encounters residual reductant. Three chained events: trap → release → re-precipitate. Without ALL of them, no supergene gold cap.

**Notable specimens:**
- Bisbee azurite (deep blue prismatic crystals with malachite pseudomorphs) — Mineralogical Record's most-photographed locality specimen
- Native copper "wires" up to 30 cm
- Cuprite octahedra to 5 cm with later malachite overgrowth

**Sources:**
- Graeme, R. (2008). "Bisbee Revisited." *Mineralogical Record* 39(6).
- Graeme, R., Graeme, R. III, & Graeme, D. (2019). "The arsenic mineralogy of Bisbee." *Rocks & Minerals* 94(2).
- Reich, M., Kesler, S.E., Utsunomiya, S., Palenik, C.S., Chryssoulis, S.L., & Ewing, R.C. (2005). "Solubility of gold in arsenian pyrite." *Geochimica et Cosmochimica Acta* 69(11): 2781–2796.
- Larson, P.B. & Titley, S.R. (1995). "Supergene enrichment of porphyry copper deposits." *Reviews in Economic Geology* 8.

**In the sim:** `scenario_bisbee` (340 steps; full hypogene → supergene cascade).

---

## 2. Tsumeb, Namibia — The Deepest Secondary Suite on Earth

**Locality:** Tsumeb, Otjikoto Region, Namibia. Operated 1907–1996. Vertical pipe-shaped massive-sulfide body in Otavi Group dolomite. Mined to ~1,800 m depth.

**Geological setting:** A Pan-African (~600 Ma) hydrothermal pipe-shaped deposit emplaced in dolostone of the Otavi Group, Damara Belt. The original sulfide pipe was Cu-Pb-Zn-Ag-Ge-As-rich. Subsequent weathering produced ~250 mineral species — more than any other locality on Earth — in 3–5 successive secondary generations. The unusual depth and chemistry of the oxidation profile (driven by descending acidic meteoric fluid encountering rising buffered carbonate fluid from the dolostone host) is what makes Tsumeb paragenetically unique.

**The sequence (top → bottom = primary → late oxidation):**

| Generation | Minerals | Formula | Conditions |
|---|---|---|---|
| **Primary sulfides** | galena, sphalerite, chalcopyrite, tennantite, bornite, germanite | PbS, ZnS, CuFeS₂, (Cu,Fe)₁₂As₄S₁₃, Cu₅FeS₄, Cu₁₃Fe₂Ge₂S₁₆ | Deep, reducing, T 300–400°C; the original ore body |
| **Acid-front oxide gen 1** | anglesite, cerussite, smithsonite, hemimorphite | PbSO₄, PbCO₃, ZnCO₃, Zn₄Si₂O₇(OH)₂·H₂O | Descending acid pulse (pH 3–5) attacks galena → anglesite, sphalerite → smithsonite |
| **Acid-sulfate suite** | jarosite, alunite, brochantite, antlerite, scorodite | KFe₃(SO₄)₂(OH)₆, KAl₃(SO₄)₂(OH)₆, Cu₄SO₄(OH)₆, Cu₃SO₄(OH)₄, FeAsO₄·2H₂O | Peak acidity (pH 1–4); arsenopyrite oxidation → AsO₄³⁻ feeds scorodite |
| **Phosphate / arsenate suite** | pyromorphite, mimetite, adamite, dioptase | Pb₅(PO₄)₃Cl, Pb₅(AsO₄)₃Cl, Zn₂(AsO₄)(OH), CuSiO₃·H₂O | pH recovers to 5–7 as acid neutralizes against dolostone wall |
| **Late carbonates / silicates** | malachite, azurite, dioptase, willemite, plancheite | Cu₂CO₃(OH)₂, Cu₃(CO₃)₂(OH)₂, CuSiO₃·H₂O, Zn₂SiO₄, Cu₈Si₈O₂₂(OH)₄·H₂O | Final neutralized stage; CO₃/SiO₂ from dolostone |

**The driver:** A pH cascade. Tsumeb's secondary suite is layered by *acidity*, not depth. Descending meteoric fluid acidified by sulfide oxidation reaches the deeper sulfide ore body and progressively mobilizes Pb, Zn, Cu, As. The dolostone host wall buffers the fluid back toward neutral; the resulting pH gradient drives different mineral generations to precipitate at different depths and times. Each species has a stability window — galena dissolves in acidic fluid, but cerussite forms only when pH rises past ~5; jarosite forms below pH 3, alunite below pH 4, but both dissolve above pH 5.

**How each step makes the next possible:**

*Primary sulfides → Acid front:* Sulfide oxidation generates H₂SO₄ (FeS₂ + O₂ + H₂O → Fe³⁺ + SO₄²⁻ + H⁺). Without the original sulfide pipe, no acid. The 1km depth of Tsumeb's oxidation profile is directly proportional to how much sulfide there was to oxidize — more sulfide, more acid, deeper attack.

*Acid front → Anglesite / Cerussite:* Acidic descending fluid attacks galena (PbS → Pb²⁺ + dissolved S). Where the fluid is still acidic, anglesite (PbSO₄) precipitates. Where the fluid migrates further from the sulfide source and meets dolostone wall, dolomite buffers pH up: Pb²⁺ + CO₃²⁻ → cerussite (PbCO₃). Same Pb, two destinations, governed by where in the pH gradient the fluid is when it saturates.

*Acid sulfate suite → Phosphate / arsenate suite:* Brochantite, jarosite, alunite need pH 1-4 to form. As the dolostone continues buffering fluid past pH 5, those minerals dissolve. The released Cu²⁺ meets re-arrived AsO₄³⁻ (from arsenopyrite/tennantite oxidation) at higher pH → adamite (Zn-AsO₄), mimetite (Pb-AsO₄). The arsenate suite is literally the dissolution products of the acid sulfate suite, redirected by pH rise.

*Late carbonates and silicates:* By the time the fluid is fully neutralized (pH 7+), Cu²⁺ that's still in solution meets CO₃²⁻ from continued dolostone dissolution → malachite, azurite. SiO₂ that traveled with the meteoric fluid meets remaining Cu²⁺ → dioptase. Tsumeb's late stage is the full neutralization point — the fluid has finally reached chemical equilibrium with its host.

*Reading backward:* without the original deep sulfide pipe, no acid — and without acid, the dolostone wall couldn't be involved. The 250+ species at Tsumeb exist because the meteoric fluid had to traverse a kilometer of pH gradient to reach equilibrium, and every species has its stability window somewhere along that gradient.

**Notable specimens:**
- Cerussite "cyclic twins" — sixling pseudo-hexagonal aggregates, the type-locality habit
- Dioptase emerald-green prisms — Tsumeb's most-collected gem species
- Azurite "Newmont" specimen and other 10+ cm crystals
- Mimetite "campylite" curved-prism Pb-As yellow forms

**Sources:**
- Strunz, H. (1959). *Tsumeb, seine Erze und Sekundärmineralien*. Vienna: Mineralogical Society.
- Gebhard, G. (1999). *Tsumeb II — A Unique Mineral Locality*. GG Publishing.
- Wilson, W.E. (1977). "Tsumeb." *Mineralogical Record* 8(3) — the legendary Tsumeb special issue.
- Wilson, W.E. & Stanley, B. (2010). "Tsumeb!" *Mineralogical Record* 41(4) — the second special issue.
- Lombaard, A.F., Günzel, A., Innes, J., & Krüger, T.L. (1986). "The Tsumeb Lead-Copper-Zinc-Silver Deposit, South West Africa/Namibia." *Mineral Deposits of Southern Africa* 2: 1761–1782.

**In the sim:** `scenario_supergene_oxidation` with 4 ev_supergene_acidification pulses + Al=15 (Round 5 v5 gap-fill).

---

## 3. Mississippi Valley-Type — Tri-State / Sweetwater Viburnum Trend

**Locality:** Two paired districts in the central US Midcontinent.
- **Tri-State** (Missouri / Kansas / Oklahoma): mined 1850s–1970s, ~30M tons Pb+Zn produced. Joplin, MO is the historical center.
- **Sweetwater / Viburnum Trend** (southeast Missouri): St. Francois Mountains region. Active 1960s–present. Doe Run, Buick, Sweetwater mines.

**Geological setting:** Ordovician-Mississippian limestone host rock, intruded during Carboniferous-Permian time by basinal NaCl-CaCl₂ brine migrating up from the Arkoma Basin (Tri-State) and the Reelfoot Rift (Viburnum). Brine carried Pb²⁺ + Zn²⁺ + Ba²⁺ + Sr²⁺ at low concentrations but enormous volumes; mixing with reduced H₂S-bearing pore water in the limestone host triggered metal sulfide precipitation. The economic ore is hosted in karst breccias and bedding-replacement bodies; the deposits are stratabound, not vein-hosted, and form at remarkably low temperatures (60–150°C) — among the coldest hydrothermal ore deposits known.

**The sequence (top → bottom = brine arrival → gangue end):**

| Generation | Minerals | Formula | Conditions |
|---|---|---|---|
| **Brine arrival** | (no minerals — fluid charging stage) | — | NaCl-CaCl₂ brine carrying Pb, Zn, Ba, Sr, F arrives at host limestone |
| **Sulfide pulse** | sphalerite, galena, marcasite, chalcopyrite (minor) | ZnS, PbS, FeS₂ (orthorhombic), CuFeS₂ | Brine meets H₂S-rich connate water; metal sulfides nucleate together at 60–150°C |
| **Fluorite** (Tri-State only — F-rich brine) | fluorite | CaF₂ | Concurrent with sulfides; F²⁻ + Ca²⁺ from brine and dissolved limestone |
| **Sulfate gangue** | barite, celestine | BaSO₄, SrSO₄ | H₂S exhausted; SO₄ persists; Ba and Sr precipitate at the SO₄/H₂S Eh boundary |
| **Carbonate gangue** | dolomite (saddle-rhomb), calcite | CaMg(CO₃)₂, CaCO₃ | Brine cools/evolves; carbonates close out the system |

**The driver:** Mixing exhaustion. The sequence is governed by *what runs out first*. H₂S is the limiting reagent for sulfides; once depleted, the system can't make any more galena or sphalerite no matter how much Pb²⁺ keeps arriving. SO₄²⁻ persists alongside the residual H₂S at low Eh — this Eh boundary is exactly where Ba²⁺ and Sr²⁺ saturate as barite and celestine. The Round 5 v5 gap-fix (O₂ = 0.25 instead of 0.0) put the sim's scenarios at this boundary specifically to enable both sulfide and sulfate generations.

**How each step makes the next possible:**

*Brine arrival → Sulfide pulse:* The basin brine carries Pb²⁺, Zn²⁺, Ba²⁺, Sr²⁺ but no S²⁻. The limestone host carries connate H₂S — produced 100+ million years earlier by microbes reducing seawater SO₄²⁻ in buried sediments. When the two fluids mix, metal sulfides supersaturate instantly. The H₂S that took bacteria 100 Ma to make is consumed in days to years.

*Sulfide pulse → Sulfate gangue:* Once H₂S is exhausted, only SO₄²⁻ remains in the brine. Ba²⁺ and Sr²⁺ couldn't precipitate before — Ba/Sr sulfides are unstable, plus the H₂S environment was reducing. Now: Ba²⁺ + SO₄²⁻ → barite. Sr²⁺ + SO₄²⁻ → celestine. The sulfates exist *because* the sulfides used up the H₂S first. They're chemically prevented while H₂S is around.

*Sulfate gangue → Carbonate gangue:* After barite/celestine, the residual fluid is mostly Ca²⁺ and Mg²⁺ from limestone dissolution (the brine ate some host rock on its way through). At this temperature (~80-150°C) saddle-rhomb dolomite forms first, calcite later as the system cools. The carbonate gangue is the limestone slowly digesting itself in the basin's last act.

*Reading backward:* without microbial sulfate reduction in marine sediments 100+ Ma ago, no H₂S in the connate water. Without H₂S in the limestone, no sulfide precipitation when the brine arrives. Without sulfide precipitation consuming the H₂S, no sulfates (Ba/Sr can't precipitate as sulfides). Without sulfates depleting the metals/Ba/Sr, no clean carbonate gangue at the end. Each step depends on the previous having run to exhaustion — the cascade is reagent-by-reagent draining.

**Notable specimens:**
- Tri-State galena cubes to 25 cm + sphalerite "ruby jack" cherry-red transparent crystals
- Sweetwater barite "amber gold" tabular crystals + cockscomb crests
- Joplin sphalerite "bumblebee" yellow-and-purple zoned crystals (Mn-rich late phase)

**Sources:**
- Sverjensky, D.A. (1981). "The origin of a Mississippi Valley-type deposit in the Viburnum Trend, southeast Missouri." *Economic Geology* 76(7): 1848–1872.
- Stoffell, B., Wilkinson, J.J., & Jeffries, T.E. (2008). "Metal transport and deposition in hydrothermal veins revealed by 213nm UV laser ablation microanalysis of single fluid inclusions." *American Journal of Science* 308: 533–579.
- Anderson, G.M. & Macqueen, R.W. (1982). "Ore Deposit Models — 6. Mississippi Valley-Type Lead-Zinc Deposits." *Geoscience Canada* 9(2): 108–117.
- Hanor, J.S. (2000). "Barite-Celestine Geochemistry and Environments of Formation." *Reviews in Mineralogy and Geochemistry* 40: 193–275.

**In the sim:** `scenario_mvt` (Tri-State) + `scenario_reactive_wall` (Sweetwater Viburnum Trend).

---

## 4. Cruzeiro Pegmatite — Minas Gerais Gem Cascade

**Locality:** Cruzeiro mine, São José da Safira, Doce Valley, Minas Gerais state, Brazil. Within the Eastern Brazilian Pegmatite Province (EBPP), a pegmatite field cutting biotite-schist country rock (Macaúbas Group meta-sediments) at the São Francisco craton margin.

**Geological setting:** A Brasiliano-orogeny (Neoproterozoic, 700–450 Ma) pegmatite intrusion. The pegmatite is a complex zoned, gem-bearing miarolitic (cavity-bearing) type — the inner pocket is where incompatible elements (Be, B, Li, F, Cs, Ta) accumulated in the residual fluid until they reached saturation and crystallized as exotic species. Cruzeiro is the type-locality for gem schorl and elbaite tourmaline, and a major source of aquamarine, morganite, and spodumene (kunzite). Active since the 1940s.

**The sequence (top → bottom = hot 650°C → cool 300°C):**

| Phase | T | Minerals | Formula | Driver |
|---|---|---|---|---|
| **Outer shell** | 650→600°C | microcline, quartz, schorl tourmaline, biotite | KAlSi₃O₈, SiO₂, NaFe₃Al₆(BO₃)₃Si₆O₁₈(OH)₄ | Wall zone crystallization; first to consume Fe + early B |
| **Mid-stage** | 550→450°C | beryl family fires (variety dispatch by chromophore: emerald if Cr/V > threshold; morganite if Mn > 2; heliodor if Fe > 15 + oxidizing; aquamarine if Fe > 8 + reducing; goshenite if no chromophore) | Be₃Al₂Si₆O₁₈ + traces | Be is the most incompatible common element; saturates only after all other phases consume their elements |
| **Mid-stage continues** | 500→400°C | spodumene (Li-Al pyroxene; varieties triphane / kunzite / hiddenite) | LiAlSi₂O₆ | Li reaches threshold |
| **Albitization event** | 450°C | albite/cleavelandite replacing microcline; schorl → elbaite tourmaline shift | NaAlSi₃O₈, Na(Li,Al)₃Al₆(BO₃)₃Si₆O₁₈(OH)₄ | K/Na ratio in residual fluid inverts as K-feldspar consumed; concurrent Fe → Li shift in tourmaline |
| **Late hydrothermal** | 400→300°C | topaz, lepidolite, apatite, accessory cassiterite + tantalite | Al₂SiO₄(F,OH)₂, K(Li,Al)₃(Al,Si)₄O₁₀(OH,F)₂, Ca₅(PO₄)₃(F,Cl,OH) | F survives long enough to clear topaz threshold; Li + Al → mica forms; remaining P → apatite |
| **Goethite (rare)** | <300°C | goethite | FeO(OH) | Late oxidation of any remaining Fe-sulfides |

**The driver:** Cooling + concentration. Unlike the other three cascades (which are driven by oxidation, acid attack, or fluid mixing), Cruzeiro is governed by *thermal differentiation*. As the pegmatite melt cools, common elements crystallize first into the outer shell; rare-element-saturated residual fluid migrates inward to the gem pocket. The rarer the element, the later it precipitates — beryl waits longer than feldspar because Be is more incompatible; topaz waits longer than beryl because F survives even further into the cooling history. By the time the rarest phases fire, the residual fluid has been concentrating Be, Li, B, F for thousands of years — which is why beryl crystals at Cruzeiro can reach 1+ meter (Itatiaia mine giant aquamarine: 110 cm × 38 cm).

**How each step makes the next possible:**

*Outer shell → Mid-stage:* Microcline + quartz crystallize first at high temperature (650→600°C) and consume most of the K, Si, Al. The residual fluid's composition shifts: incompatible elements (Be, Li, B, F, Cs) that didn't fit into feldspar/quartz lattices accumulate. Beryl can't form until residual Be reaches saturation — which only happens AFTER feldspar and quartz have crystallized enough to remove competitors and fluid volume. Beryl exists because everything else crystallized first.

*Mid-stage → Albitization:* Continued quartz crystallization consumes Si. Microcline crystallization consumes K. The residual fluid's K/Na ratio inverts — Na becomes dominant. Now Na-feldspar (albite) becomes thermodynamically favored over K-feldspar (microcline), and existing microcline starts dissolving. Tourmaline shifts the same way: schorl (Fe-rich) gives way to elbaite (Li-rich) because Fe was eaten by earlier schorl + biotite while Li (incompatible) accumulated.

*Mid-stage → Spodumene:* Li reaches saturation later than Be. Spodumene fires AFTER beryl because Li accumulates more slowly than Be in the residual. Both are incompatible — Be just gets there first.

*Late hydrothermal → Topaz:* F is even more incompatible than Be or Li. Most pegmatite minerals carry no F, so it accumulates in residual fluid for the entire cooling history. By the time T drops to ~360°C, F has built up enough to clear topaz threshold, and Al + Si are still around. Topaz forms LAST because nothing wanted F until topaz did.

*Reading backward:* without quartz consuming Si throughout the cooling, the residual K/Na ratio doesn't shift, and no albitization. Without earlier schorl removing Fe, no Li-rich elbaite. Without later beryl removing Be, no spodumene (the two compete for the same residual fluid; Be saturates first and dominates while it's around). The whole pegmatite is a chain of "first one crystallizes, removing its element, which raises the relative concentration of the next, which then crystallizes, removing ITS element..." — concentration-by-removal, governed by which element is least wanted by the major rock-forming minerals.

**Notable specimens:**
- Cruzeiro schorl tourmaline → elbaite color-zoned crystals to 30 cm (the "watermelon tourmaline" type-locality habit)
- Aquamarine "Santa Maria" deep-blue prisms 20+ cm (also from Pakistan Shigar; same paragenetic class)
- Kunzite blade tabular crystals to 20 cm
- Imperial topaz at neighboring Ouro Preto (different scenario but same paragenetic class — F-survival cascade)

**Sources:**
- Cassedanne, J.P. (1991). "Tipologia das jazidas brasileiras de gemas." *Boletim do Instituto de Geociências da USP, Publicação Especial* 9: 1–26.
- London, D. (2008). *Pegmatites*. Mineralogical Association of Canada Special Publication 10. (The standard reference for pegmatite geochemistry.)
- Černý, P. (2002). "Mineralogy of beryllium in granitic pegmatites." *Mineralogical Magazine* 66(6): 887–907.
- Roda-Robles, E., Pesquera, A., Gil-Crespo, P.P., & Torres-Ruiz, J. (2015). "Geochemistry of rare-element granitic pegmatites." *Ore Geology Reviews* 69: 71–93.
- Morteani, G., Preinfalk, C., & Horn, A.H. (2002). "Classification and mineralization potential of the pegmatites of the Eastern Brazilian Pegmatite Province." *Mineralium Deposita* 37: 393–414.

**In the sim:** `scenario_gem_pegmatite` (Cruzeiro). Also `scenario_radioactive_pegmatite` for the U-bearing variant; `scenario_ouro_preto` for the F-rich Ouro Preto topaz cascade.

---

## Cross-cutting framing for the pamphlet set

Each cascade is governed by a different physical driver:

| Pamphlet | Primary driver | Secondary axis | Reading direction |
|---|---|---|---|
| Bisbee | Redox (O₂ infiltration) | Depth | Deep → shallow |
| Tsumeb | pH (acid attack + carbonate buffer) | Depth + time | Primary → late oxide |
| MVT | Mixing exhaustion (what runs out first) | Time | Brine arrival → gangue end |
| Cruzeiro | Cooling + concentration | Temperature | 650°C hot → 300°C cool |

If you want the four pamphlets to read as a series, you can subtitle them by driver type:

- **Bisbee — A redox cascade**
- **Tsumeb — A pH cascade**
- **MVT — An abundance cascade**
- **Cruzeiro — A cooling cascade**

That framing lets a reader stack the four side-by-side and see paragenesis as a general phenomenon with multiple chemical drivers, not just "minerals form in order."

---

## Generic visual anchors for any pamphlet

Color suggestions for the paragenesis column bands (matching the in-game palette so the printed pamphlet reads alongside the live sim):

- **Sulfides** (galena, sphalerite, pyrite, chalcopyrite): metallic grays / brassy yellows (#a0a0a0, #cc8844, #c8b830, #c89830)
- **Oxides** (cuprite, hematite, tenorite): deep reds / browns (#b04040, #8a2020)
- **Carbonates** (calcite, malachite, azurite, smithsonite): warm whites / greens / blues (#f0e8d8, #2e8b57, #2e5fb8, #88bbcc)
- **Sulfates** (barite, celestine, brochantite, anglesite): pale ambers / pale blues (#eb137f, #a4c8e0, #3a7c4f)
- **Arsenates / phosphates** (scorodite, adamite, mimetite, pyromorphite): pale blue-greens / yellows / oranges (#5a9a8a, #bbcc33, #eebb44, #44aa66)
- **Native metals** (Au, Cu): gold / orange-red (#d4a843, #c46038)
- **Silicates / pegmatite phases** (beryl, tourmaline, topaz): mineral-specific (emerald #2e8b57, aquamarine #7fb8d4, morganite #eb6b9e, heliodor #eed858, schorl #1a1a1a, imperial topaz #d97824)

---

🪨
