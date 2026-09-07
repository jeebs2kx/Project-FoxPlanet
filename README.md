# Project FoxPlanet

Project FoxPlanet is my fan-made viewer for **Star Fox Adventures**, the **Kiosk Demo** and **Dinosaur Planet**.

I started it because I wanted one place where I could poke around the maps, models, and other development stuff from the games. It has grown quite a bit since then, but it is still a hobby project of mine for the last 4+ years and counting!

## Try the web version

https://jeebs2kx.github.io/Project-FoxPlanet/

## What is in it

- released and development maps from Star Fox Adventures and Dinosaur Planet
- map, model, animation and texture viewers
- SFA/Kiosk sequence and cutscene player
- subtitles and voice playback where the game data supports it
- SFA, Kiosk and Dinosaur Planet music tools
- minimaps, HITS viewing and various development/debug features
- map and model export tools
- VR support

There is a lot more in there than this, and I am still adding/fixing things when I get time.

## Game files

**No ISO, ROM or extracted game data is included in this repository.**

Use **LOAD GAME FILES** in FoxPlanet and choose your own existing FoxPlanet GameData folder, SFA/Kiosk ISO or GCM, or Dinosaur Planet ROM.
RECOMMENDED IMPORT ORDER
1. Import the retail Star Fox Adventures ISO/GCM. (v1.1 has been tested but v1.0 should also work)
2. Import the Dinosaur Planet raw Nintendo 64 ROM (usually rom_crack.z64)
3. Import the Star Fox Adventures Kiosk/demo ISO/GCM.
4. Use File -> Reload, or close and reopen Project FoxPlanet once.

LOCAL IMPORTED DATA
Imported files are stored outside the application folder under the current
Windows user's application-data directories. Removing those imported files will
return the viewer to its no-data state.

The web version reads the files locally in your browser. They are not uploaded to this repository or to the website.

## A few notes

This is still very much a work in progress. Some maps, effects or development features may be incomplete or behave differently from the original game.

The web build and desktop build also have a few differences simply because browsers cannot do everything the desktop app can do in exactly the same way.

## Credits

A big part of the original viewer base comes from **noclip.website**:

https://github.com/magcius/noclip.website

I’ve also used a lot of useful research and documentation shared publicly by members of the Dinosaur Planet Community Discord, who were kind enough to make their work available for others researching the games.

Additional documentation and credit also goes to the folks behind these GitHub pages:

https://github.com/RenaKunisaki/StarFoxAdventures

https://github.com/zestydevy/dinosaur-planet

Thanks to everyone who has worked on documenting, reverse engineering and preserving these games!

## Licence

My Project FoxPlanet code changes and additions are released under the MIT Licence. See [LICENSE](LICENSE).

Parts based on noclip.website and other bundled third-party code keep their original licence notices. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and the bundled JavaScript licence file.

Game names, logos, artwork, music, models, textures and other game content are **not** covered by the Project FoxPlanet licence and remain the property of their respective rights holders.

## Disclaimer

Project FoxPlanet is an unofficial fan project. It is not affiliated with or endorsed by Nintendo, Rare or any other rights holder.
