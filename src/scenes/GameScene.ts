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

type Cell = {
  height: number; // Height of gameplay blocks
  walkable: boolean; // Used for both taller surfaces as well as obstacles
}

export class GameScene extends Phaser.Scene {
  private characters: Phaser.GameObjects.Image[] = [];
  private labels: Phaser.GameObjects.Text[] = [];
  private activeIndex = 0;
  private indicator!: Phaser.GameObjects.Text;
  private status!: Phaser.GameObjects.Text;
  private route: TilePosition[] = [];
  private characterLocations: CharacterLocation[] = [];
  private isMoving = false;
  private cells: (Cell | null)[][] = [];

  // visual settings only
  private readonly layersPerBlock = 5;
  private readonly layerSpacing = 6;
  private readonly baseDirtLayers = 5;

  private readonly blockPixelHeight = this.layersPerBlock * this.layerSpacing;

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
  private readonly tileWidth = 256 * this.tileScale;
  private readonly tileHeight = 128 * this.tileScale;
  private readonly platformX = 600;
  private readonly platformY = 100;

  constructor() { super('Game'); }

  // Art Assets
  preload(): void {
    this.load.image('platform-tile', '/assets/art/stone_E.png');
    this.load.image('dirt-tile', '/assets/art/dirt_E.png');
    this.load.image('male-character-01', '/assets/art/Male_0_Idle0.png')
    this.load.image('male-character-02', '/assets/art/Male_1_Idle0.png')

  }

  create(): void {
    // Generated textures keep the foundation independent of external art.
    const graphics = this.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(0xffffff).fillRect(0, 0, 40, 56);
    graphics.generateTexture('character', 40, 56);
    
    graphics.destroy();

    //const floor = this.physics.add.staticImage(640, 680, 'floor');

    // Camera
    this.cameras.main.setZoom(0.85);

    this.createLevelData();
    this.createPlatform(); // Create Platform (Level)
    this.createCharacters(); // Create Characters
    this.uiElements(); // In Game UI
    
    // Listen on the focusable canvas only: other page elements keep their keys.
    const canvas = this.game.canvas;
    canvas.tabIndex = 0;
    canvas.setAttribute(
      'aria-label',
      'Koinonia. Click a title to move. Q switches teammates. ' +
      '1 and 2 select a teammate.',
    );

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

    this.characters = [
      this.add.image(spawnA.x, spawnA.y, 'male-character-01'),
      
      this.add.image(spawnB.x, spawnB.y, 'male-character-02'),
    ];

    this.characters.forEach((character, index) => {
      character.setOrigin(0.5, 1);

    const tile = this.characterLocations[index].currentTile;

    character.setDepth(
      this.tileDepth(tile.column, tile.row) + 1
    );
      
    this.labels.push(this.add.text(character.x, character.y, index === 0 ? 'A' : 'B', {
      fontFamily: 'monospace', 
      fontSize: '22px', 
      color: '#10232c',
    }).setOrigin(0.5));
  });
  }

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

        // Find the main floor's top, ignoring this cell's raised height.
        const baseTopY =
          topY + cell.height * this.blockPixelHeight;

        // The foundation always stays behind characters.
        const foundationDepth =
          -20000 + (columnIndex + rowIndex) * 100;

        // Dirt goes ONLY below the main floor.
        for (let layer = this.baseDirtLayers; layer >= 1; layer--) {
          this.add.image(
            centre.x,
            baseTopY + layer * this.layerSpacing,
            'dirt-tile',
          )
            .setOrigin(0.5, 0)
            .setScale(this.tileScale)
            .setDepth(foundationDepth - 1 - layer * 0.01);
        }

        // Build raised blocks from stone, starting at the main floor.
        const raisedLayers = cell.height * this.layersPerBlock;

        for (let layer = 0; layer < raisedLayers; layer++) {
          const layerDepth = layer === 0
            ? foundationDepth
            : depth - 1 - (raisedLayers - layer) * 0.01;

          this.add.image(
            centre.x,
            baseTopY - layer * this.layerSpacing,
            'platform-tile',
          )
            .setOrigin(0.5, 0)
            .setScale(this.tileScale)
            .setDepth(layerDepth);
        }

