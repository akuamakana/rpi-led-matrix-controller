const PixelPusher = require('node-pixel-pusher');
import DeviceRenderer from './utils/device-renderer.js';
import { Device } from 'node-pixel-pusher/dist/types';
import express, { Request, Response } from 'express';

const service = new PixelPusher.Service();
const deviceRenderers: DeviceRenderer[] = [];
const app = express();
app.use(express.json());

app.get('/connectedDevices', (req, res) => {
  res.status(200).send(
    deviceRenderers.map((deviceRenderer, index) => ({
      macAddress: deviceRenderer.device.deviceData.macAddress,
      ipAddress: deviceRenderer.device.deviceData.ipAddress,
      ledCols: deviceRenderer.device.deviceData.pixelsPerStrip,
      ledRows: deviceRenderer.device.deviceData.stripsPerPkt,
      deviceIndex: index,
    }))
  );
});

app.post('/displayImage', async (req: Request, res: Response) => {
  const { url, deviceIndex } = req.body;
  try {
    if (!url) {
      throw new Error('URL is required');
    }
    if (deviceIndex !== undefined) {
      await deviceRenderers[deviceIndex].renderImage(url);
    } else {
      await Promise.all(deviceRenderers.map((deviceRenderer) => deviceRenderer.renderImage(url)));
    }
    res.status(200).send('Image displayed successfully');
  } catch (error) {
    res.status(500).send('Failed to display image');
  }
});

app.post('/displayText', (req: Request, res: Response) => {
  const { text, deviceIndex, textAlignment, textColor } = req.body;
  try {
    if (deviceIndex !== undefined) {
      deviceRenderers[deviceIndex].renderText(text, { textAlignment, textColor });
    } else {
      deviceRenderers.map((deviceRenderer) =>
        deviceRenderer.renderText(text, { textAlignment, textColor })
      );
    }
    res.status(200).send('Text displayed successfully');
  } catch (error) {
    res.status(500).send('Failed to display text');
  }
});

app.post('/displayClock', (req: Request, res: Response) => {
  const { deviceIndex, textColor, showAMPM, showSeconds } = req.body;
  try {
    if (deviceIndex !== undefined) {
      deviceRenderers[deviceIndex].renderClock({ textColor, showAMPM, showSeconds });
    } else {
      deviceRenderers.map((deviceRenderer) =>
        deviceRenderer.renderClock({ textColor, showAMPM, showSeconds })
      );
    }
    res.status(200).send('Clock displayed successfully');
  } catch (error) {
    res.status(500).send('Failed to display clock');
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});

service.on('discover', (device: Device) => {
  const deviceRenderer = new DeviceRenderer(device, 15);
  deviceRenderers.push(deviceRenderer);
});
