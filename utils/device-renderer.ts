import { createCanvas, loadImage, Canvas, CanvasRenderingContext2D } from 'canvas';
import { Device } from 'node-pixel-pusher/dist/types';

class DeviceRenderer {
  device: Device;
  width: number;
  height: number;
  canvas: Canvas;
  canvasContext: CanvasRenderingContext2D;
  maxFPS: number;

  constructor(device: Device, maxFPS: number = 15) {
    this.device = device;
    this.width = device.deviceData.pixelsPerStrip;
    this.height = device.deviceData.numberStrips;
    this.canvas = createCanvas(this.width, this.height);
    this.canvasContext = this.canvas.getContext('2d');
    this.maxFPS = maxFPS;
  }

  async renderImage(imageUrl: string) {
    const image = await loadImage(imageUrl);

    // Calculate aspect-ratio-preserved dimensions
    const aspectRatio = image.width / image.height;
    const targetHeight = this.height;
    const targetWidth = Math.round(targetHeight * aspectRatio);

    // Center the image if it doesn’t fully cover the canvas width
    const xOffset = (this.width - targetWidth) / 2;

    // Draw the image with scaled dimensions
    this.canvasContext.drawImage(image, xOffset, 0, targetWidth, targetHeight);

    this.renderToDevice();
  }

  renderToDevice(xPos: number = 0, yPos: number = 0) {
    this.device.startRendering(() => {
      const ImageData = this.canvasContext.getImageData(xPos, yPos, this.width, this.height);
      this.device.setRGBABuffer(ImageData.data);
    }, this.maxFPS);
  }
}

export default DeviceRenderer;
