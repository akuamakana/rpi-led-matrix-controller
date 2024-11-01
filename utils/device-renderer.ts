import { createCanvas, loadImage, Canvas, CanvasRenderingContext2D, ImageData } from 'canvas';
import { Device } from 'node-pixel-pusher/dist/types';
import { parseGIF, decompressFrames, ParsedFrame } from 'gifuct-js';
import { BDFFont, DrawOptions } from './bdf-font';
import { WeatherOpenMateo } from './weather';

type Dims = {
  left: number;
  top: number;
  width: number;
  height: number;
};

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
  gifInterval: NodeJS.Timeout | null;
  font: BDFFont;

  constructor(device: Device, font: BDFFont, maxFPS: number = 30) {
    this.device = device;
    this.width = device.deviceData.pixelsPerStrip;
    this.height = device.deviceData.numberStrips;
    this.canvas = createCanvas(this.width, this.height);
    this.canvasContext = this.canvas.getContext('2d');
    this.maxFPS = maxFPS;
    this.scrollOffset = 0;
    this.clockInterval = null;
    this.textInterval = null;
    this.gifInterval = null;
    this.font = font;
    this.weather = new WeatherOpenMateo();
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
    if (this.gifInterval) {
      clearInterval(this.gifInterval);
      this.gifInterval = null;
    }
  }

  resetDisplay() {
    this.clearIntervals();
    this.canvasContext.clearRect(0, 0, this.width, this.height);
    this.renderToDevice();
  }

  async renderImage(imageUrl: string, { fillColor = '#000000' } = {}) {
    this.resetDisplay();
    this.canvasContext.fillStyle = fillColor;
    this.canvasContext.fillRect(0, 0, this.width, this.height);
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

  async renderGif(
    imageUrl: string,
    {
      fillColor = '#000000',
      scaleMode = 'fit', // 'fit' or 'zoom'
    } = {}
  ) {
    this.resetDisplay();
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const gif = parseGIF(arrayBuffer);
    const frames = decompressFrames(gif, true);

    let frameIndex = 0;
    const totalFrames = frames.length;

    // Create an off-screen canvas for the current frame
    const frameCanvas = createCanvas(frames[0].dims.width, frames[0].dims.height);
    const frameContext = frameCanvas.getContext('2d');

    // Create an off-screen canvas for the composited result
    const compositedCanvas = createCanvas(frames[0].dims.width, frames[0].dims.height);
    const compositedContext = compositedCanvas.getContext('2d');

    // Create a backup canvas for disposal method 3
    const backupCanvas = createCanvas(frames[0].dims.width, frames[0].dims.height);
    const backupContext = backupCanvas.getContext('2d');

    // Track the previous frame's dimensions and disposal type for proper clearing
    let prevFrameDims: Dims | null = null;
    let prevDisposalType = null;

    // Initialize background
    compositedContext.fillStyle = fillColor;
    compositedContext.fillRect(0, 0, compositedCanvas.width, compositedCanvas.height);

    // Calculate scaling dimensions based on mode
    const calculateScalingDimensions = (
      sourceWidth: number,
      sourceHeight: number,
      targetWidth: number,
      targetHeight: number
    ) => {
      const sourceRatio = sourceWidth / sourceHeight;
      const targetRatio = targetWidth / targetHeight;

      if (scaleMode === 'zoom' || this.width === this.height) {
        // Scale to fill, maintain aspect ratio
        if (sourceRatio > targetRatio) {
          const scale = targetHeight / sourceHeight;
          const scaledWidth = sourceWidth * scale;
          const xOffset = (targetWidth - scaledWidth) / 2;
          return {
            width: scaledWidth,
            height: targetHeight,
            x: xOffset,
            y: 0,
          };
        } else {
          const scale = targetWidth / sourceWidth;
          const scaledHeight = sourceHeight * scale;
          const yOffset = (targetHeight - scaledHeight) / 2;
          return {
            width: targetWidth,
            height: scaledHeight,
            x: 0,
            y: yOffset,
          };
        }
      } else {
        // Fit mode - current behavior
        return {
          width: targetWidth,
          height: targetHeight,
          x: 0,
          y: 0,
        };
      }
    };

    const clearPreviousFrame = (prevFrame: ParsedFrame, dims: Dims | null) => {
      if (!dims) return;

      switch (prevFrame.disposalType) {
        case 2: // Restore to background
          compositedContext.clearRect(dims.left, dims.top, dims.width, dims.height);
          compositedContext.fillStyle = fillColor;
          compositedContext.fillRect(dims.left, dims.top, dims.width, dims.height);
          break;

        case 3: // Restore to previous
          compositedContext.drawImage(backupCanvas, 0, 0);
          break;

        case 0: // No disposal specified
        case 1: // Do not dispose
          // Leave the previous frame as is
          break;
      }
    };

    const renderNextFrame = () => {
      const frame = frames[frameIndex];

      // Handle previous frame cleanup
      if (frameIndex > 0) {
        clearPreviousFrame(frames[frameIndex - 1], prevFrameDims);
      } else if (frameIndex === 0 && prevFrameDims) {
        // We're back at the start - clean up the last frame
        clearPreviousFrame(frames[totalFrames - 1], prevFrameDims);
      }

      // Before drawing a new frame with disposal type 3,
      // backup the current state
      if (frame.disposalType === 3) {
        backupContext.clearRect(0, 0, backupCanvas.width, backupCanvas.height);
        backupContext.drawImage(compositedCanvas, 0, 0);
      }

      // Create ImageData for the current frame
      const patchData = new Uint8ClampedArray(frame.patch);

      // Handle transparency
      if (frame.transparentIndex !== null) {
        for (let i = 0; i < frame.pixels.length; i++) {
          const pixelIndex = i * 4 + 3; // Alpha channel index
          if (frame.pixels[i] === frame.transparentIndex) {
            patchData[pixelIndex] = 0; // Set transparent
          }
        }
      }

      const imageData = new ImageData(patchData, frame.dims.width, frame.dims.height);

      // Clear and draw the current frame to the frame canvas
      frameContext.clearRect(0, 0, frameCanvas.width, frameCanvas.height);
      frameContext.putImageData(imageData, 0, 0);

      // Set appropriate compositing mode based on transparency
      compositedContext.globalCompositeOperation =
        frame.transparentIndex !== null ? 'source-over' : 'copy';

      // Composite the frame onto the result
      compositedContext.drawImage(
        frameCanvas,
        0,
        0,
        frame.dims.width,
        frame.dims.height,
        frame.dims.left,
        frame.dims.top,
        frame.dims.width,
        frame.dims.height
      );

      // Reset composite operation
      compositedContext.globalCompositeOperation = 'source-over';

      // Calculate scaling dimensions
      const scaleDims = calculateScalingDimensions(
        compositedCanvas.width,
        compositedCanvas.height,
        this.width,
        this.height
      );

      // Draw the final composited result to the main canvas
      this.canvasContext.clearRect(0, 0, this.width, this.height);
      this.canvasContext.fillStyle = fillColor;
      this.canvasContext.fillRect(0, 0, this.width, this.height);
      this.canvasContext.drawImage(
        compositedCanvas,
        0,
        0,
        compositedCanvas.width,
        compositedCanvas.height,
        scaleDims.x,
        scaleDims.y,
        scaleDims.width,
        scaleDims.height
      );

      // Render to device
      this.renderToDevice();

      // Store current frame information for next iteration
      prevFrameDims = { ...frame.dims };
      prevDisposalType = frame.disposalType;

      // Calculate next frame's delay
      const nextFrameIndex = (frameIndex + 1) % totalFrames;
      const nextFrame = frames[nextFrameIndex];
      const delay = Math.max(nextFrame.delay || 100, 20); // Ensure minimum delay of 20ms

      // Update frame index
      frameIndex = nextFrameIndex;

      // Schedule next frame
      this.gifInterval = setTimeout(renderNextFrame, delay);
    };

    // Start the animation
    renderNextFrame();
  }

  async renderText(text: string, { textAlignment = 'center', textColor = 'white' } = {}) {
    this.resetDisplay();
    // Calculate total width of the text once, outside the interval
    const totalWidth = await this.font.measureText(text);

    this.textInterval = setInterval(() => {
      let y = 0;
      switch (textAlignment) {
        case 'top':
          y = 0 - 2;
          break;
        case 'bottom':
          y = this.height - 12;
          break;
        default:
          y = Math.floor((this.height - 12) / 2);
          break;
      }
      let x = 0;
      // Clear canvas for new frame
      this.canvasContext.clearRect(0, 0, this.width, this.height);

      if (totalWidth > this.width) {
        // Update scrollOffset to move text left and reset when it goes completely off screen
        this.scrollOffset += 1;
        if (this.scrollOffset > totalWidth + this.width) {
          this.scrollOffset = 0; // Reset to initial position on the right
        }
        // Calculate x position for scrolling text from right to left
        x = this.width - this.scrollOffset;
      }

      // Drawing options
      const options: DrawOptions = {
        color: textColor,
      };

      // Draw text
      this.font.drawText(this.canvasContext, text, x, y, options);

      // Render to device
      this.renderToDevice();
    }, 75);
  }

  renderClock({
    textColor = 'white',
    showSeconds = false,
    showAMPM = false,
    showDate = false,
    showWeather = false,
  } = {}) {
    this.resetDisplay();
    const renderClock = async () => {
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

      // Calculate starting x position to center text
      const x = 0;
      const y = this.height - 12; // Approximation for vertical centering

      // Set color and render the entire clock text centered
      const options: DrawOptions = {
        color: textColor,
      };
      if (showWeather) {
        const currentTemperature = await this.weather.getTemperatureAtHour(now);
        if (currentTemperature) {
          const temperatureText = `${currentTemperature.temperature}°F`;
          this.font.drawText(this.canvasContext, temperatureText, x, y - 24, options);
        }
      }
      if (showDate) {
        const date = now.toLocaleDateString('en-US', {
          weekday: 'long',
        });
        this.font.drawText(this.canvasContext, date, x, y - 12, options);
      }
      this.font.drawText(this.canvasContext, clock, x, y, options);

      // Render to device
      this.renderToDevice();
    };

    renderClock();

    this.clockInterval = setInterval(renderClock, 1000);
  }

  renderToDevice(xPos: number = 0, yPos: number = 0) {
    this.device.startRendering(() => {
      const ImageData = this.canvasContext.getImageData(xPos, yPos, this.width, this.height);
      this.device.setRGBABuffer(ImageData.data);
    }, this.maxFPS);
  }
}

export default DeviceRenderer;