        const stone = this.add.image(
          centre.x,
          topY,
          'platform-tile'
        ).setOrigin(0.5, 0)
         .setScale(this.tileScale)
         .setDepth(depth);

         // Red is a temporary visual marker for blocked tops
        if (!cell.walkable) {
          stone.setTint(0xcc6666);
        }
        
        const diamond = new Phaser.Geom.Polygon([
          128, 0,
          256, 64,
          128, 128,
          0, 64,
        ]);

        stone.setInteractive(
          diamond,
          Phaser.Geom.Polygon.Contains
        );

        stone.on('pointerover', () => {
          const reachable = this.canReachTile(columnIndex, rowIndex);
          stone.setTint(reachable ? 0x88ff88 : 0xff6666);
        });

        stone.on('pointerout', () => {
          if (cell.walkable) {
            stone.clearTint();
          } else {
            stone.setTint(0xcc6666);
          }
        });
        
        stone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          if (!pointer.leftButtonDown()) return;

          this.game.canvas.focus({ preventScroll: true });
          this.moveToTile(columnIndex, rowIndex);
        });
      });
    });
  }

  /* MOVE CHARACTER ALONG A PATH - [START] */

  private moveToTile(column: number, row: number): void {
    if (this.isMoving) return;
    if (!this.isWalkable(column, row, this.activeIndex)) return;

   const start = 
    this.characterLocations[this.activeIndex].currentTile;

    this.route = this.findPath(start, { column, row }, this.activeIndex);
    this.followRoute(this.activeIndex);
  }

  private followRoute(characterIndex: number): void {
    const next = this.route.shift();
    const location = this.characterLocations[characterIndex];

    if (!next) {
      this.isMoving = false;
      return;
    }

    const from = location.currentTile;

    // Recheck before every step
    if (!this.canStep(from, next, characterIndex)) {
      this.route = [];
      this.isMoving = false;
      return;
    }

    const fromCell = this.getCell(from.column, from.row);
    const toCell   = this.getCell(next.column, next.row);

    if (!fromCell || !toCell) {
      return;
    }

    const character = this.characters[characterIndex];
    const target    = this.tileCentre(next.column, next.row);

    const startX = character.x;
    const startY = character.y;

    const isJump = fromCell.height !== toCell.height;

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

        this.followRoute(characterIndex);
      },
    });
  }

  private isWalkable(column: number, row: number, movingCharacterIndex: number): boolean {
    
    if (!this.getCell(column, row)) return false;
    if (this.hasObstacle(column, row)) return false;

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
  }

  private getCell(column: number, row: number): Cell | null {
    return this.cells[row]?.[column] ?? null;
  }

  private hasObstacle(column: number, row: number): boolean {
    const cell = this.cells[row]?.[column] ?? null;
    
    return cell !== null && !cell.walkable;
  }

  /* CREATE LEVEL DATA - PARTICULAR SURFACE IS WALKABLE OR NOT - [END] */

  private uiElements(): void {
    this.add.text(-80, -30, 'FOUNDATION / 01', {
      fontFamily: 'monospace', fontSize: '16px', color: '#9aafb9',
    });
    this.status = this.add.text(-80, 0, '', { fontSize: '24px', color: '#ead19b' });
    this.add.text(-80, 35, 'Move, jump, and switch between your two teammates.', {
      fontSize: '18px', color: '#9aafb9',
    });
    this.indicator = this.add.text(0, 0, '▼ ACTIVE', {
      fontFamily: 'monospace', fontSize: '16px', color: '#ffffff',
    }).setOrigin(0.5, 1);
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

  update(): void {
    const active = this.characters[this.activeIndex];
    if (!active) return;

    this.characters.forEach((character, index) => {
      this.labels[index].setPosition(
        character.x, 
        character.y - character.displayHeight / 2,
      )
      .setDepth(character.depth + 1);
    });

    this.indicator.setPosition(
      active.x, 
      active.y - active.displayHeight - 12
    );
  }
}
