// ============================================================
// js/39a-supersat-amphibole.ts — supersaturation methods for amphibole
// ============================================================
// AMPHIBOLE SUPERGROUP — double-chain inosilicates (Si4O11 strips
// crosslinked into double chains, with M-cation strips between).
// Hawthorne FC et al. (2012) "Nomenclature of the amphibole supergroup."
// American Mineralogist 97:2031-2048 — IMA-CNMNC canonical nomenclature
// with 5 chemical groups + ~100 named endmember species globally.
//
// v116 ships the COMMERCIAL ASBESTOS quintet — the WHO-recognized
// fibrous-amphibole asbestos family (chrysotile, the serpentine asbestos,
// already shipped v114 as the sixth):
//
//   tremolite      Ca2Mg5Si8O22(OH)2          — calcic amphibole;
//                                                tremolite-asbestos is
//                                                the chrysotile-asbestos
//                                                contaminant at Jeffrey
//                                                Mine (more carcinogenic
//                                                than chrysotile per WHO)
//   actinolite     Ca2(Mg,Fe)5Si8O22(OH)2     — calcic Fe-end of trem-act
//                                                series; nephrite-jade
//                                                variety when compact
//                                                felted-fibrous
//   anthophyllite  (Mg,Fe)7Si8O22(OH)2        — orthorhombic anthophyllite,
//                                                ultramafic-host serpentinite-
//                                                gneiss-pegmatite settings;
//                                                Finland + Carolina type
//   amosite        ~(Fe,Mg)7Si8O22(OH)2       — "brown asbestos";
//                                                cummingtonite-grunerite
//                                                asbestiform variety,
//                                                South Africa Penge type
//   crocidolite    Na2Fe2+3Fe3+2Si8O22(OH)2  — "blue asbestos";
//                                                riebeckite asbestiform
//                                                variety, BIF-hosted at
//                                                Wittenoom Australia +
//                                                Northern Cape SA
//
// Five-of-six WHO commercial-asbestos minerals (chrysotile is the
// serpentine sixth, shipped v114). All five amphibole engines support
// asbestiform habit dispatch via the grow engine; the supersat layer
// only gates on chemistry + T/pH.
//
// Tiger's eye (chalcedony pseudomorph after crocidolite — the famous
// gold-brown chatoyant gemstone variety) ships in the silicate class
// (js/39/59/89), NOT here. Tiger's eye is structurally chalcedony
// (microcrystalline SiO2) preserving the crocidolite fiber-bundle
// pseudomorph; engine reads crocidolite_dissolving substrate.
//
// REFERENCES:
//   * Hawthorne FC et al. (2012) Am. Min. 97:2031 — IMA nomenclature
//   * Hawthorne FC & Oberti R (2007) "Classification of the amphiboles."
//     Reviews in Mineralogy 67:55-88
//   * Veblen DR & Wylie AG (1993) "Mineralogy of amphiboles and 1:1
//     layer silicates" Reviews in Mineralogy 28:61 — asbestos overview
//   * WHO (1986/2014) Asbestos and other natural mineral fibres
//     monographs — health context
//   * Frank DR et al. (2002) Mineralogy of Australian Wittenoom +
//     Hamersley crocidolite

