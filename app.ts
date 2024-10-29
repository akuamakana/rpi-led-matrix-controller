const PixelPusher = require('node-pixel-pusher');
import DeviceRenderer from './utils/device-renderer.js';
import { Device } from 'node-pixel-pusher/dist/types';

const service = new PixelPusher.Service();

service.on('discover', async (device: Device) => {
  const deviceRenderer = new DeviceRenderer(device, 0);
  await deviceRenderer.renderImage('./assets/images/venom.jpg');
});
