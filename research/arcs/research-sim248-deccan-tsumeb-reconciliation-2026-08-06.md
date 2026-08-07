# SIM 248 Deccan and Tsumeb reconciliation

Date: 2026-08-06

## Question

The SIM 247 hostile review found two places where the executable scenario made
stronger claims than its evidence: the Deccan zeolite order disagreed with its
own archived run, and Tsumeb deterministically produced haidingerite without a
locality occurrence source. This pass asks what each authored scenario can
defensibly promise while preserving globally useful mineral engines.

## Deccan: locality-specific paragenesis

Primary sources consulted:

- Sukheswala, Avasia & Gangopadhyay (1974), “Zeolites and associated secondary
  minerals in the Deccan Traps of Western India,” *Mineralogical Magazine*
  39:658–671: <https://www.rruff.net/doclib/MinMag/Volume_39/39-306-658.pdf>
- Ottens et al. (2019), “Exceptional Multi-Stage Mineralization of Secondary
  Minerals in Cavities of Flood Basalts from the Deccan Volcanic Province,
  India,” *Minerals* 9:351: <https://www.mdpi.com/2075-163X/9/6/351>

Sukheswala et al. describe a silica layer on the cavity wall; scolecite and
mesolite as the first zeolites; possible subsequent heulandite and stilbite;
and apophyllite plus calcite among the last volatile-bearing phases. They also
warn that individual zeolite order varies considerably, even within one zone.
Ottens et al. independently resolve a multistage Savda history with early
silica/zeolite stages and apophyllite in the late Stage III assemblage.

Simulation decision: the Deccan scenario is explicitly a Savda–Nashik
archetype, not a universal inventory for the whole province. It executes:

1. silica lining;
2. scolecite + mesolite;
3. heulandite + stilbite;
4. apophyllite.

Scenario `nucleation_windows`, expressed in the same step coordinates as events,
enforce that order in the production
nucleator and report the same constraint in Creative Mode’s live formation
diagnosis. Thomsonite and chabazite remain valid global and Creative minerals,
but are excluded from this authored cavity rather than asserted absent from the
Deccan province. Their global metadata no longer calls one generalized order
universal.

## Tsumeb: evidence boundary for calcium arsenates

Authoritative locality catalogs checked live on 2026-08-06:

- Mindat, Tsumeb Mine locality record: <https://www.mindat.org/loc-2428.html>
- Harvard Mineralogical & Geological Museum, Tsumeb Mine Notebook:
  <https://tmn.fas.harvard.edu/>
- Harvard gypsum object TSNB159: <https://tmn.fas.harvard.edu/objects/TSNB159>

Neither searchable locality catalog returned pharmacolite or haidingerite.
That negative result is not a universal claim that the species could never
occur at Tsumeb; it is an evidence threshold for a deterministic educational
scenario. A chemically possible dehydration from pharmacolite also cannot be
used as independent occurrence evidence for haidingerite.

Simulation decision: both species are excluded from the Tsumeb scenario and
removed from its deterministic expectation contract. Scenario exclusions
block nucleation and a transformation whose target is unsupported there.
Pharmacolite dehydration remains active globally and in Creative Mode. Gypsum
remains a deterministic Tsumeb promise because TSNB159 directly documents it.

## Release evidence

- Deccan multi-seed contract requires both fibrous zeolites before both sheet
  zeolites, followed by apophyllite, and requires the excluded species to stay
  absent.
- The Creative diagnosis must name a scenario paragenetic window when it is the
  blocker.
- Tsumeb must deliver every remaining documented deterministic promise, keep
  both unsupported species absent, and record no haidingerite transformation.
- Structural tests keep deterministic, statistical, aspirational, and excluded
  claims disjoint.
- Mineral-library `scenarios` associations must not advertise any phase that a
  scenario excludes; globally valid engines without a shipped association are
  labelled as Creative-mode available rather than assigned to an unsupported
  locality.
- Strip format v5 records actual simulator/event `step` separately from the
  zero-based `sample_index` used to address the chemistry tensor, preventing
  archives and claim cards from shifting authored boundaries backward by one.
