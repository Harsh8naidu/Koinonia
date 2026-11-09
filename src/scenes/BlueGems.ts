import Phaser from 'phaser';

// Frames 0031–0060 are copies of 0030 and would hold the last pose.
const frames = Array.from({ length: 30 }, (_, index) => {
  const number = String(index + 1).padStart(4, '0');
  return { key: `blue-gem-${number}`, file: `/assets/art/Collectibles/blue_gem/${number}.png` };
});

export function preloadBlueGems(scene: Phaser.Scene): void {
  for (const frame of frames) scene.load.image(frame.key, frame.file);
}

export class BlueGems {
  private readonly gems = new Map<string, Phaser.GameObjects.Sprite>();

  constructor(private readonly scene: Phaser.Scene) {
    if (!scene.anims.exists('blue-gem-spin')) {
      scene.anims.create({
        key: 'blue-gem-spin',
        frames: frames.map(({ key }) => ({ key })),
        frameRate: 6,
        repeat: -1,
      });
    }
  }

  place(column: number, row: number, x: number, y: number, depth: number): void {
    const sprite = this.scene.add.sprite(x, y, frames[0].key)
      .setOrigin(0.5, 0.85)
      .setScale(0.6)
      .setDepth(depth)
      .play('blue-gem-spin');

    this.gems.set(`${column},${row}`, sprite);
  }

  collect(column: number, row: number, duration: number): void {
    const key = `${column},${row}`;
    const sprite = this.gems.get(key);
    if (!sprite) return;

    this.gems.delete(key);
    this.scene.tweens.add({
      targets: sprite,
      alpha: 0,
      duration,
      ease: 'Linear',
      onComplete: () => sprite.destroy(),
    });
  }
}
