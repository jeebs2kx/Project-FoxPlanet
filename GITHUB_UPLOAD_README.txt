PROJECT FOXPLANET - GITHUB WEB SAFE

Copy the CONTENTS of this folder into the root of the Project-FoxPlanet GitHub repository.
index.html must sit at the repo root.

IMPORTANT BEFORE UPLOADING:
Delete any old game-data folders/files already in the public repo. In particular remove old copies of:
  data/StarFoxAdventures
  data/StarFoxAdventuresDemo
  data/dinosaurplanet
  StarFoxAdventures/
  StarFoxAdventuresDemo/
  sequence-data/
  AMAP.BIN / AMAP.TAB
  TABLES.bin / TABLES.tab
  gametext_viewer generated data/atlases
  pfp-kiosk-current.js
  any ISO/ROM files, extracted game audio, textures, models or logos

This web folder intentionally contains no extracted SFA/Kiosk/DP game data.
Visitors supply their own files locally in the browser using:
  LOAD EXISTING GAMEDATA
  LOAD SFA ISO/GCM
  LOAD KIOSK ISO/GCM
  LOAD DINOSAUR PLANET ROM

Selected files stay in the browser on that computer. They are not uploaded to GitHub.
The browser forgets the selected folder/ISO/ROM after a full page refresh, so choose it again if the page is refreshed.

SFA/Kiosk MusyX music still needs desktop FoxPlanet for now because the current Amuse renderer is native code, not a browser/WASM build. The web player shows a desktop-version message instead of calling the missing local renderer.

Raw SFA/Kiosk ISO mounting covers the game filesystem. Some helper data that desktop FoxPlanet generates (for example the GameText viewer atlas) is not bundled here. Existing FoxPlanet GameData folders can provide those generated files locally.
