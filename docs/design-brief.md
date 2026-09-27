Working title: Koinonia
Single-player, multi-character browser puzzle platformer — design and development brief
Status: Working specification, 24 September 2026. The name, visual style and numeric tuning are provisional. This document is intended to be pasted into a ChatGPT Desktop coding session and refined while building.
1. Project goal
Build a polished, playable browser game for a game-programming portfolio. One person controls a small team of characters, switches between them at any time, and leaves them in useful positions or interactions to solve spatial puzzles. The game takes inspiration from TeamUP's character-switching premise but needs its own level layouts, characters, art, interactions and identity.
The game is single-player first. Online play, servers and synchronization are outside the initial release. It is a mechanically 2D side-view platformer with layered backgrounds, foreground elements, lighting and parallax that give it a 2.5D appearance. No perspective 3D geometry or 3D physics is required.
Player promise: “I position each member of my team, leave them doing something useful, switch to another, and make the whole group reach the exit. A jetpack lets me explore optional vertical paths for rare minerals.”
Initial release target: a short browser demo with a tutorial and two or three carefully designed levels, approximately 10–20 minutes total. A single excellent vertical slice is more valuable than several unfinished levels.
2. Design pillars and boundaries
Switching changes the puzzle. The inactive characters remain in the world, collide with it, stand on switches and continue explicitly assigned interactions.
Simple mechanisms combine. Lifts, pressure plates, levers and pulleys use predictable rules that the player can learn visually.
Jetpack supports exploration. It helps reach optional minerals and sometimes repositions a character. Its fuel, ceiling and obstacle constraints prevent it from bypassing the main puzzle.
Readable first, atmospheric second. Gameplay platforms, interaction points and active team members must stay easy to distinguish from parallax scenery.
Portfolio-quality implementation. Clean TypeScript, data-driven levels, reliable reset, responsive input and a deployed demo with a short technical write-up.
The first build has two characters with identical movement. Give them distinct silhouettes and colors, but postpone special classes (strong/engineer/agile) until the core puzzles prove they need them. A third character is a later design option, not a prerequisite. Avoid combat, crafting, an upgrade economy, procedural generation and multiplayer in the first release.
3. Core gameplay rules
Team and switching
One activeCharacterId receives movement, jump, jetpack and interact input. The camera follows that character with a short ease; the others stay in the level and continue physical simulation.
Switching does not teleport a character or reset its velocity, inventory or interaction state. When a character becomes inactive, stop its horizontal input immediately; let gravity and existing vertical motion resolve normally.
Inactive characters stay where they land. They can hold a pressure plate by standing on it. Only a specifically assigned continuous interaction, such as operating a pulley, runs without active input.
A character assigned to a pulley is locked at the station until released. Switching away does not cancel the assignment. Switching back and pressing Interact releases it. If the character is removed or reset, the interaction is released automatically.
The level exit opens after its explicit puzzle conditions are met. Completion requires all team members to reach the exit zone; show who is still missing.
Player controls (desktop first)
Action
Default input
Rule
Move
A/D or Left/Right
Active character only
Jump
Space or W/Up
Grounded jump; test a small coyote-time and jump-buffer window
Interact / release
E
Nearby mechanism with visible prompt
Next character
Tab (handle browser focus) or Q
Cycle team; pick one as the displayed default after playtesting
Select character
1, 2, 3
Direct selection for available characters
Quick-switch
Middle mouse click
Return to previously active character; optional convenience
Use jetpack
Hold Shift
Active carrier only; consumes fuel while producing thrust
Restart checkpoint
R, preferably hold or confirm
Return to a safe snapshot
Pause
Escape
Show controls, restart and sound settings
Middle mouse is never the only switching method. Handle browser behavior in the game canvas, display keyboard controls in-game, and test input after the canvas loses and regains focus. Do not capture scrolling or key input on unrelated page elements.
Mechanisms and state
Mechanism
How it works
State when switching away
Pressure plate
Occupied by a character or allowed crate; powers a linked device
Stays on while occupied; turns off after leaving
Lever
E toggles a linked device, possibly with a timer
Its state persists according to level data
Pulley / crank
E assigns a nearby character to operate it; moves a lift toward a defined stop
Operator remains assigned; movement continues or holds until released, as specified by that level
Lift / moving platform
Carries a standing character between two bounds with a clear direction indicator
Moves according to its controller; never depends on which character is active
Door / exit
Receives power from one or more linked mechanisms
Shows closed, open and completion states clearly
For the first pulley puzzle, choosing E assigns A as the operator, raises the lift carrying B, and holds at the upper stop until A releases the pulley. No continuous tapping or timing challenge is needed. Later levels may add timed controls, but each variation must be explicitly signposted.
Jetpack and minerals
A jetpack is a world pickup that can be carried by one character. Start with one per level; it stays with the carrier on switching. Direct handoff or dropping it is a later mechanic only if a puzzle needs it.
Hold the jetpack key to apply upward acceleration; apply gravity as usual when released. Cap upward speed, define a fuel capacity and show a prominent fuel gauge. Initial tuning values are placeholders to be adjusted by feel.
Fuel canisters refill a fixed amount up to capacity; collection state persists until a level reset or checkpoint restore. Never allow the player to consume the only fuel needed for mandatory progression without a recovery route.
Rare minerals are optional collectibles placed on vertical side paths. The main exit remains solvable without them. Display a per-level mineral count and award a completion mark for collecting all.
Use enclosed shafts, ceilings and deliberate placement rather than arbitrary invisible walls to keep flight from invalidating puzzles.
Failure and recovery
Start without lethal enemies. Falling out of the playable area or getting stuck offers an immediate checkpoint reset. The reset restores all relevant state together: character positions and velocities, active selection, mechanism state, platform positions, jetpack owner and fuel, and collected items. A level must always have a recoverable route to completion. A “restart level” action is always available.
4. Sample first playable puzzle
Setting: A small abandoned mine shaft. Two team members start on the left. The exit is on an upper ledge to the right.
The player moves B onto a lift at ground level.
They switch to A, walk to the pulley and press E. A stays at the pulley; the lift carries B upward.
They switch back to B, step onto the upper ledge and toggle a lever that lowers a bridge for A.
They switch to A, release the pulley and cross the bridge. Both stand at the exit to complete the level.
An optional jetpack and fuel pickup in a side alcove allow B to reach one mineral above the lift. This reward is not needed for the exit.
Teach one rule at a time: switching in the first room, leaving a character on a plate in the second, pulley and lift in the next, jetpack as an optional challenge only after those rules are understood.
5. Technology choices
Area
Initial choice
Why / constraints
Language
TypeScript with strict mode
Clear state contracts and useful portfolio evidence
Game framework
Phaser 4.x (start from a current verified 4.2.x release)
Scenes, camera, input, rendering, audio, tilemaps and Arcade Physics
Build
Vite + npm, using an official Phaser TypeScript/Vite template where practical
Local iteration and static browser build
Physics
Phaser Arcade Physics
Suitable for side-view movement, simple collisions and overlaps; prototype moving platforms early
Level editing
Initially a small hand-authored data map; move to Tiled JSON when the first puzzle works
Do not spend the first week writing a full editor or importer
Art
Consistent placeholder pack, then custom edited sprites and layered mine backgrounds
Mechanics first; establish a distinctive style before release
Audio
Licensed sound effects and an optional short ambient loop
Feedback for switches, platform motion, pickup, thrust and completion
Deployment
Static hosting after npm run build
No account, database or multiplayer server required
Repository
Git, README, screenshots and short gameplay GIF/video
Show work and decisions to employers
Engine note: Phaser 4 is a 2D framework. Treat “2.5D” as presentation through parallax, silhouettes, shadows, fog and foreground occlusion. If the design changes to freely traversable 3D depth, revisit the engine choice rather than forcing it into this project.
Moving-platform technical risk: Prototype and test the lift before committing to the level pipeline. A moving Arcade body should be a dynamic, immovable body with suitable motion, not a static body repositioned without updating its collision body. Test whether passengers ride reliably while stationary, jumping, switching and arriving at either stop; if needed, implement explicit passenger displacement and document it. This detail is version-sensitive: follow the installed Phaser 4 API, not an unverified Phaser 3 snippet.
6. Suggested code layout
src/
  main.ts                 # Phaser game config and boot
  scenes/BootScene.ts     # preload common assets
  scenes/MenuScene.ts     # title and controls
  scenes/GameScene.ts     # level composition, camera, game loop
  scenes/HudScene.ts      # active-character, fuel, collectibles, prompts
  entities/Character.ts
  entities/MovingPlatform.ts
  entities/JetpackPickup.ts
  systems/TeamController.ts
  systems/InteractionSystem.ts
  systems/PuzzleSystem.ts
  systems/CheckpointSystem.ts
  level/LevelData.ts
  level/LevelLoader.ts
  input/InputBindings.ts
