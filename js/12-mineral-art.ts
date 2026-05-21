// ============================================================
// js/12-mineral-art.ts — Mineral art tables
// ============================================================
// MINERAL_ASCII (per-species ASCII art from photos), MINERAL_THUMBS (base64 100×100 thumbnails), MINERAL_GAME_COLORS (per-species tint for game-mode tiles).
//
// Phase B3 of PROPOSAL-MODULAR-REFACTOR. SCRIPT-mode TS (no import/export);
// every top-level declaration is a global available to later modules.

// ASCII art from real specimen photos — one color per mineral
const MINERAL_ASCII = {
  "calcite": ".-.\n                           .=#%@=\n                         -*%%%#%=\n               .....  .=#%%%##%%-\n        ............-+%%%######%- . ..\n    .............:=#%@%#######%%:........\n  .......::::.:-+%@@@@########%#-::::.......\n....:.:::::::=#%%%%%%#########%#------:::....\n..::::::::=*%%%%%%%###########%#--==----::...\n...::----*%@%%%%%%############%#-=====---:::.\n.:::--==+%%%%%%%%%%%%%%#######%*-======----::\n::--====+%%%%%%%%%%%%%%%%%%###%*==========--:\n:----===+%%%%@@@@%%%%%%%%%%#*#%+==========---\n:---==+++%%%%@@%%%%%%%%%#######==========----\n---====++*%%%@@@@@@@@%%%%%%@%%*======------::\n-==-====+=*######***++===----========-=---:::\n-=---======+=....            --========-----:\n===---=====++-   ..   .    .-=--------------:\n==--=--=======...         .-----------------:",
  "fluorite": ":-=++++=--:..\n     .::==+***=-:.                 .\n    .:-=+**#*=-:..                 ..\n  .:-++*##*+-.           ::.         ..\n.:-++***+=:.   :::+**++++**+-::        ..\n.::::::..    -*##****####*#+-:==.       ..\n           :*%##*##**#*#%%#**=-:::        .\n         -*%%%#*#*####**#####*+=---        .\n ..:::--+@%%####*=+###*****#%#**+=-\n..:-+*#%%%#***#+=---+###*###**##**+=.\n::-=**#####+=-==:..::-==+*#*+**##**++.\n:-=+****##*=-:...      .:+#*****##***+:   .\n--==+******+-.       ....-==+**++*#*+**+-:-\n-=: .##**++-:::.  ....    .::=+++++++****#- .\n-:   :%@%%+-...:.:-:.......-::-**+=++++*+=:..\n:.....-*+=-::....::... .......:=*++***+++:::.\n-.  .::: ....   ............:--+++***+=-.:-::\n:         .             ..:-=+++===:::.  ::::\n:.                ..       :::...:. ..  .-:::\n:-:::..           +=-+:       .... .:.  .=:::",
  "quartz": "                +=.\n              *@@%#=\n             *@%%%%@%*:\n            +@%%%%%%%@@#=.\n           -@%%%%%%%%%%@@%+.\n           #%%%%%%%%%%%%%%@@+\n          .%%%%%%%%%%%%%%%%%@#\n           +%%%%%%%%%#%%%%%%%\u2588+\n           .%#%#%%%%####%%%%%@#\n            -%#%%%%%%%##%%%%%@%\n             +%#%%%%%%##%%%%%@#\n      . ......#%###%####%%%%%@%+:\n            . :########%%%%%%%%@@#=:\n               =%#######%%%%%%%%%%%%#=\n                +%####%#%%%###%###%%*-.\n                :*****####%####=-==-....\n                ---==+####*+=:      .....\n                    .:----:. ....::......\n                          ....:..:........",
  "malachite": ":-..:: :-=+*=-.:-=:.---++=====----..\n   .:::-----::---::::-==-++**+===--=+=-==-:\n  .====--::--==---=====+==+==+++-:=++*++===-.\n  =------::::-====--=-=**++*++++=-====:-***#*\n ---=---:::::---=-..-==***#*++-:=+**##+==****\n----=-::::--=++****-:=+*****#= -+**####*-.--:\n==-:::-==++****#*#+=+**##*###- :-==++++++=+*+\n--:--=+*******++++==*#**+****- -==**####%%###\n::-+++*****+=====**++++++*+-----=++###%######\n-=**++***++=-=++++++***###*.:-:=+++**++**###%\n++++*+====+---::=+**#*####%*...-+*#**+===+###\n+++==---==-. :=+***#*####%%%- .-=++++***#***#\n**+=-==:.   .-=+****#####%##-.:=++*+******#%%\n-==+++- :--:.:-=****#*#####*-:-+++#*+**#*%%%#\n=+**+::++==+===-++*###**++*+..-=++++++*###**+\n+===----=-===+++=+=+++==+**: ..-==++++++++=++\n--=-:::=---=*===+==--==++*-  :::-=+====*=++==\n:--:::-=::-+*+++===+-===+-      .=+==-:==-==-\n--:..:--:-=+==+========+=:.:.    ..:-=::==-:-\n-::...:-.-+*=---======+=+=:--:.     :--:::-::"
};

