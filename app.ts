const PixelPusher = require('node-pixel-pusher');
import DeviceRenderer from './utils/device-renderer.js';
import { Device } from 'node-pixel-pusher/dist/types';
import express, { Request, Response } from 'express';
import { isGif } from './utils/helpers.js';

const service = new PixelPusher.Service();
const deviceRenderers: DeviceRenderer[] = [];
const app = express();
app.use(express.json());

// Helper to handle errors consistently
function handleError(error: unknown, res: Response) {
  console.error('Display error:', error);
  if (error instanceof Error) {
    res.status(500).send(`Failed to display: ${error.message}`);
  } else {
    res.status(500).send('Failed to display media');
  }
}

// Helper to validate device index
function validateDeviceIndex(deviceIndex: number | undefined): void {
  if (deviceIndex !== undefined && (deviceIndex < 0 || deviceIndex >= deviceRenderers.length)) {
    throw new Error('Invalid device index');
  }
}

// Get connected devices
app.get('/connectedDevices', (req: Request, res: Response) => {
  try {
    const devices = deviceRenderers.map((deviceRenderer, index) => ({
      macAddress: deviceRenderer.device.deviceData.macAddress,
      ipAddress: deviceRenderer.device.deviceData.ipAddress,
      ledCols: deviceRenderer.device.deviceData.pixelsPerStrip,
      ledRows: deviceRenderer.device.deviceData.stripsPerPkt,
      deviceIndex: index,
    }));
    res.status(200).json(devices);
  } catch (error) {
    handleError(error, res);
  }
});

// Display media (images or GIFs)
app.post('/displayImage', async (req: Request, res: Response) => {
  const { url, deviceIndex } = req.body;

  try {
    if (!url) {
      throw new Error('URL is required');
    }

    validateDeviceIndex(deviceIndex);
    const isGifImage = await isGif(url);
    const renderMethod = isGifImage ? 'renderGif' : 'renderImage';

    if (deviceIndex !== undefined) {
      await deviceRenderers[deviceIndex][renderMethod](url);
      res.status(200).send(`Media displayed successfully on device ${deviceIndex}`);
    } else {
      await Promise.all(deviceRenderers.map((deviceRenderer) => deviceRenderer[renderMethod](url)));
      res.status(200).send('Media displayed successfully on all devices');
    }
  } catch (error) {
    handleError(error, res);
  }
});

// Display text
app.post('/displayText', async (req: Request, res: Response) => {
  const { text, deviceIndex, textAlignment, textColor } = req.body;

  try {
    if (!text) {
      throw new Error('Text is required');
    }

    validateDeviceIndex(deviceIndex);

    if (deviceIndex !== undefined) {
      await deviceRenderers[deviceIndex].renderText(text, { textAlignment, textColor });
      res.status(200).send(`Text displayed successfully on device ${deviceIndex}`);
    } else {
      await Promise.all(
        deviceRenderers.map((deviceRenderer) =>
          deviceRenderer.renderText(text, { textAlignment, textColor })
        )
      );
      res.status(200).send('Text displayed successfully on all devices');
    }
  } catch (error) {
    handleError(error, res);
  }
});

// Display clock
app.post('/displayClock', async (req: Request, res: Response) => {
  const { deviceIndex, textColor, showAMPM, showSeconds } = req.body;

  try {
    validateDeviceIndex(deviceIndex);

    if (deviceIndex !== undefined) {
      await deviceRenderers[deviceIndex].renderClock({ textColor, showAMPM, showSeconds });
      res.status(200).send(`Clock displayed successfully on device ${deviceIndex}`);
    } else {
      await Promise.all(
        deviceRenderers.map((deviceRenderer) =>
          deviceRenderer.renderClock({ textColor, showAMPM, showSeconds })
        )
      );
      res.status(200).send('Clock displayed successfully on all devices');
    }
  } catch (error) {
    handleError(error, res);
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});

service.on('discover', (device: Device) => {
  const deviceRenderer = new DeviceRenderer(device, 30);
  deviceRenderers.push(deviceRenderer);
});