public/assets/
  art/
  audio/
  levels/
docs/
  asset-credits.md
This is a guide, not a mandate to create every file on day one. Start with the smallest set of files that produces a running scene; extract classes as mechanics become real.
State ownership: TeamController owns active and previous character IDs. Each Character owns movement, carrier status and interaction assignment. PuzzleSystem resolves mechanism links from stable object IDs; it must not infer puzzle state from sprite color or scene depth. CheckpointSystem snapshots serializable gameplay state, not Phaser display objects. The HUD reads game state and does not change it directly.
Level data: Keep collidable terrain separate from decorative layers. Each interactive object has an ID, type, position, linked target ID and any settings such as travel bounds, speed or activation mode. Validate broken or duplicate IDs when loading. Tiled can later hold collision layers and object layers with custom properties; export JSON and maintain the editable source maps in the repository.
Update order: Read input for the active character; update character/action state; update puzzle controllers and moving platforms; run physics; resolve overlaps/interactions; render HUD. Avoid repeatedly rebuilding colliders in the frame loop. Use scene events or explicit update methods to keep reactions predictable.
Camera and scale: Start with a fixed logical game size (for example 1280×720), scale it to fit desktop browser windows, bound the camera to the level and keep UI fixed to the viewport. Test on a smaller laptop window and at 125–150% browser zoom. Add a camera transition when changing characters so the player stays oriented. Mobile controls are optional for the portfolio demo; clearly say desktop keyboard recommended if mobile is unsupported.
7. Art, animation and audio plan
Visual direction: Stylized abandoned mining machinery and crystal seams, with readable silhouettes, muted rock/metal tones and one bright accent for interactable devices. Use distinct character accent colors plus shapes, so color is not the only identifier. A small number of parallax layers and particle effects should support depth without covering collisions or prompts.
Minimum visual asset list: Two character sprites (idle, run, jump/fall, interact, jetpack pose); tiles for ground, walls and platforms; lift and pulley; pressure plate and lever; bridge/door; jetpack and fuel canister; mineral; foreground chains/rocks; distant cave or machinery layers; a few HUD icons; optional thrust/steam particles. Placeholder rectangles and text labels are acceptable during mechanical development.
Source options:
Need
Suggested source
Use rule
Prototype tiles/characters
Kenney Platformer Pack Industrial or Platformer Art Deluxe
Prefer a coherent pack; verify the chosen pack page and included license
UI / input prompts
Kenney UI Pack, Input Prompts
Adjust icon labels to match actual bindings
UI and machine feedback
Kenney Interface Sounds, Impact Sounds
Mix levels consistently; avoid loud repeated loops
Level editor
Tiled
Keep editable source and exported JSON together
Additional art/music
Own work or separately licensed packs
Record creator, source URL, license and attribution requirements per asset
Kenney labels the cited asset packs CC0; still keep their source URLs in docs/asset-credits.md. Other marketplaces and individual asset pages can have different terms, so verify each pack before use. Never assume an asset found through search is free to redistribute. Prototype with simple shapes first, and replace only the assets that visibly matter in the portfolio build.
Audio cue list: selection/switch, pulley engaged/released, lift moving/stopping, lever toggled, fuel pickup, mineral pickup, low fuel, jetpack loop and level complete. Make sound optional and begin playback only after user interaction where browsers require it.
8. Development sequence and acceptance checks
Milestone
Build
Done when
0. Foundation
Phaser 4 + TypeScript + Vite project; one scene with simple collidable floor
Runs locally; typecheck and production build succeed; character moves and jumps
1. Team control
Two characters, camera and keyboard switching
Only selected character accepts input; inactive one persists and collides; switching midair and at viewport edges works
2. First puzzle
Pulley, lift, lever, bridge, exit conditions
A can operate while B rides; B opens route; A rejoins; both required at exit; no unsolvable stuck state
3. Recovery
Reset, checkpoint snapshot and visible prompts
Restart restores every puzzle variable consistently; controls are discoverable
4. Jetpack
Pickup, thrust, gauge, fuel, one optional mineral
Flight feels controllable; optional route works; running out of fuel does not block level completion
5. Content
Tutorial and 1–2 more short levels
Each introduces or combines one new idea; no level requires guessing a hidden rule
6. Presentation
Layered art, animation, audio, menus, polish
Game remains readable, performant and playable on common desktop browser sizes
7. Portfolio
Deployed static build, README, screenshots and gameplay clip
Recruiter can play immediately and read what was engineered
Manual regression list: switch while jumping, riding a moving lift, operating a pulley, holding a plate, after collecting fuel, and after a checkpoint restore. Test all characters reaching the exit; test restarts with every mechanism state; verify fuel and collectibles do not duplicate. Run in current Firefox and Chromium on desktop. Keep any small automated tests focused on pure puzzle rules and checkpoint serialization; use playtesting for feel and collision.
9. Practical scope decisions
No account or backend: the initial demo is entirely client-side. Level progress may use browser storage later, but start with a restartable session.
No networking abstraction: designing every entity for hypothetical multiplayer would slow the single-player mechanics. Add multiplayer only after the game is already enjoyable and the simulation architecture has been reviewed for it.
Character abilities: add a third character or different abilities only after a level design proves they make a more interesting puzzle. The two-character lift puzzle is the baseline.
Art and effects: cap the number of styles. A coherent set of simple sprites and clear mechanism animations beats unrelated high-detail assets.
Accessibility: remappable keys are desirable later; for the first demo, provide alternative keyboard controls and a text controls screen. Distinguish interactive objects by shape, label and animation as well as color.
10. First prompt to paste into ChatGPT Desktop
Paste this entire document, followed by:
You are helping me implement this single-player browser game in a local repository. Start with Milestone 0 only. Inspect the existing folder and installed toolchain, then create the smallest Phaser 4 + TypeScript + Vite project that runs locally with two placeholder characters, a collidable floor, basic movement/jump and a visible active-character indicator. Keep code simple and readable. Use the installed Phaser version's API and tell me any commands I need to run. Run the available typecheck/build and fix errors. At the end, summarize exactly what works, what you verified, and the next milestone. Do not add multiplayer, networking, a third character, jetpack or polished art yet.
For subsequent sessions, give the coding assistant the latest repository state plus the relevant milestone and its “Done when” checks. Ask it to implement one milestone, run the build, and report unresolved gameplay risks. Keep this design document as the source of intent and update it when playtesting changes a rule.
References checked for tooling and assets
Phaser official release archive, project templates, Arcade Physics guide, and Phaser 4 scope.
Tiled official website and JSON map format.
Kenney support/licensing and the individual asset pages linked above.