// Real specimen photos (Professor's collection) — base64 thumbnails, 100×100px
const MINERAL_THUMBS = {
  calcite: "photos/thumbs/calcite.jpg",
  fluorite: "photos/thumbs/fluorite.jpg",
  quartz: "photos/thumbs/quartz.jpg",
  malachite: "photos/thumbs/malachite.jpg"
};

// Game colors for each mineral (used in charts, inventory tinting)
const MINERAL_GAME_COLORS = {
  quartz: '#e8e8e8', calcite: '#ffd699', fluorite: '#b088dd',
  pyrite: '#c8b830', chalcopyrite: '#c89830', galena: '#a0a0a0', molybdenite: '#707888',
  hematite: '#b04040', malachite: '#2e8b57', sphalerite: '#cc8844',
  goethite: '#8b6914', uraninite: '#44dd44', smithsonite: '#88bbcc',
  wulfenite: '#ff8833', ferrimolybdite: '#f5dc14', arsenopyrite: '#c8c0b8', scorodite: '#5a9a8a', selenite: '#e8e0d8', barite: '#eb137f', celestine: '#a4c8e0', jarosite: '#dcb43c', alunite: '#f0e0d8', brochantite: '#3a7c4f', antlerite: '#2a6038', anhydrite: '#d8d0c8', feldspar: '#f0d0b0',
  emerald: '#2e8b57', aquamarine: '#7fb8d4', morganite: '#eb6b9e', heliodor: '#eed858',
  corundum: '#c8c8c8', ruby: '#c03030', sapphire: '#304068',
  acanthite: '#404040', argentite: '#303030', native_silver: '#d4d4d4',
  native_arsenic: '#888888', native_sulfur: '#f5d030', native_tellurium: '#b8b8c8',
  nickeline: '#d49080', millerite: '#c8b860', cobaltite: '#d8d4cc',
  descloizite: '#8a3020', mottramite: '#8a9a40',
  raspite: '#d4b840', stolzite: '#d49a30', olivenite: '#5a7030',
  chalcanthite: '#2a40c8',
  rosasite: '#5a8a8e', aurichalcite: '#9ec8c0',  // Round 9a — Cu-blue-green & Zn-pale-green
  torbernite: '#3a8e3a', zeunerite: '#5aa040',   // Round 9b — emerald-green uranyl phosphate/arsenate
  carnotite: '#e8d040',                          // Round 9c — canary-yellow uranyl vanadate (K-cation)
  autunite: '#f0e045',                           // Round 9d — bright lemon-yellow uranyl phosphate (Ca-cation, FL apple-green)
  uranospinite: '#e8d850',                       // Round 9e — yellow uranyl arsenate (Ca-cation, FL bright yellow-green)
  tyuyamunite: '#e0c838'                         // Round 9e — canary-yellow uranyl vanadate (Ca-cation, FL weak yellow-green)
};

