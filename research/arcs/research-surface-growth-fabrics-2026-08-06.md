# Surface-growth fabrics: science basis and implementation contract

Date: 2026-08-06
Simulation tranche: SIM 246
Scope: chalcedony/agate linings, hematite and Cu-carbonate crusts, Mn-oxide
coatings, asbestiform mats, and quartz/calcite druse.

## Question

The simulator formerly drew each accepted `Crystal` as one localized specimen.
That is wrong for an aggregate whose natural expression is an areal lining,
crust, mat, or druse. How can the renderer cover a wide part of the vug wall
without multiplying the accepted mass or pretending that every similarly named
mineral has the same fabric?

## Observational constraints

1. **Chalcedony is a wall lining, not one large euhedron.** A Keokuk geode
   study reports that its chalcedony shell occupies most of the geode and is
   pseudofibrous with growth lines. Ametista do Sul geodes show the outward-to-
   inward order celadonite -> chalcedony -> fine quartz -> amethyst. These are
   spatial observations, not merely mineral lists.
2. **Quartz and calcite druse are carpets of individual euhedral terminations.**
   The USGS Montana calcite report describes open spaces lined by calcite
   druses, vug walls bearing drusy clear/semiclear crusts, and growth from the
   walls inward. Ametista's fine quartz layer between chalcedony and large
   amethyst supplies the equivalent silica case.
3. **Azurite and malachite genuinely make areal crusts.** XRD-confirmed
   supergene material from Farbište records azurite as blue coatings and
   crystalline crusts; malachite occurs as coatings/crusts and botryoidal
   aggregates with fibrous interiors.
4. **Hematite can be botryoidal or crustose, but not every hematite is.** The
   Tsumeb mineral record distinguishes black crusts of minute crystals and
   botryoidal kidney ore from discrete crystal and pseudomorph habits. The
   renderer must follow the selected habit.
5. **“Manganese coating” is not permission to paint pyrolusite everywhere.**
   Potter and Rossman's infrared work found exposed Mn dendrites to be
   romanechite/hollandite-group material, mine dendrites to be todorokite, and
   stream/cave-like deposits commonly to be birnessite; they identified no
   pyrolusite example among the traditional “pyrolusite dendrites.” Post's
   structure review likewise emphasizes fine-grained mixtures and separates
   the layer and tunnel Mn-oxide families. Until those sister species have
   first-class engines, only pyrolusite's own `massive_sooty` and
   `botryoidal_reniform` habits may become broad crusts.
6. **Asbestiform is a habit gate, not a mineral-name shortcut.** The six
   commercial asbestos minerals may form fibrous mats, but tremolite,
   actinolite, and related amphiboles also form non-asbestiform blades or
   compact masses. The catalog's Hawthorne et al. amphibole classification and
   Wicks & Plant serpentine microscopy therefore support a `fibrous` /
   `asbestiform` habit gate. Compact and prismatic selections do not receive
   fiber geometry.

## Model decision

One accepted aggregate remains one `Crystal`. Post-growth classification adds a
physical descriptor only when the persisted nucleation habit and growth vector
support an areal fabric:

| Regime | Qualification | Representation |
|---|---|---|
| `laminated_lining` | chalcedony, agate, or explicit wall-lining habit | overlapping thin wall-parallel patches |
| `botryoidal_crust` | coating vector or genuinely crustose/botryoidal/earthy habit | coalesced wall-parallel lobes |
| `euhedral_druse` | quartz/calcite coating variant, or explicit druse | many small inward-pointing euhedra |
| `fibrous_mat` | one of the six asbestos minerals **and** fibrous/asbestiform habit | locally aligned fiber bundles tangent to the wall |

“Massive” alone does not qualify. A projecting quartz prism, calcite
scalenohedron, tremolite blade, or pyrolusite needle remains a localized body.

Coverage is a bounded maturation of the selected `wall_spread`. The descriptor
derives mean physical thickness from the accepted aggregate volume:

`mean_thickness_mm = Crystal._volume_mm3 / covered_wall_area_mm2`

Therefore `covered_area * mean_thickness` closes exactly to the existing solid
volume ledger. Repeated meshes are representative samples of that aggregate;
they are never inserted into `sim.crystals`, never receive growth zones, and
never consume fluid.

The deterministic golden-angle sampler distributes points over a spherical cap
whose area fraction equals coverage. Desktop renders at most 128 instances;
mobile at most 56. Both show the same physical descriptor and model state, so
LOD cannot change chemistry, mass, chronology, or replay identity.

## Known boundary

The physical thickness calculation uses the mean-diameter spherical area. The
actual wall mesh is irregular and the renderer projects samples onto its local
ring/cell radii, but the simulator does not yet integrate the exact triangle
area of that irregular surface. This is a declared geometry approximation, not
a chemical mass leak.

Birnessite, romanechite/hollandite, and todorokite remain explicit future
mineral-engine work. The visual change must not silently relabel those phases as
pyrolusite.

## Sources

- D. Proust and C. Fontaine (2007), “Amethyst geodes in the basaltic flow from
  Triz quarry at Ametista do Sul,” *Geological Magazine* 144(4), DOI
  [10.1017/S0016756807003457](https://doi.org/10.1017/S0016756807003457).
- W. B. Simmons et al. (2022), “The Extraordinary Variety and Complexity of
  Minerals in a Single Keokuk Geode,” *Minerals* 12, 914,
  [DOI 10.3390/min12070914](https://doi.org/10.3390/min12070914).
- M. Števko, J. Sejkora, and P. Bačík (2011), supergene mineralogy of the
  Farbište occurrence, *Journal of Geosciences* 56, 273-298,
  [paper PDF](https://www.jgeosci.org/content/jgeosci.098_2011_3_stevko.pdf).
- W. C. Stoll and F. C. Armstrong (1958), *Optical Calcite Deposits in Park and
  Sweet Grass Counties, Montana*, USGS Bulletin 1042-M,
  [DOI 10.3133/b1042M](https://doi.org/10.3133/b1042M).
- R. M. Potter and G. R. Rossman (1979), “Mineralogy of manganese dendrites
  and coatings,” *American Mineralogist* 64, 1219-1226,
  [Caltech record](https://authors.library.caltech.edu/records/7yq9y-t1s04).
- J. E. Post (1999), “Manganese oxide minerals: crystal structures and
  economic and environmental significance,” *PNAS* 96, 3447-3454,
  [DOI 10.1073/pnas.96.7.3447](https://doi.org/10.1073/pnas.96.7.3447).
- F. J. Wicks and A. G. Plant (1979), electron-microprobe/TEM study of
  serpentine minerals, *Canadian Mineralogist* 17, 785-830; and F. C.
  Hawthorne et al. (2012), “Nomenclature of the amphibole supergroup,”
  *American Mineralogist* 97, 2031-2048. These are already the catalog's
  identity/habit authorities for the asbestos set.