Object.assign(VugConditions.prototype, {

  // TREMOLITE Ca2Mg5Si8O22(OH)2 — calcic amphibole; tremolite-asbestos
  // is the documented Jeffrey Mine chrysotile contaminant per WHO 1986.
  // Forms in: metamorphism of impure dolomite (skarn — Manitoba +
  // Lake Baikal + Italian Alps), rodingite contacts (Jeffrey + Cassiar),
  // talc deposits (the documented health concern). Asbestiform variety
  // when growth occurs in narrow fractures with high-σ persistence;
  // bladed/columnar when in open crystallization volume.
  supersaturation_tremolite() {
    if (this.fluid.Ca < 60 || this.fluid.Mg < 50 || this.fluid.SiO2 < 250) return 0;
    if (this.temperature < 200 || this.temperature > 700) return 0;
    if (this.fluid.pH < 7.0 || this.fluid.pH > 12.0) return 0;
    // Fe > 50 routes toward actinolite end-member
    if (this.fluid.Fe > 60) return 0;
    const ca_f = Math.min(this.fluid.Ca / 200.0, 2.0);
    const mg_f = Math.min(this.fluid.Mg / 150.0, 2.0);
    const si_f = Math.min(this.fluid.SiO2 / 400.0, 1.5);
    let sigma = ca_f * mg_f * si_f;
    // T sweet spot 350-550°C (skarn + rodingite prograde)
    const T = this.temperature;
    if (T >= 350 && T <= 550) sigma *= 1.3;
    else if (T < 350) sigma *= Math.max(0.4, (T - 200) / 150 + 0.4);
    else sigma *= Math.max(0.4, 1.0 - (T - 550) / 150);
    // pH sweet spot 8.5-11 (alkaline metasomatic)
    const pH = this.fluid.pH;
    if (pH >= 8.5 && pH <= 11.0) sigma *= 1.2;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(pH - 9.75) * 0.3);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'tremolite');
    return Math.max(sigma, 0);
  },

  // ACTINOLITE Ca2(Mg,Fe)5Si8O22(OH)2 — Fe-bearing intermediate of
  // the tremolite-actinolite series. Green default color from Fe2+
  // crystal-field absorption. Greenschist-facies metamorphic +
  // hydrothermal alteration. Nephrite-jade variety when compact felted-
  // fibrous (the Maori pounamu + Chinese imperial jade).
  supersaturation_actinolite() {
    if (this.fluid.Ca < 60 || this.fluid.Mg < 30 || this.fluid.Fe < 30 || this.fluid.SiO2 < 250) return 0;
    if (this.temperature < 200 || this.temperature > 700) return 0;
    if (this.fluid.pH < 6.0 || this.fluid.pH > 11.0) return 0;
    const ca_f = Math.min(this.fluid.Ca / 180.0, 2.0);
    const mg_f = Math.min(this.fluid.Mg / 80.0, 2.0);
    const fe_f = Math.min(this.fluid.Fe / 60.0, 2.0);
    const si_f = Math.min(this.fluid.SiO2 / 400.0, 1.5);
    let sigma = ca_f * mg_f * fe_f * si_f;
    // T sweet spot 300-500°C (greenschist-facies)
    const T = this.temperature;
    if (T >= 300 && T <= 500) sigma *= 1.3;
    else if (T < 300) sigma *= Math.max(0.4, (T - 200) / 100 + 0.4);
    else sigma *= Math.max(0.4, 1.0 - (T - 500) / 200);
    // pH sweet spot 7-10
    const pH = this.fluid.pH;
    if (pH >= 7.0 && pH <= 10.0) sigma *= 1.2;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(pH - 8.5) * 0.3);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'actinolite');
    return Math.max(sigma, 0);
  },

  // ANTHOPHYLLITE (Mg,Fe)7Si8O22(OH)2 — orthoamphibole, NO Ca.
  // Ultramafic + serpentinite-gneiss-pegmatite settings; commonly
  // ASBESTIFORM (the "anthophyllite asbestos" of commerce). Type-
  // Finland (Kongsberg + Falun), Carolina + Georgia USA, Cyprus
  // ophiolite + ultramafic. Discriminator from tremolite: NO Ca;
  // higher Mg+Fe instead.
  supersaturation_anthophyllite() {
    if (this.fluid.Mg < 80 || this.fluid.Fe < 30 || this.fluid.SiO2 < 250) return 0;
    if (this.temperature < 250 || this.temperature > 650) return 0;
    if (this.fluid.pH < 7.0 || this.fluid.pH > 11.0) return 0;
    // Ca > 80 routes to tremolite/actinolite (calcic amphibole wins)
    if (this.fluid.Ca > 80) return 0;
    const mg_f = Math.min(this.fluid.Mg / 200.0, 2.0);
    const fe_f = Math.min(this.fluid.Fe / 80.0, 2.0);
    const si_f = Math.min(this.fluid.SiO2 / 400.0, 1.5);
    let sigma = mg_f * fe_f * si_f;
    // T sweet spot 350-550°C
    const T = this.temperature;
    if (T >= 350 && T <= 550) sigma *= 1.3;
    else if (T < 350) sigma *= Math.max(0.4, (T - 250) / 100 + 0.4);
    else sigma *= Math.max(0.4, 1.0 - (T - 550) / 100);
    const pH = this.fluid.pH;
    if (pH >= 8.5 && pH <= 10.5) sigma *= 1.2;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(pH - 9.5) * 0.3);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'anthophyllite');
    return Math.max(sigma, 0);
  },

  // AMOSITE (Fe,Mg)7Si8O22(OH)2 — cummingtonite-grunerite asbestiform
  // variety. "BROWN ASBESTOS." South Africa Penge (Transvaal) is the
  // type, also Cape Province + Witbank. Fe-dominant cummingtonite. The
  // mineralogical literature uses "amosite" specifically for the
  // ASBESTIFORM commercial variety; non-asbestiform cummingtonite is
  // a different mineralogical name. We ship the asbestiform variant
  // here under "amosite" since that's the WHO-recognized commercial
  // name. Discriminator: high Fe (Fe > Mg typical), no Ca, no Na.
  supersaturation_amosite() {
    if (this.fluid.Fe < 100 || this.fluid.SiO2 < 250) return 0;
    if (this.temperature < 200 || this.temperature > 500) return 0;
    if (this.fluid.pH < 6.0 || this.fluid.pH > 10.0) return 0;
    // Mg too high routes to anthophyllite; Ca too high routes to actinolite
    if (this.fluid.Ca > 80) return 0;
    // Fe must dominate over Mg (Fe/Mg > 1.5)
    if (this.fluid.Mg > 0 && this.fluid.Fe < this.fluid.Mg * 1.2) return 0;
    const fe_f = Math.min(this.fluid.Fe / 150.0, 2.5);
    const si_f = Math.min(this.fluid.SiO2 / 400.0, 1.5);
    let sigma = fe_f * si_f;
    // T sweet spot 300-450°C
    const T = this.temperature;
    if (T >= 300 && T <= 450) sigma *= 1.3;
    else if (T < 300) sigma *= Math.max(0.4, (T - 200) / 100 + 0.4);
    else sigma *= Math.max(0.4, 1.0 - (T - 450) / 100);
    const pH = this.fluid.pH;
    if (pH >= 7.5 && pH <= 9.5) sigma *= 1.2;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(pH - 8.5) * 0.3);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'amosite');
    return Math.max(sigma, 0);
  },

  // CROCIDOLITE Na2Fe2+3Fe3+2Si8O22(OH)2 — "BLUE ASBESTOS." Riebeckite
  // asbestiform variety. BIF-hosted (banded-iron-formation): Wittenoom
  // + Hamersley + Mount Brockman Western Australia; Northern Cape SA
  // (Mt. Brockman is the type for the chatoyant variety that produces
  // tiger's eye via supergene oxidation). Crocidolite is the most
  // carcinogenic of the asbestos minerals (Frank et al. 2002; lawsuits
  // closed the Wittenoom town in 1966). The most distinctive color
  // in the family: deep blue to lavender-blue to slate-blue; partial
  // oxidation creates "hawk's eye" intermediate (blue-grey-gold).
  // Discriminator: Na + Fe (no Ca, no Mg-dominance).
  supersaturation_crocidolite() {
    if (this.fluid.Na < 30 || this.fluid.Fe < 100 || this.fluid.SiO2 < 200) return 0;
    if (this.temperature < 100 || this.temperature > 400) return 0;
    if (this.fluid.pH < 7.0 || this.fluid.pH > 11.0) return 0;
    // Ca > 50 routes to calcic amphibole
    if (this.fluid.Ca > 50) return 0;
    const na_f = Math.min(this.fluid.Na / 100.0, 2.0);
    const fe_f = Math.min(this.fluid.Fe / 200.0, 2.0);
    const si_f = Math.min(this.fluid.SiO2 / 300.0, 1.5);
    let sigma = na_f * fe_f * si_f;
    // T sweet spot 200-350°C (low-grade BIF metamorphism)
    const T = this.temperature;
    if (T >= 200 && T <= 350) sigma *= 1.3;
    else if (T < 200) sigma *= Math.max(0.4, (T - 100) / 100 + 0.4);
    else sigma *= Math.max(0.4, 1.0 - (T - 350) / 50);
    const pH = this.fluid.pH;
    if (pH >= 8.0 && pH <= 10.0) sigma *= 1.2;
    else sigma *= Math.max(0.5, 1.0 - Math.abs(pH - 9.0) * 0.3);
    if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'crocidolite');
    return Math.max(sigma, 0);
  },
});