// Derive crystal color from its growth history and chemistry
function crystalColor(crystal) {
  if (!crystal || !crystal.zones || !crystal.zones.length) {
    return MINERAL_GAME_COLORS[crystal?.mineral] || '#d4a843';
  }

  const n = crystal.zones.length;
  const avgFe = crystal.zones.reduce((s, z) => s + (z.trace_Fe || 0), 0) / n;
  const avgMn = crystal.zones.reduce((s, z) => s + (z.trace_Mn || 0), 0) / n;
  const avgTi = crystal.zones.reduce((s, z) => s + (z.trace_Ti || 0), 0) / n;
  const avgAl = crystal.zones.reduce((s, z) => s + (z.trace_Al || 0), 0) / n;
  const fiCount = crystal.zones.filter(z => z.fluid_inclusion).length;
  const fiRatio = fiCount / n;
  const radDmg = crystal.radiation_damage || 0;

  switch (crystal.mineral) {
    case 'quartz':
      // Smoky: radiation damage (Al color centers)
      if (radDmg > 0.6) return '#3a2a1a'; // dark smoky
      if (radDmg > 0.3) return '#6b5040'; // smoky
      // Amethyst: Fe³⁺ + some radiation
      if (avgFe > 3 && radDmg > 0.1) return '#9966cc'; // amethyst
      // Milky: dense fluid inclusions from rapid growth
      if (fiRatio > 0.4) return '#e8ddd0'; // milky white
      // Citrine: Fe³⁺ (heated amethyst conditions)
      if (avgFe > 5 && crystal.zones.some(z => z.temperature > 350)) return '#e6a820';
      // Rose: Ti + Mn traces (rare)
      if (avgTi > 0.5 && avgMn > 1) return '#dda0a0';
      // Clear/rock crystal
      return '#e8e8e8';

    case 'calcite':
      // Pink: Co traces (not tracked, use high Mn + low Fe)
      if (avgMn > 5 && avgFe < 1) return '#e8a0b0';
      // Amber/honey: Mn²⁺ activator
      if (avgMn > 2) return '#d4a040';
      // Brown: high Fe
      if (avgFe > 5) return '#a08050';
      // Clear/white
      return '#f0e8d8';

    case 'fluorite':
      // Purple: Mn or radiation-induced color centers
      if (avgMn > 1 || radDmg > 0.1) return '#b088dd';
      // Green: REE (approximate via low Fe + moderate Ca environment)
      if (avgFe < 2 && avgMn < 1) return '#44bb88';
      // Yellow: O vacancies from radiation
      if (radDmg > 0.05) return '#ddcc44';
      // Blue: trace Ca excess
      if (avgFe < 1) return '#88aadd';
      // Deep purple: high Mn
      if (avgMn > 3) return '#7744aa';
      return '#b088dd';

    case 'pyrite':
      return '#c8b830'; // always brassy

    case 'chalcopyrite':
      return '#c89830'; // brassy with Cu tarnish potential

    case 'galena':
      return '#a0a0a0'; // lead gray

    case 'molybdenite':
      return '#707888'; // bluish-gray metallic

    case 'hematite':
      // Specular: well-crystallized
      if (crystal.c_length_mm > 2) return '#8a2020'; // deep red
      return '#b04040';

    case 'malachite':
      // Darker with more Cu
      return '#2e8b57';

    case 'sphalerite':
      // 2026-05-21 (v121) — manganoan sphalerite ("manganblende") pink
      // hue at high Mn / low Fe. Mn²⁺ substitutes Zn²⁺ up to ~3 mol%;
      // Cook & Ciobanu 2007 Joplin specimens shift from honey-amber to
      // salmon-pink as Mn climbs. Threshold matches the v119 trace_Mn
      // partition (0.05): zone Mn fluid ~30+ ppm → trace_Mn 1.5+ →
      // salmon-pink branch.
      if (avgMn > 1.5 && avgFe < 3) return '#d8a888';   // salmon-pink manganoan sphalerite
      if (avgMn > 0.8 && avgFe < 5) return '#d4998a';   // pink-tinted honey
      // Iron-rich (marmatite): dark
      if (avgFe > 10) return '#553322';
      // Clean: honey/amber
      if (avgFe < 3) return '#ddaa44';
      return '#cc8844';

    case 'wurtzite':
      // v121 — same Mn-substitution family as sphalerite; hexagonal
      // dimorph shows comparable pink tones at Mn-substituted variants.
      if (avgMn > 1.5 && avgFe < 4) return '#cc998a';
      if (avgFe > 10) return '#4a2818';
      return '#a07050';   // default warm brown (hex ZnS)

    case 'barite':
      // v121 — per-zone Mn²⁺ banding (Putnis & Perthuisot 2001). Barite is
      // THE textbook Mn-banded sulfate; TN457 Cumbria specimen pink color
      // is Mn²⁺ activation. v118 fix wired trace_Mn capture on growth
      // zones; this branch reads it for the zone-bar visualizer + 3D
      // averaged tint. Partition is 0.0015 (matches calcite); fluid Mn
      // 30+ ppm → trace_Mn 0.045 → pink branch.
      if (avgMn > 0.08) return '#e85a8c';            // saturated bonbon pink (high Mn pulse)
      if (avgMn > 0.04) return '#ec7ba0';            // mid pink (TN457 typical)
      if (avgMn > 0.02) return '#f0a0bb';            // pale pink
      if (avgFe > 3) return '#e8a85c';               // honey-yellow (Cumberland Pb/Fe variant)
      if (radDmg > 0.3) return '#a08abb';            // smoky/blue-shifted (rare radiation-affected)
      return '#f5d6e3';                              // white-cream default

    case 'goethite':
      return '#8b6914';

    case 'smithsonite':
      // v121 — Tsumeb "bonbon pink" Mn²⁺ branch. Gebhard & Schubnel 1999
      // documents the Mn-bearing variety as one of three diagnostic Tsumeb
      // smithsonite aesthetics (alongside apple-green Cu + sky-blue default).
      // v119 wired trace_Mn capture; partition 0.05 → zone fluid Mn 20+ ppm
      // → trace_Mn 1+ → pink branch.
      if (avgMn > 1.0) return '#e89aaa';                      // bonbon pink (Tsumeb cabinet)
      if (avgMn > 0.5) return '#dcaab6';                      // pale pink
      // Apple-green (Cu trace) — fluid Cu chromophore for the Tsumeb green variety
      if (crystal.zones.some(z => z.trace_Cu > 1)) return '#88cc88';
      // Blue-green (Cu):
      if (crystal.zones.some(z => z.trace_Fe > 2)) return '#88aa88';
      return '#88bbcc';

    case 'feldspar':
      // Color depends on polymorph and trace elements
      const display = crystal.mineral_display || '';
      // Amazonite: microcline with Pb
      if (display === 'microcline' && crystal.zones.some(z => z.note && z.note.includes('amazonite'))) {
        return '#44bb88'; // green
      }
      // Pink orthoclase: Fe inclusions
      if (avgFe > 2) return '#e0a8a0'; // pink/salmon
      // Smoky from radiation
      if (radDmg > 0.2) return '#a09080';
      // Sanidine: glassy/colorless
      if (display === 'sanidine') return '#d8d4cc';
      // Albite: white
      if (display === 'albite') return '#e0ddd8';
      // Default: warm cream
      return '#f0d0b0';

    case 'wulfenite':
      return '#ff8833';

    case 'selenite':
      // Water-clear to slightly warm — the moon crystal
      if (fiRatio > 0.3) return '#d8c8a0'; // sand inclusions → desert rose tint
      if (avgFe > 2) return '#d8d0b8'; // slightly yellowish
      return '#e8e0d8'; // classic selenite — translucent warm white

    case 'uraninite':
      return '#44dd44';

    case 'adamite':
      // Cu content determines color — cuproadamite is vivid green
      if (crystal.zones.some(z => z.note && z.note.includes('cuproadamite'))) return '#33cc55';
      if (crystal.zones.some(z => z.note && z.note.includes('weakly fluorescent'))) return '#66bb44';
      return '#bbcc33'; // yellow-green (Cu-free)

    case 'mimetite':
      // Fe-rich = orange-brown campylite, otherwise yellow-orange
      if (crystal.habit && crystal.habit.includes('campylite')) return '#cc7733';
      if (avgFe > 1) return '#ddaa33';
      return '#eebb44'; // classic mimetite yellow

    default:
      return MINERAL_GAME_COLORS[crystal.mineral] || '#d4a843';
  }
}

