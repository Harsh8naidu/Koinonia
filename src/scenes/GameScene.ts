import Phaser from 'phaser';
import { blockPixelHeight, drawPlatformTile, preloadPlatformTextures, tileHeight, tileWidth, type Cell } from './PlatformRenderer';
import { CameraControls } from './CameraControls';
import { BlueGems, preloadBlueGems } from './BlueGems';

const SPEED = 260;
const CONTROL_CODES = new Set([
  'KeyQ', 'Digit1', 'Digit2',
]);

type TilePosition = {
  column: number;
  row: number;  
}

type CharacterLocation = {
  currentTile: TilePosition;
  reservedTile: TilePosition | null;
};

type PushBox = {
  sprite: Phaser.GameObjects.Image;
  currentTile: TilePosition;
  reservedTile: TilePosition | null;
}

type LiftPlatform = {
  sprite: Phaser.GameObjects.Image;
  tile: TilePosition;
  baseHeight: number;
}

type LevelSwitch = {
  sprite: Phaser.GameObjects.Sprite;
  tile: TilePosition;
  activated: boolean; 
  lift: LiftPlatform;
  raisedHeight: number;
}

export class GameScene extends Phaser.Scene {
  private characters: Phaser.GameObjects.Sprite[] = [];
  private activeIndex = 0;
  private indicator!: Phaser.GameObjects.Image;
  private route: TilePosition[] = [];
  private characterLocations: CharacterLocation[] = [];
  private boxes: PushBox[] = [];
  private isMoving = false;
  private cells: (Cell | null)[][] = [];
  private characterViews: ('front-right' | 'back-right')[] = [];
  private teleportTiles: TilePosition[] = [];
  private cameraControls!: CameraControls;
  private gems!: BlueGems;
  private touchStartTile: TilePosition | null = null;

  private switches: LevelSwitch[] = [];
  private lifts: LiftPlatform[] = [];

