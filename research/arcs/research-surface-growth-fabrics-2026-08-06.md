# Surface-growth fabrics: science basis and implementation contract

Date: 2026-08-06; implementation closure updated 2026-08-07
Simulation tranche: SIM 246, exact-area/Mn-family closure in SIM 249,
hostile-review exactness closure in SIM 250
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
   the layer and tunnel Mn-oxide families. SIM 249 implements birnessite,
   Ba-bearing romanechite, and Mg-templated todorokite as first-class booked
   phases. Only pyrolusite's own `massive_sooty` and `botryoidal_reniform`
   habits may become broad pyrolusite crusts.
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
| `dendritic_film` | first-class romanechite/todorokite phase with a persisted dendritic habit | flattened branching skeletons in the local wall tangent plane |

“Massive” alone does not qualify. A projecting quartz prism, calcite
scalenohedron, tremolite blade, or pyrolusite needle remains a localized body.

Coverage is a bounded maturation of the selected `wall_spread`. The descriptor
derives mean physical thickness from the accepted aggregate volume:

`mean_thickness_mm = Crystal._volume_mm3 / covered_wall_area_mm2`

Therefore `covered_area * mean_thickness` closes exactly to the existing solid
volume ledger. Repeated meshes are representative samples of that aggregate;
they are never inserted into `sim.crystals`, never receive growth zones, and
never consume fluid.

The production sampler integrates the exact renderer-consumed irregular-wall
triangles, chooses a contiguous triangle patch around the crystal anchor, and
draws deterministic area-weighted barycentric samples on that patch. The
spherical-cap sampler remains only as a fail-safe when no `WallMesh` exists.
Desktop renders at most 128 instances; mobile at most 56. Both use the same
physical patch, covered area, mass, and canonical inter-layer relief, so LOD
cannot change chemistry, thickness, chronology, replay identity, or the
stratigraphic height of a later coating.

## Closure and remaining boundary

SIM 249 closes the former mean-diameter approximation: `WallMesh` now computes
surface area directly from its indexed triangle geometry, descriptors use that
area, and renderer samples come from the same triangles. A final partial
triangle carries a fractional physical area weight so requested coverage does
not jump by a full coarse triangle. `covered_area * mean_thickness` continues
to close to `Crystal._volume_mm3` exactly.

SIM 250 closes two exactness defects found in hostile review. The shared
mesh/renderer invalidation identity now includes every cell radius rather than
roughly eight cells per ring, so any position-affecting wall edit refreshes
area and patch coordinates. Production `WallCell` setters advance an exact
monotonic geometry revision at mutation time, making cache reads O(1); plain
snapshot/test walls retain an exact all-cell Float64 hash fallback. This keeps
the formerly unsampled-cell regression closed without the scan-on-read draft's
roughly 17x Sabkha replay slowdown. Tooltip paragenesis now intersects the exact
triangle sets selected by `surfacePatch()`; ideal spherical caps are only a
labelled fallback when no WallMesh exists.

Surface layers are sorted by `nucleation_step` and `crystal_id`. A later layer
is offset only on triangles shared with an earlier layer, preventing z-fighting
while preserving explicit paragenesis. The old parent trophy mesh is omitted
for aggregate records, and the representative instanced swath remains
raycastable for tooltips.

The Mn selector is intentionally a constrained kinetic/mineralogical model,
not a full aqueous Mn Pourbaix/speciation solver. Birnessite uses a variable
hydrous formula and books only its framework-limiting Mn rather than inventing
an exact interlayer composition. Romanechite books Ba + Mn; todorokite books Mg
+ Mn. K-rich cryptomelane/hollandite and Pb-rich coronadite remain future
first-class phases; their fields continue to suppress pyrolusite instead of
being mislabeled.

SIM 250 removes the former direct todorokite route. The cited experiments do
not license bare-wall precipitation at room temperature: Golden et al. first
Mg-exchanged birnessite and autoclaved it at 155 °C, while Zhao et al. used
reflux treatment and showed strong dependence on interlayer cations and Mn(III)
state. Production now requires an active, exposed, grown birnessite precursor
in a bounded 95–200 °C window, converts that Crystal in place, preserves every
booked Mn shell, and books exchanged Mg at the proxy formula mass ratio of
1 Mg : 6 Mn. Structural water and Mn(III) ordering remain disclosed model
boundaries rather than invented conserved variables.

The visual contract is now executed against the vendored Three.js module, not
accepted from source-string inspection alone. Tests construct real
`InstancedMesh` objects and assert finite transforms, raycast hits, one scene
representation per booked aggregate, exact shared-triangle layer offsets,
flattened dendrite geometry, and LOD-invariant physical/representative relief.

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
- D. C. Golden, C. C. Chen, and J. B. Dixon (1986), “Synthesis of
  todorokite,” *Science* 231, 717-719,
  [DOI 10.1126/science.231.4739.717](https://doi.org/10.1126/science.231.4739.717).
- H. Zhao et al. (2015), “Formation of todorokite from c-disordered
  H+-birnessites: the roles of average manganese oxidation state and
  interlayer cations,” *Geochemical Transactions* 16, 8,
  [open article](https://pmc.ncbi.nlm.nih.gov/articles/PMC4500857/).
- S. Turner and J. E. Post (1988), “Refinement of the substructure and
  superstructure of romanechite,” *American Mineralogist* 73, 1155-1161,
  [paper PDF](https://rruff.geo.arizona.edu/doclib/am/vol73/AM73_1155.pdf).
- F. J. Wicks and A. G. Plant (1979), electron-microprobe/TEM study of
  serpentine minerals, *Canadian Mineralogist* 17, 785-830; and F. C.
  Hawthorne et al. (2012), “Nomenclature of the amphibole supergroup,”
  *American Mineralogist* 97, 2031-2048. These are already the catalog's
  identity/habit authorities for the asbestos set.
