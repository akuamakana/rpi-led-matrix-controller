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

function validateDeviceMacAddress(macAddress: string): void {
  if (
    !deviceRenderers.some(
      (deviceRenderer) => deviceRenderer.device.deviceData.macAddress === macAddress
    )
  ) {
    throw new Error('Device not found');
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
  const { url, deviceMacAddresses, fillColor, playbackSpeed } = req.body;

  try {
    if (!url) {
      throw new Error('URL is required');
    }

    deviceMacAddresses.forEach(validateDeviceMacAddress);
    const isGifImage = await isGif(url);
    const renderMethod = isGifImage ? 'renderGif' : 'renderImage';

    await Promise.all(
      deviceRenderers
        .filter((deviceRenderer) =>
          deviceMacAddresses.includes(deviceRenderer.device.deviceData.macAddress)
        )
        .map((deviceRenderer) => deviceRenderer[renderMethod](url, { fillColor, playbackSpeed }))
    );
    res.status(200).send('Media displayed successfully');
  } catch (error) {
    handleError(error, res);
  }
});

// Display text
app.post('/displayText', async (req: Request, res: Response) => {
  const { text, deviceMacAddresses, textAlignment, textColor } = req.body;

  try {
    if (!text) {
      throw new Error('Text is required');
    }

    deviceMacAddresses.forEach(validateDeviceMacAddress);

    await Promise.all(
      deviceRenderers
        .filter((deviceRenderer) =>
          deviceMacAddresses.includes(deviceRenderer.device.deviceData.macAddress)
        )
        .map((deviceRenderer) => deviceRenderer.renderText(text, { textAlignment, textColor }))
    );
    res.status(200).send('Text displayed successfully');
  } catch (error) {
    handleError(error, res);
  }
});

// Display clock
app.post('/displayClock', async (req: Request, res: Response) => {
  const { deviceMacAddresses, textColor, showAMPM, showSeconds, showDate } = req.body;

  try {
    deviceMacAddresses.forEach(validateDeviceMacAddress);

    await Promise.all(
      deviceRenderers
        .filter((deviceRenderer) =>
          deviceMacAddresses.includes(deviceRenderer.device.deviceData.macAddress)
        )
        .map((deviceRenderer) =>
          deviceRenderer.renderClock({ textColor, showAMPM, showSeconds, showDate })
        )
    );
    res.status(200).send('Clock displayed successfully');
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
  deviceRenderer.renderText(device.deviceData.macAddress, { textColor: 'green' });
});
