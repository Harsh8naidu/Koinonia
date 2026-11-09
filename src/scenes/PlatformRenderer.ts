import Phaser from 'phaser';

export type Cell = {
  height: number; // Height of gameplay blocks
  walkable: boolean; // Used for both taller surfaces as well as obstacles
}

const tileScale = 0.5;
export const blockPixelHeight = 93 * tileScale;
export const tileWidth = 160 * tileScale;
export const tileHeight = 92 * tileScale;

export function preloadPlatformTextures(scene: Phaser.Scene): void {
  scene.load.image('platform-tile', '/assets/art/platform/isometric_0014.png');
  scene.load.image('rock-grass-tile', '/assets/art/platform/isometric_0058.png');
  scene.load.image('rock-tile', '/assets/art/platform/isometric_005.PNG');
}

export function drawPlatformTile(
  scene: Phaser.Scene,
  cell: Cell,
  centre: { x: number; y: number },
  tileDepth: number,
  canReach: () => boolean,
): Phaser.GameObjects.Image {
  const topY = centre.y - tileHeight / 2;
  const baseY = topY + cell.height * blockPixelHeight;
  const groundDepth = tileDepth - 10000;

  const drawBlock = (level: number, depth: number) =>
    scene.add.image(centre.x, baseY - level * blockPixelHeight, textureForLevel(level, cell.height))
      .setDisplayOrigin(94, 3)
      .setScale(tileScale)
      .setDepth(depth);

  for (let level = 0; level < cell.height; level++) {
    const depth = level === 0 ? groundDepth : tileDepth - (cell.height - level);
    drawBlock(level, depth);
  }

  const top = drawBlock(cell.height, cell.height === 0 ? groundDepth : tileDepth);
  if (!cell.walkable) top.setTint(0xcc6666);

  const diamond = new Phaser.Geom.Polygon([94, 3, 174, 49, 94, 95, 14, 49]);
  top.setInteractive(diamond, Phaser.Geom.Polygon.Contains);

  top.on('pointerover', () => {
    top.setTint(canReach() ? 0x88ff88 : 0xff6666);
  });

  top.on('pointerout', () => {
    if (cell.walkable) top.clearTint();
    else top.setTint(0xcc6666);
  });

  return top;
}

function textureForLevel(level: number, stackHeight: number): string {

  if (level === 0) {
    return 'platform-tile';
  }

  return hasTileAbove(level, stackHeight)
    ? 'rock-tile'
    : 'rock-grass-tile';
}

function hasTileAbove(level: number, stackHeight: number): boolean {
  return level < stackHeight;
}
