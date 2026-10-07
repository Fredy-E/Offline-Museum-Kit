<h1 align="center">Offline Museum Kit</h1>

<p align="center">
  <strong>A single-file procedural 3D exhibit — guided stops, captions, offline by design.</strong><br>
  Template demo built from formulas: one HTML file, no runtime assets, readable fallback without WebGL2.
</p>

<p align="center">
  <a href="https://github.com/Fredy-E/Offline-Museum-Kit/actions/workflows/verify.yml"><img src="https://github.com/Fredy-E/Offline-Museum-Kit/actions/workflows/verify.yml/badge.svg" alt="verify"></a>
  <img src="https://img.shields.io/badge/platform-browser-29354b?style=flat-square" alt="Platform: browser">
  <img src="https://img.shields.io/badge/single%20file-one%20HTML-c7a366?style=flat-square" alt="One HTML file">
  <img src="https://img.shields.io/badge/status-prototype-737373?style=flat-square" alt="Status: prototype">
  <img src="https://img.shields.io/badge/license-MIT-737373?style=flat-square" alt="License: MIT">
</p>

## What this is

Open `index.html` directly. The page embeds its styles, geometry generator, WebGL2 renderer, and fictional exhibit captions. Previous/Next buttons, numbered stops, and arrow keys navigate three views. Captions remain readable when WebGL2 is unavailable, and print styles produce a text exhibit.

This first version is a template demonstration with discrete authored views — not a continuous walkthrough or a full museum authoring system. It uses no network assets and no downloaded models; the exhibits are fictional geometry examples.

## Edit and rebuild

`exhibit.json` is the editable source dataset. After editing, rebuild the standalone page:

```sh
python build/build_museum.py
```

The page deliberately does not fetch the JSON at runtime — the build tool embeds everything (the shared family style and mesh engine are vendored under `build/vendor/`).

## Checks

```sh
node tests/exhibit.test.cjs
```

## Next

An authoring UI, camera paths through a shared room, embedded media, and an accessibility review.

## See also

[DriverLens](https://github.com/Fredy-E/DriverLens) · [ARM64 Compatibility Radar](https://github.com/Fredy-E/ARM64-Compatibility-Radar) · [MeshLab Mini](https://github.com/Fredy-E/MeshLab-Mini) · [Diagnostic Scan Diff](https://github.com/Fredy-E/Diagnostic-Scan-Diff) — small local-first tools built for Windows-on-ARM work.
