import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import './style.css';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#1c2a33',
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 1100 }, debug: false },
  },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [GameScene],
});
