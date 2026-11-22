# orchid-keys

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/0xb3e689/orchid-keys/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/0xb3e689/orchid-keys/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Orchid Keys** is an original open-world crime game in 3D, set on a sun-soaked island city at golden hour. Explore five districts (Palmetto Heights, Meridian, the neon Lumen Strip, Coral Beach and the docks of Port Halcyon) on foot or behind the wheel: steal cars, dodge traffic and pedestrians, and outrun a 5-star OKPD response with cruisers that ram, roadblocks and a searchlight helicopter. Play Dez Navarro's seven-mission story *Salt & Neon* to win back the family beach bar from Councilman Shore, race the Sunset Sprint, run parcels for Coconut Couriers, steal the six cars on Tiko's export list, hunt 24 wild orchids hidden around the island, and spend your money and respect at Gulfside Arms and Tiko's Body Shop. Everything (the city, cars, characters, story, synthesized sound and generated music) is made for this game; it runs from static files in `game/` with a vendored three.js build, no build step and no network.

The HUD carries a mission tracker (story chapter, a segment per objective, a live readout such as distance, hostiles left or target damage, and the reward), wanted stars, money, weapon and ammo, a rotating minimap with route and police search area, and an F prompt for the car you are standing next to. The title screen's Continue card shows your save: next chapter, money, rank, orchids and completion.

Controls: WASD move/drive, mouse look, Shift sprint, Space jump/handbrake, F enter/exit/carjack, left click shoot, right click aim (and drive-by), Q/E or 1-5 weapons, R radio, H horn, M map, Esc pause. The game saves to localStorage (pause menu, Mama Ro's laundromat, and after every mission).

## Screenshots

Taken in headless Chrome from the game's own staged scenes (`?shot=chase|city|mission|title`, see `shots.json`): the cover is a 4-star chase during *Hot Pink*; then Coral Beach on foot, the *Neon Debt* gunfight, and the title screen with a saved game.

## Run it

```sh
node serve.ts   # then open http://localhost:8080 in desktop Chrome
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=93p1fwth&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
