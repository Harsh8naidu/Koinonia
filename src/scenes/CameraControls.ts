import Phaser from 'phaser';

export class CameraControls {
  private baseCameraZoom = 1;
  private zoomMultiplier = 1;
  private cameraFocus = {x: 640, y: 360};

  private pinching = false;

  get isPinching(): boolean {
    return this.pinching;
  }

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly clearPendingTap: () => void,
  ) {
    const resizeCamera = () => {
      const widthRatio = this.scene.scale.width / 1280;
      const heightRatio = this.scene.scale.height / 720;
      const screenScale = Math.min(widthRatio, heightRatio, 1);

      const usesTouch = window.matchMedia('(pointer: coarse)').matches;

      // Adjust this number to change the mobile zoom
      const mobileZoomMultiplier = 1.3;

      const zoom = usesTouch
        ? 1.3 * screenScale * mobileZoomMultiplier
        : 1.3 * screenScale;

      this.baseCameraZoom = zoom;
      this.applyCameraZoom();

      this.scene.cameras.main.centerOn(640, 360);
    }

    resizeCamera();

    this.scene.scale.on(Phaser.Scale.Events.RESIZE, resizeCamera);

    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scene.scale.off(Phaser.Scale.Events.RESIZE, resizeCamera);
    })

    this.setupZoomControls();
  }

  private setupZoomControls(): void {
    const first = this.scene.input.pointer1;
    const second = this.scene.input.pointer2;

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
      _pointer: Phaser.Input.Pointer,
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
      this.clearPendingTap();

      previousDistance = fingerDistance();
      previousMiddle = fingerMiddle();
    };

    const onPointerMove = (pointer: Phaser.Input.Pointer) => {
      if (!pointer.wasTouch && pointer.middleButtonDown()) {
        const camera = this.scene.cameras.main;

        this.cameraFocus.x -= (pointer.x - pointer.prevPosition.x) / camera.zoom;

        this.cameraFocus.y -= (pointer.y - pointer.prevPosition.y) / camera.zoom;

        camera.centerOn(this.cameraFocus.x, this.cameraFocus.y);
        return;
      }

      if (!this.pinching || !first.isDown || !second.isDown) return;

      const camera = this.scene.cameras.main;
      const middle = fingerMiddle();
      const distance = fingerDistance();

      // Remember the world position underneath the previous finger midpoint
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
      this.clearPendingTap();
      previousDistance = 0;

      // A pinch ends only after both fingers have lifted
      if (!first.isDown && !second.isDown) {
        this.pinching = false;
      }
    };

    const resetGesture = () => {
      this.clearPendingTap();
      this.pinching = false;
      previousDistance = 0;
    };

    resetGesture();

    this.scene.input.on('wheel', onWheel);
    this.scene.input.on('pointerdown', onPointerDown);
    this.scene.input.on('pointermove', onPointerMove);
    this.scene.input.on('pointerup', onPointerUp);
    this.scene.input.on('pointerupoutside', onPointerUp);
    this.scene.scale.on(Phaser.Scale.Events.RESIZE, resetGesture);

    this.scene.game.events.on(Phaser.Core.Events.BLUR, resetGesture);

    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scene.input.off('wheel', onWheel);
      this.scene.input.off('pointerdown', onPointerDown);
      this.scene.input.off('pointermove', onPointerMove);
      this.scene.input.off('pointerup', onPointerUp);
      this.scene.input.off('pointerupoutside', onPointerUp);
      this.scene.scale.off(Phaser.Scale.Events.RESIZE, resetGesture);

      this.scene.game.events.off(Phaser.Core.Events.BLUR, resetGesture);
      resetGesture();
    });
  }

  private applyCameraZoom(): void {
    this.zoomMultiplier = Phaser.Math.Clamp(
      this.zoomMultiplier,
      0.6,
      2.5,
    );

    this.scene.cameras.main.setZoom(
      this.baseCameraZoom * this.zoomMultiplier
    );

    this.scene.cameras.main.centerOn(this.cameraFocus.x, this.cameraFocus.y);
  }

}
