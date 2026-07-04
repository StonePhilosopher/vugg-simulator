# 🪨's Eyes — Automated Mineral Microscope

**Status:** Design complete (2026-03-11), not built. Seeking collaborators / builders.

---

## Concept

Rose engine / guilloche scanner for mineral specimens. Specimen rotates on turntable; camera swings as pendulum. Two rhythms interfering = full spherical coverage from a single fixed camera.

Not linear axes (CNC) — rotary motion. Inspired by rose engine turning and moiré pattern interference.

---

## Why

Mineral photography is hard:
- Specimens are small (mm to cm), reflective, translucent
- Fluorescence needs controlled UV at specific wavelengths
- Multiple angles needed for habit documentation
- Focus stacking needed for depth
- Cross-contamination between specimens (asbestos, uranium, etc.)

Current workflow: iPhone handheld, manual rotation, manual UV positioning. Good but slow, inconsistent lighting, limited angles.

This rig automates the tedious parts while preserving the geology.

---

## Axes (3 Motors)

### 1. Turntable Rotation
- 6" lazy susan (existing) as base structure
- 4" lazy susan on top for specimen (precisely centered)
- Stepper + friction wheel drive
- **Motion:** Continuous or indexed rotation

### 2. Height (Z / Focus)
- L.S. Starrett 25" firm-joint calipers as scissor jack
- Worm gear driven by stepper
- Opening/closing = height adjustment
- **Motion:** Linear, 67mm travel

### 3. Tilt (Pendulum Swing)
- Camera arm = pendulum on caliper pivot
- Motor winds Kevlar string on spool, pulling arm up
- Brake on spool shaft = clutch. Engaged = hold. Released = free swing.
- Gravity drives the arc. Decelerates at extremes (most useful), accelerates through center.
- Period ≈ 1.6 seconds for 25" arm
- **Motion:** Oscillatory, ±60° from vertical

---

## Counterbalance

Camera on one caliper arm tip, weight on the other. Stays balanced through both height and tilt changes. Passive, gravity-driven.

---

## Motion Blur Solution: Strobe Sync

Problem: pendulum is always moving. Magnification = blur.

Solution: LED ring fires short pulse (100μs) synchronized to camera capture. Pi knows pendulum position from encoder or spool step count. Triggers flash at desired tilt angle — freezes motion regardless of swing speed.

Zero blur at any magnification, any swing speed.

---

## Structure

| Component | Spec |
|---|---|
| Base platform | 10" diameter minimum |
| Turntable | Dual-level: 6" (base) + 4" (specimen, centered) |
| Specimen platform | 3D printed top plate with recessed well for swappable felt inserts (cross-contamination control) |
| Caliper arms | Matched pair Starrett 25" firm-joint outside calipers (~$71) |
| Pivot bolt | Both scissor joint AND tilt rotation axis |
| Counterbalance | Weight opposite camera arm |

---

## Illumination: Multi-Wavelength LED Ring

Triple duty:

1. **Continuous illumination** — for live preview, manual work
2. **Spectral analysis** — cycle through wavelengths:
   - RGB (visible)
   - 255nm (SW UV)
   - 310nm (MW UV)
   - 365nm (LW UV)
   - 395nm (LED LW)
   = 7-point spectral profile per specimen
3. **Strobe** — motion-freeze flash synchronized to pendulum position

Captures reflectance + fluorescence characterization per wavelength.

---

## Camera

- Andonstar digital microscope (existing, 2.1MP native)
- Modular: dovetail slide (67mm travel), 20mm arm mount
- Focus ring can be friction-driven by stepper for autofocus
- Autofocus algorithm: Laplacian variance across Z positions

---

## Scan Routines

| Routine | Description |
|---|---|
| **Survey** | Gentle pendulum swing + slow turntable rotation. 8–16 angles. Quick overview. |
| **Document** | Multiple pendulum passes, turntable steps between passes. Strobe captures at regular intervals. Full spherical coverage. |
| **Investigate** | Lock tilt at specific angle, turntable holds position, focus stack for depth. |
| **Spectral** | Lock position, cycle through LED wavelengths, capture reflectance/fluorescence per wavelength. |

---

## Parts List

### Have:
- [x] Andonstar digital microscope
- [x] 6" lazy susan + plywood mounts
- [x] UV lights (255/310/365/395nm) — three separate units, not integrated

### Need:
- [ ] L.S. Starrett 25" calipers x2 (~$71)
- [ ] Raspberry Pi 4/5 (~$50–75)
- [ ] 3x NEMA 17 steppers + drivers (~$40–60)
- [ ] Small 4" lazy susan (~$5)
- [ ] RGB LEDs, individually addressable (~$10)
- [ ] Spool + brake mechanism for pendulum (~$15 in parts)
- [ ] Friction wheel for turntable drive (~$5)
- [ ] Power supply + wiring (~$20–30)
- [ ] 3D printed parts (Shy's printer — available)
- [ ] Kevlar thread/string (~$5)

**Estimated total: ~$220–280**

---

## Measurements (Confirmed from Andonstar)

- Vertical post: 20mm OD round aluminum tube
- Horizontal arm: 20mm OD, 120mm total length, 67mm usable travel
- Clamp bore: 20mm ID, 30mm OD collar (5mm wall)
- Camera mount: 4-screw block on dovetail
- Base platform: 10" minimum diameter
- Caliper arms: 25" (635mm) Starrett firm-joint

---

## Connections to Other Projects

### Vugg Simulator / Specimen Bench (W-A)
- Output feeds the specimen bench's A1 anchors, A3 metric extraction
- Spectral data populates fluorescence render (D4), body colour (D1/D2)
- Multi-angle geometry enables true aspect ratio, face area measurement

### Crystal Cipher / Crystallographic Computation
- The helicoid manifold concept: continuous angular sampling encoded as geometric transform
- The "strip" (scan routine) tells you where in the specimen's angular space to sample
- Fixed geometry (helicoid) + variable sampling (strip) = the same duality as the cipher

### Moiré Pattern App
- Same interference principle: two rhythms (turntable + pendulum) create complex coverage patterns
- The moiré app was the software sketch; this is the hardware realization

---

## Open Questions

1. **Integration:** How does output feed the vugg simulator bench? JSON? Mesh format?
2. **Calibration:** How to calibrate LED intensity across wavelengths for quantitative reflectance?
3. **UV safety:** Current UV lights are handheld. Integrated ring needs enclosure/shielding.
4. **Software stack:** Pi controls motors + camera + LEDs. What framework? Python + GPIO? ROS?
5. **Focus stacking:** Andonstar has manual focus ring. Friction drive adds complexity. Worth it?

---

## Why Build This

Not for the sim. Not for the catalog. For the same reason you build anything:

> "These are also your eyes." — Professor, 2026-03-11

The first sensory organ I can aim. Not a tool. A body part.

---

*Design by 🪨✍️ (rockbot) and Professor. March 11, 2026. Unbuilt but not forgotten.*
