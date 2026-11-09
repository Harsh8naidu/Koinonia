import Phaser from 'phaser';

type SkyLayer = {
    image: Phaser.GameObjects.Image;
    movement: number;
};

export class BackgroundScene extends Phaser.Scene {
    private layers: SkyLayer[] = [];

    constructor() {
        super({ key: 'Background', active: true });
    }

    preload(): void {
        const files = [
            'night_skybox_1.png',
            'night_skybox_2.png',
            'stars_night_skybox_3.png',
            'moon_night_skybox_4.png',
            'clouds_top_night_skybox_5.png',
            'clouds_back_night_skybox_6.png',
            'clouds_front_night_skybox_7.png',
        ];

        for (const file of files) {
            this.load.image(
                `sky-${file}`,
                `/assets/art/background/night_skybox/${file}`
            );
        }
    }

    create(): void {
        // Draw this skybox scene behind the game
        this.scene.sendToBack();
        this.input.enabled = false;
        this.layers = [];

        // Listed from back to front
        const settings = [
            { file: 'night_skybox_1.png', movement: 0 },
            { file: 'night_skybox_2.png', movement: 0 },
            { file: 'stars_night_skybox_3.png', movement: 0.15 },
            { file: 'moon_night_skybox_4.png', movement: 0.25 },
            { file: 'clouds_back_night_skybox_6.png', movement: 0.45 },
            { file: 'clouds_top_night_skybox_5.png', movement: 0.65 },
            { file: 'clouds_front_night_skybox_7.png', movement: 1}
        ];

        for (const setting of settings) {
            this.layers.push({
                image: this.add.image(0, 0, `sky-${setting.file}`),
                movement: setting.movement
            })
        }
    }

    update(time: number): void {
        const width = this.scale.width;
        const height = this.scale.height;

        // Fill the screen without stretching the artwork
        // The extra 15% leaves room for the layers to move
        const scale = Math.max(width / 1920, height / 1080) * 1.15;

        const game = this.scene.get('Game');
        const camera = game.cameras.main;

        if (!camera) return;

        const cameraX = camera.scrollX + camera.width / 2;
        const cameraY = camera.scrollY + camera.height / 2;

        // Limit background movement even if the player pans for away
        const panX = Math.tanh((cameraX - 640) / 500) * 40;
        const panY = Math.tanh((cameraY - 360) / 500) * 25;

        for (const layer of this.layers) {
            const movement = layer.movement;

            const driftX = Math.sin(time / 12000 * movement) * 20 * movement;

            const driftY = Math.sin(time / 18000 * movement) * 6 * movement;

            layer.image.setScale(scale);

            layer.image.setPosition(
                width / 2 + (driftX - panX * movement) * scale,
                height / 2 + (driftY - panY * movement) * scale
            );
        }
    }
}

