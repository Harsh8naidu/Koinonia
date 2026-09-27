import Phaser from 'phaser';

const SPEED = 260;
const JUMP_SPEED = 520;
const CONTROL_CODES = new Set([
  'KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'ArrowUp',
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

  create(): void {
    // Generated textures keep the foundation independent of external art.
    const graphics = this.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(0xffffff).fillRect(0, 0, 40, 56);
    graphics.generateTexture('character', 40, 56);
    graphics.clear().fillStyle(0x40545f).fillRect(0, 0, 1280, 80);
    graphics.generateTexture('floor', 1280, 80);
    graphics.destroy();

    const floor = this.physics.add.staticImage(640, 680, 'floor');
    this.add.rectangle(640, 643, 1280, 6, 0x81949a);
    this.physics.world.setBounds(0, 0, 1280, 720);

    this.characters = [
      this.physics.add.image(380, 600, 'character').setTint(0xf0bf75),
      this.physics.add.image(520, 600, 'character').setTint(0x83d4da),
    ];
    this.characters.forEach((character, index) => {
      character.setCollideWorldBounds(true);
      this.physics.add.collider(character, floor);
      this.labels.push(this.add.text(character.x, character.y, index === 0 ? 'A' : 'B', {
        fontFamily: 'monospace', fontSize: '22px', color: '#10232c',
      }).setOrigin(0.5));
    });
    this.add.text(40, 34, 'FOUNDATION / 01', {
      fontFamily: 'monospace', fontSize: '16px', color: '#9aafb9',
    });
    this.status = this.add.text(40, 72, '', { fontSize: '24px', color: '#ead19b' });
    this.add.text(40, 115, 'Move, jump, and switch between your two teammates.', {
      fontSize: '18px', color: '#9aafb9',
    });
    this.indicator = this.add.text(0, 0, '▼ ACTIVE', {
      fontFamily: 'monospace', fontSize: '16px', color: '#ffffff',
    }).setOrigin(0.5, 1);

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
    active.setVelocityX((Number(right) - Number(left)) * SPEED);
    const body = active.body as Phaser.Physics.Arcade.Body;
    if (this.jumpQueued && body.blocked.down) active.setVelocityY(-JUMP_SPEED);
    this.jumpQueued = false;
    this.characters.forEach((character, index) => {
      this.labels[index].setPosition(character.x, character.y);
    });
    this.indicator.setPosition(active.x, active.y - 40);
  }
}