  private readonly groundMap = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 0, 0, 1, 1, 1, 1],
    [1, 1, 1, 1, 0, 0, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
  ];

  private readonly platformX = 600;
  private readonly platformY = 140;

  constructor() { super('Game'); }

  // Art Assets
  preload(): void {
    preloadPlatformTextures(this);
    preloadBlueGems(this);
    this.load.image('box', '/assets/art/navigation/isometric_0086.png')
    this.load.image('characterIndicator', 'assets/art/hooded/characterIndicator.png');
    this.load.image('liftPlatform', 'assets/art/navigation/liftPlatform_03.png')

    this.load.spritesheet('teleport', 
      'assets/art/navigation/teleport_512.png',
    {
      frameWidth: 512,
      frameHeight: 256,
    },
  );
    
    this.load.spritesheet(
      'hooded-front-right',
      '/assets/art/hooded/CloakCharacter_315.png',
      {
        frameWidth: 90,
        frameHeight: 90,
      },
    );

    this.load.spritesheet(
      'hooded-back-right',
      '/assets/art/hooded/CloakCharacter_45.png',
      {
        frameWidth: 90,
        frameHeight: 90,
      }
    )

    for (let frame = 1; frame <= 4; frame++) {
      this.load.image(
        `switch-red-${frame}`,
        `/assets/art/navigation/switchRed_0${frame}.png`
      );
    }

    for (let frame = 1; frame <= 4; frame++) {
      this.load.image(
        `switch-green-${frame}`,
        `/assets/art/navigation/switchGreen_0${frame}.png`
      );
    }
  }

  create(): void {
    // Generated textures keep the foundation independent of external art.
    const graphics = this.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(0xffffff).fillRect(0, 0, 40, 56);
    graphics.generateTexture('character', 40, 56);
    
    graphics.destroy();

    //const floor = this.physics.add.staticImage(640, 680, 'floor');

    this.cameraControls = new CameraControls(this, () => {
      this.touchStartTile = null;
    });

    this.createLevelData();
    this.createPlatform(); // Create Platform (Level)

    this.gems = new BlueGems(this);
    for (const { column, row } of [{ column: 8, row: 5 }, { column: 0, row: 7 }]) {
      const centre = this.tileCentre(column, row);
      this.gems.place(column, row, centre.x, centre.y, this.tileDepth(column, row) + 0.75);
    }

    // Platform Navigation
    this. teleportTiles = [];

    this.createTeleportAnimation();
    this.createTeleport(8, 6);
    this.createTeleport(4, 2);

    this.switches = [];
    this.createSwitchAnimation();

    const lift = this.createLift(1, 7);

    if (lift) {
      this.createSwitch(9, 3, lift, 3);
    }    

    // Create and Animate Characters    
    this.createCharacterAnimations();
    this.createCharacters(); // Create Characters
    this.indicator = this.add.image(0, 0, 'characterIndicator')
      .setOrigin(0.5, -0.8)
      .setScale(0.2)
      .setDepth(10000);

    // Only the frontmost interactive objects receives the click
    this.input.setTopOnly(true);

    this.boxes = [];
    this.createBox(8, 4);
    
    // Listen on the focusable canvas only: other page elements keep their keys.
    const canvas = this.game.canvas;
    canvas.tabIndex = 0;
    // canvas.setAttribute(
    //   'aria-label',
    //   'Koinonia. Click a title to move. Q switches teammates. ' +
    //   '1 and 2 select a teammate.',
    // );

    const focus = () => {
      canvas.focus({ preventScroll: true });
    };

    const keyDown = (event: KeyboardEvent) => {
      if (!CONTROL_CODES.has(event.code)) return;

      event.preventDefault();
      if (event.repeat) return;

      if (event.code === 'KeyQ') this.select(1 - this.activeIndex);
      if (event.code === 'Digit1') this.select(0);
      if (event.code === 'Digit2') this.select(1);
    };

    canvas.addEventListener('pointerdown', focus);
    canvas.addEventListener('keydown', keyDown);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      canvas.removeEventListener('pointerdown', focus);
      canvas.removeEventListener('keydown', keyDown);

      this.route = [];
      this.isMoving = false;
    });

    this.select(0);
  }

  private createCharacters(): void {
    
    this.characterLocations = [
      {
        currentTile: { column: 1, row: 1},
        reservedTile: null,
      },
      {
        currentTile: { column: 2, row: 1},
        reservedTile: null,
      },
    ];

    const [locationA, locationB] = this.characterLocations;

    const spawnA = this.tileCentre(
      locationA.currentTile.column,
      locationA.currentTile.row,
    )

    const spawnB = this.tileCentre(
      locationB.currentTile.column,
      locationB.currentTile.row,
    )

    this.characterViews = ['front-right', 'front-right'];

    this.characters = [
     this.add.sprite(spawnA.x, spawnA.y, 'hooded-front-right'),
     this.add.sprite(spawnB.x, spawnB.y, 'hooded-front-right')
    ];

    this.characters.forEach((character, index) => {
      character.setScale(1);
      character.setOrigin(0.5, 0.9);
      character.play('idle-front-right')

      const tile = this.characterLocations[index].currentTile;

      character.setDepth(
        this.tileDepth(tile.column, tile.row) + 1
      );
    });
  }

  private createCharacterAnimations(): void {
    const views = ['front-right', 'back-right'];

    for (const view of views) {
      const sheet = `hooded-${view}`;

      if (!this.anims.exists(`idle-${view}`)) {
        this.anims.create({
          key: `idle-${view}`,
          frames: this.anims.generateFrameNumbers(sheet, {
            start: 0,
            end: 3,
          }),
          frameRate: 6,
          repeat: -1,
        });
      }

      if (!this.anims.exists(`walk-${view}`)) {
        this.anims.create({
          key: `walk-${view}`,
          frames: this.anims.generateFrameNumbers(sheet, {
            start: 4,
            end: 7,
          }),
          frameRate: 8,
          repeat: -1,
        })
      }
    }
  }

  private stopCharacterMovement(characterIndex: number): void {
    this.route = [];
    this.isMoving = false;

    this.characterLocations[characterIndex].reservedTile = null;

    const view = this.characterViews[characterIndex];

    this.characters[characterIndex].play(`idle-${view}`, true);
  }

  private faceNextTile(characterIndex: number, from: TilePosition, next: TilePosition): void {
    
    const character = this.characters[characterIndex];

    if (next.column > from.column) {
      // Down-right
      this.characterViews[characterIndex] = 'front-right';
      character.setFlipX(false);
    } else if (next.row > from.row) {
      // Down-left.
      this.characterViews[characterIndex] = 'front-right';
      character.setFlipX(true);

    } else if (next.row < from.row) {
      // Up-right.
      this.characterViews[characterIndex] = 'back-right';
      character.setFlipX(false);

    } else {
      // Up-left.
      this.characterViews[characterIndex] = 'back-right';
      character.setFlipX(true);
  }
  }

  /* CREATE PLATFORM - [START] */

  private createPlatform(): void {
    
    this.cells.forEach((row, rowIndex) => {
      row.forEach((cell, columnIndex) => {
        if (!cell) return;

        const basePlatform = drawPlatformTile(
          this,
          cell,
          this.tileCentre(columnIndex, rowIndex),
          this.tileDepth(columnIndex, rowIndex),
          () => this.canReachTile(columnIndex, rowIndex),
        );

        basePlatform.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          if (this.hasLift(columnIndex, rowIndex)) return;

          this.game.canvas.focus({ preventScroll: true });

          if (pointer.wasTouch) {
            // Remember where the tap started. Don't move yet.
            this.touchStartTile = {
              column: columnIndex,
              row: rowIndex,
            };

            return;
          }

          if (pointer.leftButtonDown()) {
            this.handleTileClick(columnIndex, rowIndex);
          }
        });

        basePlatform.on('pointerup', (pointer: Phaser.Input.Pointer) => {
          if (this.hasLift(columnIndex, rowIndex)) return;
          if (!pointer.wasTouch || pointer.wasCanceled) return;
          if (this.cameraControls.isPinching) return;

          const start = this.touchStartTile;
          if (!start) return;

          // The finger must lift on the same tile where it started.
          if (start.column !== columnIndex || start.row !== rowIndex) {
            return;
          }

          // Allow a little finger wobble, but reject a drag.
          if (pointer.getDistance() > 12) return;

          this.handleTileClick(columnIndex, rowIndex);
        });
      });
    });
  }

  private handleTileClick(column: number, row: number): void {
    const levelSwitch = this.switches.find(({ tile }) =>
      tile.column === column && tile.row === row
    );

    if (levelSwitch) {
      this.tryPressSwitch(levelSwitch);
      return;
    }

    this.moveToTile(column, row);
  }

  /* CREATE PLATFORM - [END] */

  /* CREATE LEVEL DATA - PARTICULAR SURFACE IS WALKABLE OR NOT - [START] */

  private createLevelData(): void {
    this.cells = this.groundMap.map(row =>
      row.map(value =>
        value === 1 ? {height: 0, walkable: true} : null
      )
    );

    // Test layout: Remember cells[row][column]

    // A one-block step.
    this.cells[2][3] = { height: 1, walkable: true };

    // A two-block platform reachable through that step.
    this.cells[2][4] = { height: 2, walkable: true };

    // An obstacle: its top cannot be used.
    this.cells[3][2] = { height: 1, walkable: false };

    // An isolated two-block platform with no step beside it.
    this.cells[6][8] = { height: 2, walkable: true };
    this.cells[5][8] = { height: 2, walkable: true };
    this.cells[4][8] = { height: 2, walkable: true };
    this.cells[3][8] = { height: 2, walkable: true };
    this.cells[2][8] = { height: 2, walkable: true };
    this.cells[3][9] = { height: 2, walkable: true };

    // Higher platform only reachable using lift
    this.cells[7][0] = { height: 3, walkable: true };
  }

  private getCell(column: number, row: number): Cell | null {
    return this.cells[row]?.[column] ?? null;
  }

  private hasObstacle(column: number, row: number): boolean {
    const cell = this.cells[row]?.[column] ?? null;
    
    return cell !== null && !cell.walkable;
  }

  /* CREATE LEVEL DATA - PARTICULAR SURFACE IS WALKABLE OR NOT - [END] */

  /* PLATFORM NAVIGATION - [START] */

  private createTeleportAnimation(): void {
    if (this.anims.exists('teleport-active')) return;

    this.anims.create({
      key: 'teleport-active',
      frames: this.anims.generateFrameNumbers('teleport', {
        start: 1,
        end: 4,
      }),
      frameRate: 6,
      repeat: -1
    });
  }

  private createTeleport(column: number, row: number): void {
    const cell = this.getCell(column, row);
    if (!cell || !cell.walkable) return;

    const centre = this.tileCentre(column, row);

    this.add.sprite(centre.x, centre.y, 'teleport', 1)
      .setOrigin(0.5)
      .setScale(0.14)
      .setDepth(this.tileDepth(column, row) + 0.5)
      .play('teleport-active');

    this.teleportTiles.push({ column, row });
  }

  private tryTeleport(characterIndex: number): boolean {
    if (this.teleportTiles.length !== 2) return false;

    const location = this.characterLocations[characterIndex];
    const current = location.currentTile;

    // Is the character standing on either portal????
    const portalIndex = this.teleportTiles.findIndex(tile =>
      tile.column === current.column &&
      tile.row === current.row
    );

    if (portalIndex === -1) return false;

    // Portal 0 leads to portal 1, and portal 1 leads to portal 0
    const destination = this.teleportTiles[portalIndex === 0 ? 1 : 0];

    // Check whether another character occupies or reserves the portal
    if (!this.isWalkable(
      destination.column,
      destination.row,
      characterIndex,
    )) {
      return false;
    }

    // Cancel the remaining walking route and play the idle animation
    this.stopCharacterMovement(characterIndex);

    // Keep movement locked until the character has completely teleported
    this.isMoving = true;
    location.reservedTile = destination;

    const character = this.characters[characterIndex];
    const centre = this.tileCentre(
      destination.column,
      destination.row,
    );

    this.tweens.add({
      targets: character,
      alpha: 0,
      duration: 500,
      ease: 'Linear',

      onComplete: () => {
        // The character is invisible now ----->>>>> move it to the other portal
        character.setPosition(centre.x, centre.y);
        character.setDepth(
          this.tileDepth(destination.column, destination.row) + 1
        );
        
        location.currentTile = { ...destination };

        this.gems.collect(destination.column, destination.row, 500);
        this.tweens.add({
          targets: character,
          alpha: 1,
          duration: 500,
          ease: 'Linear',

          onComplete: () => {
            this.stopCharacterMovement(characterIndex);
          }
        });
      }
    });

    return true;
  }

  private hasBox(column: number, row: number): boolean {
    return this.boxes.some(box => {
      const occupiesTile =
        box.currentTile.column === column &&
        box.currentTile.row    === row;

      const reservesTile =
        box.reservedTile !== null &&
        box.reservedTile.column === column &&
        box.reservedTile.row === row;
      
      return occupiesTile || reservesTile;
    })
  }

  private createBox(column: number, row: number): void {
    // -1 for 3rd param means no character is excluded from the occupancy check
    if (!this.isWalkable(column, row, -1)) return;

    const centre = this.tileCentre(column, row);

    const sprite = this.add.image(centre.x, centre.y, 'box')
      .setDisplayOrigin(94, 142)
      .setScale(0.35)
      .setDepth(this.tileDepth(column, row) + 1)
      .setInteractive({
        pixelPerfect: true,
        alphaTolerance: 1
    });

    const box: PushBox = {
      sprite,
      currentTile: {column, row},
      reservedTile: null
    };

    this.boxes.push(box);

    sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.game.canvas.focus({ preventScroll: true});

      if (pointer.wasTouch) {
        this.touchStartTile = { ...box.currentTile };
        return;
      }

      if (pointer.leftButtonDown()) {
        this.tryPushBox(box);
      }
    });

    sprite.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.wasTouch || pointer.wasCanceled) return;
      if (this.cameraControls.isPinching || pointer.getDistance() > 12) return;

      // const start stores where the touch started
      const start = this.touchStartTile;
      if (!start) return;

      // did the touch begin on the same tile as the box you're releasing over???
      if ( start.column !== box.currentTile.column
        || start.row    !== box.currentTile.row
      ) {
        return;
      }

      this.tryPushBox(box);
    })
  }

  private tryPushBox(box: PushBox): void {
    if (this.isMoving) return;

    const characterIndex = this.activeIndex;
    const location = this.characterLocations[characterIndex];
    const playerTile = location.currentTile;
    const boxTile = { ...box.currentTile };

    // Direction from the character towards the box
    const columnChange = boxTile.column - playerTile.column;
    const rowChange    = boxTile.row - playerTile.row;

    // Must be exactly one neighbouring tile away
    // Diagonal positions do not count
    const distance = Math.abs(columnChange) + Math.abs(rowChange);

    if (distance !== 1) return;

    // Continue one more tile in that same direction
    const destination: TilePosition = {
      column: boxTile.column + columnChange,
      row: boxTile.row + rowChange
    };

    const playerCell = this.getCell(playerTile.column, playerTile.row);
    const boxCell    = this.getCell(boxTile.column, boxTile.row);
    const destinationCell = this.getCell(
      destination.column,
      destination.row
    );

    if (!playerCell || !boxCell || !destinationCell) return;

    // The character and box must stand at the same height
    if (playerCell.height !== boxCell.height) return;

    // Boxes cannot be pushed up steps or off Ledges
    if (destinationCell.height !== boxCell.height) return;

    if (!this.isWalkable(destination.column, destination.row, characterIndex)) {
      return;
    }

    const character = this.characters[characterIndex];

    this.faceNextTile(characterIndex, playerTile, boxTile);
    character.play(`wak-${this.characterViews[characterIndex]}`, true);

    const playerStart = this.tileCentre(playerTile.column, playerTile.row);
    const boxStart = this.tileCentre(boxTile.column, boxTile.row);
    const boxEnd = this.tileCentre(destination.column, destination.row);

    const playerStartDepth = this.tileDepth(playerTile.column, playerTile.row);
    const boxStartDepth = this.tileDepth(boxTile.column, boxTile.row);
    const boxEndDepth = this.tileDepth(destination.column, destination.row);

    this.route = [];
    this.isMoving = true;

    // Reserve where both objects are going
    location.reservedTile = boxTile;
    box.reservedTile = destination;

    const pushDuration = 300;
    this.gems.collect(boxTile.column, boxTile.row, pushDuration);
    const progress = { value: 0 };

    this.tweens.add({
      targets: progress,
      value: 1,
      duration: pushDuration,
      ease: 'Linear',

      onUpdate: () => {
        const t = progress.value;

        // The character walks into the box's old position
        character.setPosition(
          Phaser.Math.Linear(playerStart.x, boxStart.x, t),
          Phaser.Math.Linear(playerStart.y, boxStart.y, t)
        );

        character.setDepth(
          Phaser.Math.Linear(playerStartDepth, boxStartDepth, t) + 1
        );

        // The box slides into the next tile
        box.sprite.setPosition(
          Phaser.Math.Linear(boxStart.x, boxEnd.x, t),
          Phaser.Math.Linear(boxStart.y, boxEnd.y, t)
        );

        box.sprite.setDepth(
          // Math.max chooses the max depth of the box and then we add +1 to place the box above any tile below it
          Math.max(boxStartDepth, boxEndDepth) + 1
        );
      },

      onComplete: () => {
        // Both player and box have arrived at the destination
        // Restore their normal drawing order (i.e depth)
        box.sprite.setDepth(boxEndDepth + 1);
        character.setDepth(boxStartDepth + 1);

        box.currentTile = destination;
        box.reservedTile = null;

        location.currentTile = boxTile;
        location.reservedTile = null;

        // Preserve portal behaviour if the character enters a portal tile
        if (!this.tryTeleport(characterIndex)) {
          this.stopCharacterMovement(characterIndex);
        }
      }
    })
  }

  private createSwitchAnimation(): void {
    for (const colour of ['red', 'green']) {
      const animationKey = `switch-${colour}-glow`;

      if (this.anims.exists(animationKey)) continue;

      this.anims.create({
        key: animationKey,
        frames: [
          { key: `switch-${colour}-1` },
          { key: `switch-${colour}-2` },
          { key: `switch-${colour}-3` },
          { key: `switch-${colour}-4` },
        ],
        frameRate: 5, // increase to get faster animation
        repeat: -1, // loop
      });
    }
  }

  private createSwitch(column: number, row: number, lift: LiftPlatform, raisedHeight: number): void {
    const cell = this.getCell(column, row);
    if (!cell || !cell.walkable) return;

    const centre = this.tileCentre(column, row);

    const sprite = this.add.sprite(centre.x, centre.y, 'switch-red-1')
      .setOrigin(0.5, 0.83)
      .setScale(0.25, 0.20)
      .setDepth(this.tileDepth(column, row) + 1)
      .setInteractive({
        pixelPerfect: true,
        alphaTolerance: 1
      })
      .play('switch-red-glow');

    const levelSwitch: LevelSwitch = {
      sprite,
      tile: { column, row },
      activated: false,
      lift,
      raisedHeight    
    };

    this.switches.push(levelSwitch);

    let touchStartedOnSwitch = false;

    sprite.on('pointerout', () => {
      touchStartedOnSwitch = false;
    });

    sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.game.canvas.focus({ preventScroll: true });

      if (pointer.wasTouch) {
        touchStartedOnSwitch = true;
        this.touchStartTile = { column, row };
        return;
      }

      if (pointer.leftButtonDown()) {
        this.tryPressSwitch(levelSwitch);
      }
    });

    sprite.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.wasTouch) return;

      const startedHere = touchStartedOnSwitch;
      touchStartedOnSwitch = false;

      if (!startedHere || pointer.wasCanceled) return;
      if (this.cameraControls.isPinching || pointer.getDistance() > 12) return;

      const start = this.touchStartTile;
      if (!start || start.column !== column || start.row !== row) return;

      this.tryPressSwitch(levelSwitch);
    });
  }

  private tryPressSwitch(levelSwitch: LevelSwitch): void {
    if (this.isMoving) return;

    const playerTile = this.characterLocations[this.activeIndex].currentTile;

    const switchTile = levelSwitch.tile;

    const distance =
      Math.abs(playerTile.column - switchTile.column) +
      Math.abs(playerTile.row - switchTile.row);

    // The character must be directly beside the switch, not diagonal
    if (distance !== 1) return;

    const playerCell = this.getCell(playerTile.column, playerTile.row);
    const switchCell = this.getCell(switchTile.column, switchTile.row);

    if (!playerCell || !switchCell) return;

    // Prevent presssing a switch from a different floor height
    if (playerCell.height !== switchCell.height) return;

    levelSwitch.activated = !levelSwitch.activated;
    levelSwitch.sprite.play(levelSwitch.activated ? 'switch-green-glow' : 'switch-red-glow');

    const targetHeight = levelSwitch.activated ? levelSwitch.raisedHeight : levelSwitch.lift.baseHeight;

    this.moveLift(levelSwitch.lift, targetHeight);
  }

  private moveLift(lift: LiftPlatform, targetHeight: number): void {
    const cell = this.getCell(lift.tile.column, lift.tile.row);

    if (!cell || this.isMoving || cell.height === targetHeight) return;

    const heightChange = targetHeight - cell.height;

    // Screen Y gets smaller when something moves around
    const verticalChange =  -heightChange * blockPixelHeight;

    // Remember every character currently standing on this lift
    const passengers = this.characters.filter((_, index) => {
      const tile = this.characterLocations[index].currentTile;

      return tile.column === lift.tile.column &&
        tile.row === lift.tile.row;
    })
    .map(sprite => ({
      sprite,
      startY: sprite.y
    }));

    // Carry a box too, if one has been pushed onto the lift
    const carriedBoxes = this.boxes
      .filter(box => 
        box.currentTile.column === lift.tile.column &&
        box.currentTile.row === lift.tile.row
      )
      .map(box => ({
        sprite: box.sprite,
        startY: box.sprite.y
      }));

      const startY = lift.sprite.y;
      const progress = { value: 0 };

      this.route = [];
      this.isMoving = true;
      lift.sprite.clearTint();

      this.tweens.add({
        targets: progress,
        value: 1,
        duration: Math.abs(heightChange) * 600,
        ease: 'Sine.InOut',

        onUpdate: () => {
          const offset = verticalChange * progress.value;

          lift.sprite.y = startY + offset;

          for (const passenger of passengers) {
            passenger.sprite.y = passenger.startY + offset;
          }

          for (const box of carriedBoxes) {
            box.sprite.y = box.startY + offset;
          }
        },

        onComplete: () => {
          lift.sprite.y = startY + verticalChange;

          for (const passenger of passengers) {
            passenger.sprite.y = passenger.startY + verticalChange;
          }

          for (const box of carriedBoxes) {
            box.sprite.y = box.startY + verticalChange;
          }

          // Pathfinding now treats this cell as the new floor level
          cell.height = targetHeight;

          this.isMoving = false;
        }
      });
  }

  private hasLift(column: number, row: number): boolean {
    return this.lifts.some(lift => 
      lift.tile.column === column &&
      lift.tile.row === row
    );
  }

  private createLift(column: number, row: number): LiftPlatform | null {
    const cell = this.getCell(column, row);
    if (!cell || !cell.walkable) return null;

    const centre = this.tileCentre(column, row);

    const borderOverlap = -5;

    const sprite = this.add.image(centre.x, centre.y, 'liftPlatform')
      .setDisplayOrigin(128, 84)
      .setScale(
        (tileWidth + borderOverlap) / 256,
        (tileHeight + borderOverlap) / 128
      )
      .setDepth(this.tileDepth(column, row) + 0.5);

    const lift: LiftPlatform = {
      sprite,
      tile: {column, row},
      baseHeight: cell.height
    };

    this.lifts.push(lift);

    // Only the lift's top surface is clickable
    const diamond = new Phaser.Geom.Polygon([
      128, 0,
      256, 64,
      128, 128,
      0, 64
    ]);

    sprite.setInteractive(diamond, Phaser.Geom.Polygon.Contains);

    sprite.on('pointerover', () => {
      const reachable = this.canReachTile(column, row);
      sprite.setTint(reachable ? 0x88ff88 : 0xff6666);
    });

    sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.game.canvas.focus({ preventScroll: true });

      if (pointer.wasTouch) {
        this.touchStartTile = { column, row };
        return;
      }

      if (pointer.leftButtonDown()) {
        this.moveToTile(column, row);
      }
    });

    sprite.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.wasTouch || pointer.wasCanceled) return;
      if (this.cameraControls.isPinching || pointer.getDistance() > 12) return;

      const start = this.touchStartTile;
      if (!start || start.column !== column || start.row !== row) return;

      this.moveToTile(column, row);
    });

    return lift;
  }

  /* PLATFORM NAVIGATION - [END] */

  /* MOVE CHARACTER ALONG A PATH - [START] */

  private moveToTile(column: number, row: number): void {
    if (this.isMoving) return;
    if (!this.isWalkable(column, row, this.activeIndex)) return;

   const start = this.characterLocations[this.activeIndex].currentTile;

    if (start.column === column && start.row == row) {
      this.tryTeleport(this.activeIndex);
      return;
    }

    this.route = this.findPath(start, { column, row }, this.activeIndex);
    this.followRoute(this.activeIndex);
  }

  private followRoute(characterIndex: number): void {
    const next = this.route.shift();
    const location = this.characterLocations[characterIndex];

    if (!next) {
      this.stopCharacterMovement(characterIndex);
      return;
    }

    const from = location.currentTile;

    // Recheck before every step
    if (!this.canStep(from, next, characterIndex)) {
      this.stopCharacterMovement(characterIndex);
      return;
    }

    const fromCell = this.getCell(from.column, from.row);
    const toCell   = this.getCell(next.column, next.row);

    if (!fromCell || !toCell) {
      this.stopCharacterMovement(characterIndex);
      return;
    }

    const character = this.characters[characterIndex];
    const target    = this.tileCentre(next.column, next.row);

    const startX = character.x;
    const startY = character.y;

    const isJump = fromCell.height !== toCell.height;

    this.faceNextTile(characterIndex, from, next);

    const view = this.characterViews[characterIndex];

    if (isJump) {
      // Still pose but face correct way while jumping
      character.anims.stop();
      character.setTexture(`hooded-${view}`, 0);
    } else {
      character.play(`walk-${view}`, true);
    }

    // Additional lift above the line connecting both surfaces
    const jumpHeight = isJump ? blockPixelHeight + 12 : 0;

    const stepDistance = Math.hypot(
      tileWidth / 2,
      tileHeight / 2,
    );

    const startDepth = this.tileDepth(from.column, from.row);
    const endDepth   = this.tileDepth(next.column, next.row);

    this.isMoving = true;

    // Treating both tile as occupied during animation
    // Keep the current tile occupied and reserve the next one.
    location.reservedTile = next;

    const stepDuration = isJump ? 350 : stepDistance / SPEED * 1000;
    this.gems.collect(next.column, next.row, stepDuration);

    // Animate a value from 0 to 1, then calculate the position
    const progress = { value: 0 };

    this.tweens.add({
      targets: progress,
      value: 1,
      duration: stepDuration,
      ease: 'Linear',

      onUpdate: () => {
        const t = progress.value;

        character.x = Phaser.Math.Linear(startX, target.x, t);

        character.y = 
          Phaser.Math.Linear(startY, target.y, t)
          - Math.sin(Math.PI * t) * jumpHeight;

        character.setDepth(
          Phaser.Math.Linear(startDepth, endDepth, t) + 1,
        );
      },
      
      onComplete: () => {
        character.setPosition(target.x, target.y);
        character.setDepth(endDepth + 1);

        location.currentTile = next; // Character has reached this (next) tile
        location.reservedTile = null; // Character has arrived at this tile, Clear the reservation (set to null)

        // Portal takes over movement and cancels the remaining route
        if (this.tryTeleport(characterIndex)) return;

        this.followRoute(characterIndex);
      },
    });
  }

  private isWalkable(column: number, row: number, movingCharacterIndex: number): boolean {
    
    if (!this.getCell(column, row)) return false;
    if (this.hasObstacle(column, row)) return false;
    if (this.hasBox(column, row)) return false;
    if (this.switches.some(levelSwitch =>
      levelSwitch.tile.column === column &&
      levelSwitch.tile.row === row
    )) {
      return false;
    }

    // Ground exist, no obstacle -> check whether character can occupy it
    return !this.hasOtherCharacter(column, row, movingCharacterIndex);
  }

  private hasOtherCharacter(column: number, row: number, movingCharacterIndex: number): boolean {

    return this.characterLocations.some((location, index) => {
      // A character must not block its own movement
      if (index === movingCharacterIndex) return false;

      const occupiesTile = 
        location.currentTile.column === column &&
        location.currentTile.row === row;

      const reservedTile =
        location.reservedTile != null &&
        location.reservedTile.column === column &&
        location.reservedTile.row == row;

      return occupiesTile || reservedTile;
    })
  }

  private canStep(from: TilePosition, to: TilePosition, movingCharacterIndex: number) : boolean {

    // Only directly neighbouring cells are allowed
    const separation = 
      Math.abs(to.column - from.column) +
      Math.abs(to.row - from.row);

      if (separation != 1) return false;

      const fromCell = this.getCell(from.column, from.row);
      const toCell = this.getCell(to.column, to.row);

      if (!fromCell || !toCell) return false;

      if (!this.isWalkable(to.column, to.row, movingCharacterIndex)) return false;

      return Math.abs(toCell.height - fromCell.height) <= 1;
  }

  private canReachTile(column: number, row: number): boolean {

    if (!this.isWalkable(column, row, this.activeIndex)) {
      return false;
    }

    const start = this.characterLocations[this.activeIndex].currentTile;

    // Already standing here - no route is needed
    if (start.column === column && start.row === row) {
      return true;
    }

    const path = this.findPath(
      start,
      { column, row },
      this.activeIndex
    );

    return path.length > 0;
  }
  
  /* MOVE CHARACTER ALONG A PATH - [END] */

  private findPath( start: TilePosition, destination: TilePosition, movingCharacterIndex: number) : TilePosition[] {
    
    const key = (tile: TilePosition) => `${tile.column}, ${tile.row}`;

    const queue: TilePosition[] = [start];

    // Record which tile we came from to reach each visited tile
    const previous = new Map<string, TilePosition | null>();
    previous.set(key(start), null);

    const directions = [
      { column: 1, row: 0 },
      { column: -1, row: 0 },
      { column: 0, row: 1 },
      { column: 0, row: -1 },
    ];

    for (let index = 0; index < queue.length; index++) {
      const current = queue[index];

      if (key(current) === key(destination)) {
        const path: TilePosition[] = [];
        let tile = current;

        // Trace backwards to the start
        while (key(tile) != key(start)) {
          path.push(tile);
          tile = previous.get(key(tile))!;
        }

        return path.reverse();
      }

      for (const direction of directions) {
        const next = {
          column: current.column + direction.column,
          row: current.row + direction.row,
        };

        if (previous.has(key(next))) continue;

        if (!this.canStep(current, next, movingCharacterIndex)) continue;

        previous.set(key(next), current);
        queue.push(next);
      }
    }

    // No route exists
    return[];
  }

  /* BINDING/RESTRICTING CHARACTER MOVEMENT TO THE PLATFORM PER TILE - [START] */

  // Find the centre of a tile's top surface
  private tileCentre(column: number, row: number) {
    const height = this.getCell(column, row)?.height ?? 0;

    return {
      x: this.platformX 
        + (column - row) * tileWidth / 2,

      y: this.platformY 
        + (column + row + 1) * tileHeight / 2
        - height * blockPixelHeight,
    };
  }

  private tileDepth(column: number, row: number): number {
    return -10000 + (column + row) * 100;
  }

  private select(index: number): void {
    if(index !== this.activeIndex) {
      // Finish the current step, but cancel the remaining route
      this.route = [];
    }

    this.activeIndex = index;
    this.updateIndicator();
  }

  update(): void {
    this.updateIndicator();
  }

  private updateIndicator(): void {
    const active = this.characters[this.activeIndex];
    if (!active) return;

    this.indicator.setAlpha(active.alpha);
    this.indicator.setPosition(
      active.x, 
      active.y - 100
    );
  }
}
