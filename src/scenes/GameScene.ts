import Phaser from 'phaser';

const SPEED = 260;
const JUMP_SPEED = 520;
const CONTROL_CODES = new Set([
  'KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyS', 'KeyW', 'ArrowUp', 'ArrowDown',
  'KeyQ', 'Digit1', 'Digit2',
]);

export class GameScene extends Phaser.Scene {
  private characters: Phaser.GameObjects.Image[] = [];
  private labels: Phaser.GameObjects.Text[] = [];
  private activeIndex = 0;
  private held = new Set<string>();
  private jumpQueued = false;
  private indicator!: Phaser.GameObjects.Text;
  private status!: Phaser.GameObjects.Text;

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
    canvas.setAttribute('aria-label', 'Koinonia game. Move with A and D, jump with Space, switch with Q or select with 1 and 2.');
    const focus = () => canvas.focus({ preventScroll: true });
    const clear = () => { this.held.clear(); this.jumpQueued = false; };
    const keyDown = (event: KeyboardEvent) => {
      if (!CONTROL_CODES.has(event.code)) return;
      event.preventDefault();
      this.held.add(event.code);
      if (event.repeat) return;
      if (event.code === 'KeyQ') this.select(1 - this.activeIndex);
      if (event.code === 'Digit1') this.select(0);
      if (event.code === 'Digit2') this.select(1);
      if (['Space', 'KeyW', 'ArrowUp'].includes(event.code)) this.jumpQueued = true;
    };
    const keyUp = (event: KeyboardEvent) => { this.held.delete(event.code); };
    canvas.addEventListener('pointerdown', focus);
    canvas.addEventListener('keydown', keyDown);
    canvas.addEventListener('keyup', keyUp);
    canvas.addEventListener('blur', clear);
    window.addEventListener('blur', clear);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      canvas.removeEventListener('pointerdown', focus);
      canvas.removeEventListener('keydown', keyDown);
      canvas.removeEventListener('keyup', keyUp);
      canvas.removeEventListener('blur', clear);
      window.removeEventListener('blur', clear);
    });
    this.select(0);
  }

  private createCharacters(): void {
    const spawnA = this.tileCentre(1, 1);
    const spawnB = this.tileCentre(2, 1);

    this.characters = [
      this.add.image(spawnA.x, spawnA.y, 'character').setTint(0xf0bf75),
      
      this.add.image(spawnB.x, spawnB.y, 'character').setTint(0x83d4da),
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

        this.add.image(x, y, 'platform-tile') // Main tile
          .setOrigin(0.5, 0)
          .setScale(scale)
          .setDepth(-1000 + rowIndex + columnIndex);
      });
    });
  }

  /* BINDING/RESTRICTING CHARACTER MOVEMENT TO THE PLATFORM PER TILE - [START] */

  // Find the centre of a tile's top surface
  private tileCentre(column: number, row: number) {
    return {
      x: this.platformX + (column - row) * this.tileWidth / 2,

      y : this.platformY + (column + row + 1) * this.tileHeight / 2,
    };
  }

  // Find which tile contains a world position
  private isGroundAt(x: number, y: number): boolean {
    const offsetX = x - this.platformX;
    const offsetY = y - this.platformY;

    const column = Math.floor(
      offsetX / this.tileWidth + offsetY / this.tileHeight,
    );

    const row = Math.floor(
      offsetY / this.tileHeight - offsetX / this.tileWidth,
    );

    return this.groundMap[row]?.[column] === 1;
  }

  private canStandAt(x: number, y: number): boolean {
    const halfWidth = 8;
    const halfHeight = 4;

    return (
      this.isGroundAt(x - halfWidth, y - halfHeight) &&
      this.isGroundAt(x + halfWidth, y - halfHeight) &&
      this.isGroundAt(x - halfWidth, y + halfHeight) &&
      this.isGroundAt(x + halfWidth, y + halfHeight)
    )
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
    this.activeIndex = index;

    this.status.setText(`Active teammate: ${index === 0 ? 'A' : 'B'}   ·   Q to switch`);
  }

  update(_time: number, delta: number): void {
    const active = this.characters[this.activeIndex];
    if (!active) return;

    const left = this.held.has('KeyA') || this.held.has('ArrowLeft');
    const right = this.held.has('KeyD') || this.held.has('ArrowRight');
    const up = this.held.has('KeyW') || this.held.has('ArrowUp');
    const down = this.held.has('KeyS') || this.held.has('ArrowDown');

    let dx = Number(right) - Number(left);
    let dy = Number(down) - Number(up);

    // Clamp the diagonal movement speed
    const length = Math.hypot(dx, dy);

    if (length > 0) {
      dx /= length;
      dy /= length;

    // Convert pixels per second to this frame's distance
    // Cap long frames to prevent sudden large jumps
    const distance = SPEED * Math.min(delta, 50) / 1000;

    // Check small steps so movement cannot skip across holes.
    const steps = Math.max(1, Math.ceil(distance / 2));
    const stepX = dx * distance / steps;
    const stepY = dy * distance / steps;

    for (let step = 0; step < steps; step++) {
      if (this.canStandAt(active.x + stepX, active.y)) {
        active.x += stepX;
      }

      if (this.canStandAt(active.x, active.y + stepY)) {
        active.y += stepY;        
      }
    }
  }

    this.characters.forEach((character, index) => {
      this.labels[index].setPosition(character.x, character.y - character.displayHeight / 2);
    });

    this.indicator.setPosition(active.x, active.y - 40);
  }
}
