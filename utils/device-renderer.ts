import { createCanvas, loadImage, Canvas, CanvasRenderingContext2D, registerFont } from 'canvas';
import { Device } from 'node-pixel-pusher/dist/types';

registerFont('./assets/fonts/Minecraftia.ttf', { family: 'Minecraftia' });

class DeviceRenderer {
  device: Device;
  width: number;
  height: number;
  canvas: Canvas;
  canvasContext: CanvasRenderingContext2D;
  maxFPS: number;
  scrollOffset: number;
  clockInterval: NodeJS.Timeout | null;
  textInterval: NodeJS.Timeout | null;

  constructor(device: Device, maxFPS: number = 15) {
    this.device = device;
    this.width = device.deviceData.pixelsPerStrip;
    this.height = device.deviceData.numberStrips;
    this.canvas = createCanvas(this.width, this.height);
    this.canvasContext = this.canvas.getContext('2d');
    this.maxFPS = maxFPS;
    this.scrollOffset = 0;
    this.clockInterval = null;
    this.textInterval = null;
  }

  clearIntervals() {
    if (this.textInterval) {
      clearInterval(this.textInterval);
      this.textInterval = null;
    }
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
      this.clockInterval = null;
    }
  }

  async renderImage(imageUrl: string) {
    this.clearIntervals();
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

  renderText(text: string, { textAlignment = 'center', textColor = 'white' } = {}) {
    this.clearIntervals();
    // Calculate total width of the text once, outside the interval
    const totalWidth = this.canvasContext.measureText(text).width;

    this.textInterval = setInterval(() => {
      let yCenter = 0;
      switch (textAlignment) {
        case 'top':
          yCenter = 18;
          break;
        case 'bottom':
          yCenter = this.height + 7;
          break;
        default:
          yCenter = (this.height + 25) / 2;
          break;
      }
      let x = 0;
      // Clear canvas for new frame
      this.canvasContext.clearRect(0, 0, this.width, this.height);

      // Set font and vertical centering
      this.canvasContext.font = '12px Minecraftia';
      const xPadding = 25;

      if (totalWidth > this.width) {
        // Update scrollOffset to move text left and reset when it goes completely off screen
        this.scrollOffset += 1;
        if (this.scrollOffset > totalWidth + this.width + xPadding) {
          this.scrollOffset = 0; // Reset to initial position on the right
        }
        // Calculate x position for scrolling text from right to left
        x = this.width - this.scrollOffset;
      }

      // Set color and render text
      this.canvasContext.fillStyle = textColor;
      this.canvasContext.fillText(text, x, yCenter);

      // Render to device
      this.renderToDevice();
    }, 75);
  }

  renderClock({ textColor = 'white', showSeconds = false, showAMPM = false } = {}) {
    this.clearIntervals();
    this.clockInterval = setInterval(() => {
      // Clear canvas for new frame
      this.canvasContext.clearRect(0, 0, this.width, this.height);

      // Get current time and format it
      const now = new Date();
      const clock = now
        .toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: 'numeric',
          second: showSeconds ? 'numeric' : undefined,
          hour12: true,
        })
        .replace(showAMPM ? '' : / AM| PM/, '');

      // Set font and measure text
      this.canvasContext.font = '12px Minecraftia';

      // Measure the total width of the entire clock text
      const totalWidth = this.canvasContext.measureText(clock).width;

      // Calculate starting x position to center text
      const x = (this.width - totalWidth) / 2;
      const yCenter = (this.height + 30) / 2; // Approximation for vertical centering

      // Set color and render the entire clock text centered
      this.canvasContext.fillStyle = textColor;
      this.canvasContext.fillText(clock, x, yCenter);

      // Render to device
      this.renderToDevice();
    }, 1000);
  }

  renderToDevice(xPos: number = 0, yPos: number = 0) {
    this.device.startRendering(() => {
      const ImageData = this.canvasContext.getImageData(xPos, yPos, this.width, this.height);
      this.device.setRGBABuffer(ImageData.data);
    }, this.maxFPS);
  }
}

export default DeviceRenderer;
