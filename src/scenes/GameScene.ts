import Phaser from 'phaser';

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

type LevelSwitch = {
  sprite: Phaser.GameObjects.Sprite;
  tile: TilePosition;
  activated: boolean;  
}

type Cell = {
  height: number; // Height of gameplay blocks
  walkable: boolean; // Used for both taller surfaces as well as obstacles
}

export class GameScene extends Phaser.Scene {
  private characters: Phaser.GameObjects.Sprite[] = [];
  private activeIndex = 0;
  private indicator!: Phaser.GameObjects.Image;
  private status!: Phaser.GameObjects.Text;
  private route: TilePosition[] = [];
  private characterLocations: CharacterLocation[] = [];
  private boxes: PushBox[] = [];
  private isMoving = false;
  private cells: (Cell | null)[][] = [];
  private characterViews: ('front-right' | 'back-right')[] = [];
  private teleportTiles: TilePosition[] = [];
  private baseCameraZoom = 1;
  private zoomMultiplier = 1;
  private cameraFocus = {x: 640, y: 360};

  private pinching = false;
  private touchStartTile: TilePosition | null = null;

  private switches: LevelSwitch[] = [];

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

  private readonly tileScale = 0.5;
  private readonly blockPixelHeight = 93 * this.tileScale;
  private readonly tileWidth = 160 * this.tileScale;
  private readonly tileHeight = 92 * this.tileScale;
  private readonly platformX = 600;
  private readonly platformY = 140;

  constructor() { super('Game'); }

