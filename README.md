# XeroxLab 

XeroxLab is a browser-based copy-machine degradation tool.

https://aacd164.github.io/Xeroxizer/

https://www.aarondey.design/


## Presets

- First Generation Xerox
- 5th Generation Copy
- 20th Generation Copy
- Library Book Scan
- Office Scanner 1998
- Underground Flyer 1994
- Art School Photocopy
- Broken Copier

## Controls

- Generation Loss
- Toner Spread
- Scanner Bed Dirt
- Misfeed / Skew
- Double Exposure
- Edge Fill

## What changed in V3

- Removed Blueprint Scan
- Removed Punk Zine
- Removed fake paper damage blobs
- Added generation loss simulation
- Added toner spread
- Added sparse scanner bed dirt
- Added subtle copier glass hairs
- Added more realistic edge wear
- Made uploaded images fill closer to the copy edge instead of sitting with huge empty margins



## V4 changes

- Added Colour Copy preset.
- Colour mode preserves image colour instead of converting to black and white.
- Added colour copier artifacts:
  - saturation shift
  - warm dirty paper whites
  - subtle CMY dot noise
  - light registration drift
  - colour toner spread


## V5 changes

- Colour Copy is dirtier and less clean.
- Added stronger colour toner contamination.
- Added colour cast patches and warm dirty paper whites.
- Separated Scanner Dirt from Scanner Lines.
- Scanner Dirt now controls dust, lint, smudges, hairs, and scanner-bed grime.
- Scanner Lines now controls vertical scanner streaks separately.


## V5.1 fix

- Fixed JavaScript crash caused by missing Scanner Lines control.
- Added defensive control binding so one missing UI element does not break uploads.


## V5.2 actual fix

- Confirmed the Scanner Lines slider now exists in `index.html`.
- Confirmed the JavaScript no longer crashes if a control is missing.
- Fixed the upload-breaking `addEventListener` null error.


## V6 changes

- Rebuilt Scanner Dirt so it no longer looks like random grey circles.
- Added Scanner Cleanliness profiles:
  - Museum Clean
  - Office Scanner
  - Print Centre
  - School Library
  - Punk Venue Copier
  - Abandoned Office
- Added grungier scanner dirt layers:
  - irregular dust specks
  - lint fibres
  - fingerprint smudges
  - toner residue clouds
  - edge grime
  - dirty scanner-bed haze
- Added draggable before/after comparison slider.


## V7 changes

- Reworked Scanner Dirt again so it no longer looks like grey circles.
- Reduced dust particles heavily.
- Brought back subtle scanner-glass hair effects.
- Added more short paper fibers.
- Made fingerprints and residue much more faint.
- Adjusted cleanliness profiles to prioritize hairs, fibres, edge grime, and haze over dots.
- Lowered default dirt levels for a more realistic scanner look.


## V8 changes

- Made Scanner Dirt visibly affect the image again.
- Kept the dirt grungy and scanner-like instead of circular.
- Added stronger long hair and short fibre contamination.
- Added more visible edge grime and toner haze.
- Increased default dirt values.
- Scanner Dirt now controls visible scanner-glass contamination, while Scanner Lines still controls vertical scan streaks separately.


## V9 changes

Added the requested creative controls:

- Paper Size / Crop Modes
  - Letter
  - A4
  - Tabloid
  - Square
  - Poster
  - Receipt
  - Zine Page
  - Flyer

- Real Copier Border Options
  - No Border
  - Slight Scan Edge
  - Black Photocopy Edge
  - Crooked Page on Glass
  - Book Scan Shadow
  - Misaligned Paper Edge

- Toner Density Control
  - separate from Toner Spread
  - changes black fill, contrast, toner crush, and bloom

- Stamp / Watermark Tool
  - custom text
  - stamp / watermark / archive styles
  - red / blue / black
  - opacity control

- Fold / Crease Tool
  - horizontal
  - vertical
  - tri-fold
  - corner fold
  - book crease
  - intensity slider


## V9.1 fix

- Fixed the render-breaking `skew is not defined` error.
- The after/effect side now draws again.


## V9.2 fix

- Confirmed line 199 no longer references an undefined `skew` variable.
- Added `const skew = Number(skewRange.value) / 900;` directly before the image placement call.


## V10 changes

- Removed the Scanner Cleanliness dropdown.
- Paper size / crop modes now actually resize the working page by changing the canvas wrap width and height.
- Rebuilt the fold / crease tool so the page is actually distorted instead of only having crease lines drawn on top.
- Vertical, horizontal, tri-fold, book crease, and corner fold now include displacement plus highlight/shadow shaping.


## V11 UI changes

- Rebuilt visual interface with Apple HIG-inspired hierarchy.
- Uses system type, softer cards, larger touch targets, rounded controls, subtle translucency, and cleaner spacing.
- Reduced harsh borders and all-caps UI styling.
- Kept all V10 functionality intact.


## V12 UI changes

- Removed the coloured/beige background.
- Reworked the app around Apple-style neutral whites and system greys.
- Cleaner sidebar, white cards, grey controls, and less decorative visual styling.
- Kept the blue accent only for primary actions and focus states.


## V13 changes

- Added **Fit to Image** under Paper Size / Crop Mode.
- When selected, the working page automatically matches the uploaded image’s aspect ratio.
- This avoids forced Letter/A4 cropping and keeps the whole image composition closer to the original.


## V2 Fixed

Neutral Apple-style dark mode, quieter empty-state text, real crease texture blending, and printed-in stamp/watermark blending.