// Get a display name for the crystal including variety
function crystalDisplayName(crystal) {
  if (!crystal) return 'unknown';
  let name = crystal.mineral;
  
  if (crystal.mineral === 'quartz') {
    const n = crystal.zones.length || 1;
    const avgFe = crystal.zones.reduce((s, z) => s + (z.trace_Fe || 0), 0) / n;
    const fiCount = crystal.zones.filter(z => z.fluid_inclusion).length;
    const fiRatio = fiCount / n;
    const radDmg = crystal.radiation_damage || 0;
    
    if (radDmg > 0.3) name = 'quartz (smoky)';
    else if (avgFe > 3 && radDmg > 0.1) name = 'quartz (amethyst)';
    else if (fiRatio > 0.4) name = 'quartz (milky)';
    else if (avgFe > 5 && crystal.zones.some(z => z.temperature > 350)) name = 'quartz (citrine)';
    else name = 'quartz (rock crystal)';
  }
  
  if (crystal.mineral === 'fluorite') {
    const color = crystalColor(crystal);
    if (color === '#44bb88') name = 'fluorite (green)';
    else if (color === '#ddcc44') name = 'fluorite (yellow)';
    else if (color === '#88aadd') name = 'fluorite (blue)';
    else name = 'fluorite (purple)';
  }

  if (crystal.mineral === 'sphalerite') {
    const n = crystal.zones.length || 1;
    const avgFe = crystal.zones.reduce((s, z) => s + (z.trace_Fe || 0), 0) / n;
    if (avgFe > 10) name = 'sphalerite (marmatite)';
    else if (avgFe < 3) name = 'sphalerite (honey)';
  }

  if (crystal.mineral === 'feldspar') {
    const display = crystal.mineral_display || '';
    if (display === 'microcline' && crystal.zones.some(z => z.note && z.note.includes('amazonite'))) {
      name = 'amazonite';
    } else if (display) {
      name = display;
    }
  }

  if (crystal.mineral === 'selenite') {
    if (crystal.habit === 'rosette') name = 'selenite (desert rose)';
    else if (crystal.habit && crystal.habit.includes('fibrous')) name = 'selenite (satin spar)';
    else if (crystal.c_length_mm > 5) name = 'selenite (cathedral)';
    else name = 'selenite';
  }

  return name;
}

// Build a mineral thumbnail HTML element (photo with crystal-specific color tint overlay)
function mineralThumbHTML(mineral, size, crystal) {
  size = size || 60;
  const src = MINERAL_THUMBS[mineral];
  // Use crystal-specific color if crystal provided, otherwise fall back to species color
  const color = crystal ? crystalColor(crystal) : (MINERAL_GAME_COLORS[mineral] || '#d4a843');
  if (!src) {
    // No photo yet — colored placeholder square
    return `<div style="width:${size}px;height:${size}px;border-radius:4px;background:${color}22;border:1px solid ${color}44;display:flex;align-items:center;justify-content:center;font-size:${size*0.4}px;flex-shrink:0" title="${mineral}">💎</div>`;
  }
  return `<div style="width:${size}px;height:${size}px;border-radius:4px;overflow:hidden;position:relative;flex-shrink:0;border:1px solid ${color}44" title="${mineral}">
    <img src="${src}" style="width:100%;height:100%;object-fit:cover;filter:grayscale(40%) brightness(0.9);" alt="${mineral}">
    <div style="position:absolute;top:0;left:0;width:100%;height:100%;background:${color};mix-blend-mode:color;opacity:0.5;pointer-events:none"></div>
  </div>`;
}

