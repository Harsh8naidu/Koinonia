import Phaser from 'phaser';

const SPEED = 260;
const CONTROL_CODES = new Set([
  'KeyQ', 'Digit1', 'Digit2',
]);

type TilePosition = {
  column: number;
  row: number;  
}

export class GameScene extends Phaser.Scene {
  private characters: Phaser.GameObjects.Image[] = [];
  private labels: Phaser.GameObjects.Text[] = [];
  private activeIndex = 0;
  private indicator!: Phaser.GameObjects.Text;
  private status!: Phaser.GameObjects.Text;
  private route: TilePosition[] = [];
  private isMoving = false;

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

    // Create Platform
    this.createPlatform();

    this.createCharacters();

    this.uiElements();
    
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
    const spawnA = this.tileCentre(1, 1);
    const spawnB = this.tileCentre(2, 1);

    this.characters = [
      this.add.image(spawnA.x, spawnA.y, 'male-character-01'),
      
      this.add.image(spawnB.x, spawnB.y, 'male-character-02'),
    ];

    this.characters.forEach((character, index) => {
      character.setOrigin(0.5, 1);
      
      this.labels.push(this.add.text(character.x, character.y, index === 0 ? 'A' : 'B', {
        fontFamily: 'monospace', 
        fontSize: '22px', 
        color: '#10232c',
      }).setOrigin(0.5));
    });
  }

  private createPlatform(): void {
    
    const groundMap = this.groundMap;
    const scale = this.tileScale;
    const tileWidth = this.tileWidth;
    const tileHeight = this.tileHeight;
    const startX = this.platformX;
    const startY = this.platformY;

    groundMap.forEach((row, rowIndex) => {
      row.forEach((tile, columnIndex)  => {
        if(tile === 0) return;

        const x = 
          startX + (columnIndex - rowIndex) * tileWidth / 2;

        const y =
          startY + (columnIndex + rowIndex) * tileHeight / 2;
        
        const dirtLayers = 7;
        const layerSpacing = 6; // Vertical spacing in screen pixels

        for (let layer = dirtLayers; layer >= 1; layer--) {
          this.add.image(x, y + layer * layerSpacing, 'dirt-tile')
            .setOrigin(0.5, 0)
            .setScale(scale)
            .setDepth(
              -2000 - layer * 100 + rowIndex + columnIndex,
            );
        }

        const stone = this.add.image(x, y, 'platform-tile')
          .setOrigin(0.5, 0)
          .setScale(scale)
          .setDepth(-1000 + rowIndex + columnIndex);

          const diamond = new Phaser.Geom.Polygon([
            128, 0,
            256, 64,
            128, 128,
            0, 64,
          ]);

          stone.setInteractive(diamond, Phaser.Geom.Polygon.Contains);

          stone.on('pointerover', () => {
            stone.setTint(0x88ff88);
          });

          stone.on('pointerout', () => {
            stone.clearTint();
          });

          stone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (!pointer.leftButtonDown()) return;

            this.game.canvas.focus({ preventScroll: true });
            this.moveToTile(columnIndex, rowIndex);
          })
      });
    });
  }

  /* MOVE CHARACTER ALONG A PATH - [START] */

  private moveToTile(column: number, row: number): void {
    if (this.isMoving) return;
    if (this.groundMap[row]?.[column] != 1) return;

    const character = this.characters[this.activeIndex];

    const offsetX = character.x - this.platformX;
    const offsetY = character.y - this.platformY;

    const start: TilePosition = {
      column: Math.floor(
        offsetX / this.tileWidth + offsetY / this.tileHeight,
      ),
      row: Math.floor(
        offsetY / this.tileHeight - offsetX / this.tileWidth,
      ),
    };

    this.route = this.findPath(start, { column, row });
    this.followRoute(this.activeIndex);
  }

  private followRoute(characterIndex: number): void {
    const next = this.route.shift();

    if (!next) {
      this.isMoving = false;
      return;
    }

    this.isMoving = true;

    const character = this.characters[characterIndex];
    const target = this.tileCentre(next.column, next.row);

    const distance = Math.hypot(
      target.x - character.x,
      target.y - character.y,
    );

    this.tweens.add({
      targets: character,
      x: target.x,
      y: target.y,
      duration: distance / SPEED * 1000,
      ease: 'Linear',
      onComplete: () => {
        this.followRoute(characterIndex);
      },
    });
  }
  
  /* MOVE CHARACTER ALONG A PATH - [END] */

  private findPath( start:TilePosition, destination: TilePosition) : TilePosition[] {
    
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

        const isGround = this.groundMap[next.row]?.[next.column] === 1;

        if (!isGround || previous.has(key(next))) continue;

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
    return {
      x: this.platformX + (column - row) * this.tileWidth / 2,

      y : this.platformY + (column + row + 1) * this.tileHeight / 2,
    };
  }

  /* BINDING/RESTRICTING CHARACTER MOVEMENT TO THE PLATFORM PER TILE - [END] */

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
        character.y - character.displayHeight / 2
      );
    });

    this.indicator.setPosition(
      active.x, 
      active.y - active.displayHeight - 12
    );
  }
}
