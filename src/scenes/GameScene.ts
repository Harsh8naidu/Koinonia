import Phaser from 'phaser';

const SPEED = 260;
const JUMP_SPEED = 520;
const CONTROL_CODES = new Set([
  'KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyS', 'KeyW', 'ArrowUp', 'ArrowDown',
  'KeyQ', 'Digit1', 'Digit2',
]);

export class GameScene extends Phaser.Scene {
  private characters: Phaser.Physics.Arcade.Image[] = [];
  private labels: Phaser.GameObjects.Text[] = [];
  private activeIndex = 0;
  private held = new Set<string>();
  private jumpQueued = false;
  private indicator!: Phaser.GameObjects.Text;
  private status!: Phaser.GameObjects.Text;

  constructor() { super('Game'); }

  // Art Assets
  preload(): void {
    this.load.image('platform-tile', '/assets/art/stone_E.png');
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
    this.characters = [
      this.physics.add.image(380, 600, 'character').setTint(0xf0bf75),
      this.physics.add.image(520, 600, 'character').setTint(0x83d4da),
    ];
    this.characters.forEach((character, index) => {
      const body = character.body as Phaser.Physics.Arcade.Body;
      body.setAllowGravity(false);

      character.setCollideWorldBounds(true);
      
      this.labels.push(this.add.text(character.x, character.y, index === 0 ? 'A' : 'B', {
        fontFamily: 'monospace', 
        fontSize: '22px', 
        color: '#10232c',
      }).setOrigin(0.5));
    });
  }

  private createPlatform(): void {
    const columns = 9;
    const rows = 9;
    const tileScale = 0.5;

    // Top surface dimensions, excluding stone thickness
    const tileWidth = 256 * tileScale;
    const tileHeight = 128 * tileScale;

    const startX = 600;
    const startY = 140;

    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const x = startX + (column - row) * (tileWidth / 2);
        const y = startY + (column + row) * (tileHeight / 2);

        this.add.image(x, y, 'platform-tile')
          .setOrigin(0.5, 0)
          .setScale(tileScale)
          .setDepth(-1000 + row + column);
      }
    }
  }

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
    this.characters[this.activeIndex].setVelocityX(0);
    this.activeIndex = index;
    this.jumpQueued = false;
    this.status.setText(`Active teammate: ${index === 0 ? 'A' : 'B'}   ·   Q to switch`);
  }

  update(): void {
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
    }

    active.setVelocity(dx * SPEED, dy * SPEED);

    this.characters.forEach((character, index) => {
      this.labels[index].setPosition(character.x, character.y);
    });

    this.indicator.setPosition(active.x, active.y - 40);
  }
}