  // Art Assets
  preload(): void {
    this.load.image('platform-tile', '/assets/art/platform/isometric_0014.png');
    this.load.image('rock-grass-tile', '/assets/art/platform/isometric_0058.png');
    this.load.image('rock-tile', '/assets/art/platform/isometric_005.PNG');
    this.load.image('box', '/assets/art/navigation/isometric_0086.png')
    this.load.image('characterIndicator', 'assets/art/hooded/characterIndicator.png');

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

    // Camera
    const resizeCamera = () => {
      const widthRatio = this.scale.width / 1280;
      const heightRatio = this.scale.height / 720;
      const screenScale = Math.min(widthRatio, heightRatio, 1);

      const usesTouch = window.matchMedia('(pointer: coarse)').matches;

      // Adjust this number to change the mobile zoom
      const mobileZoomMultiplier = 1.3;

      const zoom = usesTouch
        ? 1.3 * screenScale * mobileZoomMultiplier
        : 1.3 * screenScale;

      this.baseCameraZoom = zoom;
      this.applyCameraZoom();

      this.cameras.main.centerOn(640, 360);
    }

    resizeCamera();

    this.scale.on(Phaser.Scale.Events.RESIZE, resizeCamera);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, resizeCamera);
    })

    this.setupZoomControls();

    this.createLevelData();
    this.createPlatform(); // Create Platform (Level)

    // Platform Navigation
    this. teleportTiles = [];

    this.createTeleportAnimation();
    this.createTeleport(8, 6);
    this.createTeleport(4, 2);

    this.switches = [];
    this.createSwitchAnimation();
    this.createSwitch(5, 8);    

    // Create and Animate Characters    
    this.createCharacterAnimations();
    this.createCharacters(); // Create Characters

    // Only the frontmost interactive objects receives the click
    this.input.setTopOnly(true);

    this.boxes = [];
    this.createBox(8, 5);

    this.uiElements(); // In Game UI
    
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

  // ADJUST ZOOM FOR ANDROID AND PC
  private setupZoomControls(): void {
    const first = this.input.pointer1;
    const second = this.input.pointer2;

    let previousDistance = 0;

    let previousMiddle = { x: 0, y: 0};

    const fingerMiddle = () => {
      return {
        x: (first.x + second.x) / 2,
        y: (first.y + second.y) / 2
      };
    };

    const fingerDistance = () => {
      return Phaser.Math.Distance.Between(
        first.x,
        first.y,
        second.x,
        second.y
      );
    };

    const onWheel = (
      _pointer = Phaser.Input.Pointer,
      _objects: Phaser.GameObjects.GameObject[],
      _deltaX: number,
      deltaY: number,
    ) => {
      if (deltaY === 0) return;

      const change = deltaY < 0 ? 1.1 : 1 / 1.1;

      this.zoomMultiplier *= change;
      this.applyCameraZoom();
    };

    const onPointerDown = () => {
      if (!first.isDown || !second.isDown) return;

      this.pinching = true;
      this.touchStartTile = null;

      previousDistance = fingerDistance();
      previousMiddle = fingerMiddle();
    };

    const onPointerMove = (pointer: Phaser.Input.Pointer) => {
      if (!pointer.wasTouch && pointer.middleButtonDown()) {
        const camera = this.cameras.main;

        this.cameraFocus.x -= (pointer.x - pointer.prevPosition.x) / camera.zoom;

        this.cameraFocus.y -= (pointer.y - pointer.prevPosition.y) / camera.zoom;

        camera.centerOn(this.cameraFocus.x, this.cameraFocus.y);
        return;
      }

      if (!this.pinching || !first.isDown || !second.isDown) return;

      const camera = this.cameras.main;
      const middle = fingerMiddle();
      const distance = fingerDistance();

      // Remeber the world position underneath the previous finger midpoint
      const worldPoint = {
        x: this.cameraFocus.x
          + (previousMiddle.x - camera.width / 2) / camera.zoom,

        y: this.cameraFocus.y
          + (previousMiddle.y - camera.height / 2) / camera.zoom
      };

      if (previousDistance > 0 && distance > 0) {
        this.zoomMultiplier *= distance / previousDistance;
      }

      this.applyCameraZoom();

      // Move the camera so that world position follows the fingers
      this.cameraFocus.x =
        worldPoint.x - (middle.x - camera.width / 2) / camera.zoom;

      this.cameraFocus.y =
        worldPoint.y - (middle.y - camera.height / 2) / camera.zoom;

      camera.centerOn(this.cameraFocus.x, this.cameraFocus.y);

      previousDistance = distance;
      previousMiddle = middle;
    }

    const onPointerUp = () => {
      this.touchStartTile = null;
      previousDistance = 0;

      // A pinch ends only after both finger have lifted
      if (!first.isDown && !second.isDown) {
        this.pinching = false;
      }
    };

    const resetGesture = () => {
      this.touchStartTile = null;
      this.pinching = false;
      previousDistance = 0;
    };

    resetGesture();

    this.input.on('wheel', onWheel);
    this.input.on('pointerdown', onPointerDown);
    this.input.on('pointermove', onPointerMove);
    this.input.on('pointerup', onPointerUp);
    this.input.on('pointerupoutside', onPointerUp);
    this.scale.on(Phaser.Scale.Events.RESIZE, resetGesture);

    this.game.events.on(Phaser.Core.Events.BLUR, resetGesture);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('wheel', onWheel);
      this.input.off('pointerdown', onPointerDown);
      this.input.off('pointermove', onPointerMove);
      this.input.off('pointerup', onPointerUp);
      this.input.off('pointerupoutside', onPointerUp);
      this.input.off(Phaser.Scale.Events.RESIZE, resetGesture);

      this.game.events.off(Phaser.Core.Events.BLUR, resetGesture);
      resetGesture();
    });
  }

  private applyCameraZoom(): void {
    this.zoomMultiplier = Phaser.Math.Clamp(
      this.zoomMultiplier,
      0.6,
      2.5,
    );

    this.cameras.main.setZoom(
      this.baseCameraZoom * this.zoomMultiplier
    );

    this.cameras.main.centerOn(this.cameraFocus.x, this.cameraFocus.y);
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

        const centre = this.tileCentre(columnIndex, rowIndex);

        // Images use their top corner as the vertical origin
        const topY = centre.y - this.tileHeight/2;

        const depth = cell.height === 0
        // Ordinary floor always stays behind characters
        ? -20000 + (columnIndex + rowIndex) * 100
        // Raised blocks can hide characters 
        : this.tileDepth(columnIndex, rowIndex);

        // Undo the height offset to find the main floor position.
        const baseTopY =
          topY + cell.height * this.blockPixelHeight;

        // Draw everything underneath the final top block.
        for (let level = 0; level < cell.height; level++) {
          const supportY =
            baseTopY - level * this.blockPixelHeight;

          const supportDepth = level === 0
            // Ground-level block stays behind characters.
            ? -20000 + (columnIndex + rowIndex) * 100
            // Higher supports stay behind this column's top block.
            : depth - (cell.height - level);

            const supportTexture = this.textureForLevel(level, cell.height);

          this.add.image(centre.x, supportY, supportTexture)
            .setDisplayOrigin(94, 3)
            .setScale(this.tileScale)
            .setDepth(supportDepth);
        }

        const topTexture = this.textureForLevel(cell.height, cell.height);

        const basePlatform = this.add.image(
          centre.x,
          topY,
          topTexture
        ).setDisplayOrigin(94, 3)
         .setScale(this.tileScale)
         .setDepth(depth);

         // Red is a temporary visual marker for blocked tops
        if (!cell.walkable) {
          basePlatform.setTint(0xcc6666);
        }
        
        const diamond = new Phaser.Geom.Polygon([
          94, 3,
          174, 49,
          94, 95,
          14, 49,
        ]);

        basePlatform.setInteractive(
          diamond,
          Phaser.Geom.Polygon.Contains
        );

        basePlatform.on('pointerover', () => {
          const reachable = this.canReachTile(columnIndex, rowIndex);
          basePlatform.setTint(reachable ? 0x88ff88 : 0xff6666);
        });

        basePlatform.on('pointerout', () => {
          if (cell.walkable) {
            basePlatform.clearTint();
          } else {
            basePlatform.setTint(0xcc6666);
          }
        });
        
        basePlatform.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          this.game.canvas.focus({ preventScroll: true });

          if (pointer.wasTouch) {
            // Remember where the tap started. Don't move yet.
            this.touchStartTile = {
              column: columnIndex,
              row: rowIndex,
            };

            return;
          }

          // Mouse clicks still move immediately.
          if (pointer.leftButtonDown()) {
            this.moveToTile(columnIndex, rowIndex);
          }
        });

        basePlatform.on('pointerup', (pointer: Phaser.Input.Pointer) => {
          if (!pointer.wasTouch || pointer.wasCanceled) return;
          if (this.pinching) return;

          const start = this.touchStartTile;
          if (!start) return;

          // The finger must lift on the same tile where it started.
          if (start.column !== columnIndex || start.row !== rowIndex) {
            return;
          }

          // Allow a little finger wobble, but reject a drag.
          if (pointer.getDistance() > 12) return;

          this.moveToTile(columnIndex, rowIndex);
        });
      });
    });
  }

  private textureForLevel(level: number, stackHeight: number): string {

    if (level === 0) {
      return 'platform-tile';
    }

    if (level === 1) {
      return this.hasTileAbove(level, stackHeight)
        ? 'rock-tile'
        : 'rock-grass-tile';
    }

    return 'rock-grass-tile'; // Level 2 and above
  }

  private hasTileAbove(level: number, stackHeight: number): boolean {
    return level < stackHeight;
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

    this.cells[8][5] = { height: 1, walkable: true };
    this.cells[7][5] = { height: 1, walkable: true };

    // An isolated two-block platform with no step beside it.
    this.cells[6][8] = { height: 2, walkable: true };
    this.cells[5][8] = { height: 2, walkable: true };
    this.cells[4][8] = { height: 2, walkable: true };
    this.cells[3][8] = { height: 2, walkable: true };
    this.cells[2][8] = { height: 2, walkable: true };
    this.cells[3][9] = { height: 2, walkable: true };
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
      if (this.pinching || pointer.getDistance() > 12) return;

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

    const progress = { value: 0 };

    this.tweens.add({
      targets: progress,
      value: 1,
      duration: 300,
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

  private createSwitch(column: number, row: number): void {
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
      activated: false      
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
      if (this.pinching || pointer.getDistance() > 12) return;

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
    const jumpHeight = isJump ? this.blockPixelHeight + 12 : 0;

    const stepDistance = Math.hypot(
      this.tileWidth / 2,
      this.tileHeight / 2,
    );

    const startDepth = this.tileDepth(from.column, from.row);
    const endDepth   = this.tileDepth(next.column, next.row);

    this.isMoving = true;

    // Treating both tile as occupied during animation
    // Keep the current tile occupied and reserve the next one.
    location.reservedTile = next;

    // Animate a value from 0 to 1, then calculate the position
    const progress = { value: 0 };

    this.tweens.add({
      targets: progress,
      value: 1,
      duration: isJump ? 350 : stepDistance / SPEED * 1000,
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
        + (column - row) * this.tileWidth / 2,

      y: this.platformY 
        + (column + row + 1) * this.tileHeight / 2
        - height * this.blockPixelHeight,
    };
  }

  private tileDepth(column: number, row: number): number {
    return -10000 + (column + row) * 100;
  }

  private uiElements(): void {
    this.add.text(-80, -30, 'FOUNDATION / 01', {
      fontFamily: 'monospace', fontSize: '16px', color: '#9aafb9',
    });
    this.status = this.add.text(-80, 0, '', { fontSize: '24px', color: '#ead19b' });
    this.add.text(-80, 35, 'Move, jump, and switch between your two teammates.', {
      fontSize: '18px', color: '#9aafb9',
    });
    this.indicator = this.add.image(0, 0, 'characterIndicator')
      .setOrigin(0.5, -0.8)
      .setScale(0.2)
      .setDepth(10000);
  }

  private select(index: number): void {
    if(index !== this.activeIndex) {
      // Finish the current step, but cancel the remaining route
      this.route = [];
    }

    this.activeIndex = index;

    this.status.setText(
      `Active teammate: ${index === 0 ? 'A' : 'B'}   ·   Q to switch`,
    );
  }

  update(time: number): void {
    const active = this.characters[this.activeIndex];
    if (!active) return;

    this.indicator.setAlpha(active.alpha);
    this.indicator.setPosition(
      active.x, 
      active.y - 100
    );
  }
}
