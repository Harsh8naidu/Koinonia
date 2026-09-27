# Koinonia

Single-player, multi-character browser puzzle platformer. This build implements **Milestone 0 only**: a movement sandbox, with no puzzle or exit yet.

## Run

Requires Node.js 22.12+ (verified with Node 24.18.0 and npm 11.16.0).

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite, normally http://127.0.0.1:5173. Click the game to give it keyboard focus.

```sh
npm run typecheck
npm run build
npm run preview
```

Production output is in `dist/`. No server or account is needed by the game.

## Controls and implemented behavior

- A/D or Left/Right: move the selected character.
- Space, W, or Up: jump when grounded. Holding jump does not auto-repeat.
- Q: switch between teammates. 1/2: select A/B directly.
- Click the canvas to focus; Tab remains available for browser focus navigation.

Two labeled, differently colored placeholder characters have independent Arcade Physics bodies. Both collide with the floor and world bounds; they can pass through each other. Switching stops the old character's horizontal velocity and preserves vertical motion. The HUD and overhead marker identify the active character. Losing focus clears input. Refresh the page to reset this sandbox.

## Structure

- `src/main.ts`: Phaser configuration, gravity and scaling.
- `src/scenes/GameScene.ts`: generated placeholder textures, floor, characters, selection and focus-scoped input.
- `src/style.css`: minimal page layout.
- `docs/design-brief.md`: original supplied specification and long-term intent.

Dependencies are pinned with a lockfile: Phaser 4.2.1, TypeScript 7.0.2, Vite 8.3.1. Phaser API usage is checked against the installed package's declarations. Phaser 4.2.1 is listed in the [official release archive](https://phaser.io/download/release/v4.2.1).

## Verification

- Strict TypeScript check and Vite production build pass.
- In-app Chromium browser smoke check: scene renders, both characters land on the floor, B jumps and moves horizontally, Q selects B, and 1 selects A; active marker updates.
- No browser console errors or warnings during that smoke check.
- Vite warns that the full Phaser bundle exceeds 500 kB (approximately 359 kB gzip). Optimization is deferred.

Not yet verified: Firefox, prolonged held-key input, focus loss/regain regression, switching during a jump, or browser zoom. Moving platforms are not implemented or tested. No automated gameplay tests were added for this small prototype.

## Next milestone

Milestone 1: finish team-control validation, add camera follow and eased transitions in a wider test room, and test switching midair and near viewport edges. Then prototype the pulley/lift interaction before building the first puzzle. Coyote time, jump buffering, checkpoint reset, jetpack, collectibles, audio and polished art remain future work.
