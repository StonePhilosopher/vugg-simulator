// ============================================================
// js/91z-nucleation-probe-registry.ts — production probe registration
// ============================================================
// Runs every class iterator once in registration-only mode after all
// _nuc_* functions have loaded. _runNuc records callback identity but does not
// evaluate chemistry, consume RNG, or touch simulator state. The formation
// panel can therefore probe every direct nucleation route before step one.

function _initializeNucleationProbeRegistry(): void {
  _REGISTER_NUCLEATORS_ONLY = true;
  try {
    const sentinel = {};
    _nucleateClass_arsenate(sentinel);
    _nucleateClass_borate(sentinel);
    _nucleateClass_carbonate(sentinel);
    _nucleateClass_halide(sentinel);
    _nucleateClass_hydroxide(sentinel);
    _nucleateClass_molybdate(sentinel);
    _nucleateClass_native(sentinel);
    _nucleateClass_oxide(sentinel);
    _nucleateClass_phosphate(sentinel);
    _nucleateClass_silicate(sentinel);
    _nucleateClass_amphibole(sentinel);
    _nucleateClass_sulfate(sentinel);
    _nucleateClass_sulfide(sentinel);
  } finally {
    _REGISTER_NUCLEATORS_ONLY = false;
  }
}

_initializeNucleationProbeRegistry();
