// ============================================================
// js/99l-release-runtime-contract.ts
// ============================================================
// Executed, immutable release facts. Release tooling reads this object from the
// built game bundle; it must never independently restate numeric runtime values.
// This is presentation/release metadata only and does not alter simulation state.

const RELEASE_RUNTIME_CONTRACT = Object.freeze({
  schema: 'vugg-release-runtime-contract-v1',
  save_format: SAVE_FORMAT,
  scientific_authority: Object.freeze({
    field_resolution: CAVITY_PRODUCTION_SCIENTIFIC_RESOLUTION,
    convergence_reference_resolution: CAVITY_PRODUCTION_REFERENCE_RESOLUTION,
    isovalue: CAVITY_PRODUCTION_ISOVALUE,
    player_quality_control: CAVITY_PRODUCTION_PLAYER_QUALITY_CONTROL,
  }),
  presentation: Object.freeze({
    mobile_classification: Object.freeze({
      operator: 'OR',
      max_width_css_px: SURFACE_GROWTH_MOBILE_MAX_WIDTH_CSS_PX,
      min_device_pixel_ratio: SURFACE_GROWTH_MOBILE_MIN_DEVICE_PIXEL_RATIO,
    }),
    surface_growth_instance_cap_mobile: SURFACE_GROWTH_INSTANCE_CAP_MOBILE,
    surface_growth_instance_cap_desktop: SURFACE_GROWTH_INSTANCE_CAP_DESKTOP,
  }),
  audio_mix_states: Object.freeze({
    title: Object.freeze({
      source: _MUSIC_TRACKS.title,
      default_gain: MUSIC_DEFAULT_VOLUME,
      loops: true,
    }),
    building: Object.freeze({
      source: _MUSIC_TRACKS.building,
      default_gain: MUSIC_DEFAULT_VOLUME,
      loops: true,
    }),
    strip_view: Object.freeze({
      source: null,
      music_gain: 0,
      sonifier_default_master_gain: STRIP_SONIFY_DEFAULT_MASTER_VOLUME,
    }),
    muted: Object.freeze({ source: null, gain: 0 }),
  }),
});
