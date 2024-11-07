let devices = [];
let selectedDevice = '';
let deviceMacAddresses = [];

const setDeviceMacAddresses = () => {
  selectedDevice = document.querySelector('#device-select').value;
  if (selectedDevice === 'all') {
    deviceMacAddresses = devices.map((device) => device.macAddress);
  } else {
    deviceMacAddresses = [selectedDevice];
  }
};

const displayText = async () => {
  setDeviceMacAddresses();
  const text = document.querySelector('#input-text').value;

  await fetch('http://localhost:3000/displayText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, deviceMacAddresses }),
  });
};

const displayImage = async () => {
  setDeviceMacAddresses();
  const url = document.querySelector('#input-image').value;

  await fetch('http://localhost:3000/displayImage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url, deviceMacAddresses }),
  });
};

const displayClock = async () => {
  setDeviceMacAddresses();
  const showAMPM = document.querySelector('#show-ampm').checked;
  const showDate = document.querySelector('#show-date').checked;
  const showWeather = document.querySelector('#show-weather').checked;
  const showSeconds = document.querySelector('#show-seconds').checked;
  const textColor = document.querySelector('#text-color').value;

  await fetch('http://localhost:3000/displayClock', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      deviceMacAddresses,
      showAMPM,
      showDate,
      showWeather,
      showSeconds,
      textColor,
    }),
  });
};

document.addEventListener('DOMContentLoaded', async () => {
  const element = document.querySelector('#device-select');
  const response = await fetch('http://localhost:3000/connectedDevices');
  devices = await response.json();
  devices.forEach((device) => {
    const option = document.createElement('option');
    option.text = `${device.ledRows}x${device.ledCols} (${device.macAddress})`;
    option.value = device.macAddress;
    element.appendChild(option);
  });
});

document.querySelector('#btn-display-text').addEventListener('click', displayText);
document.querySelector('#btn-display-image').addEventListener('click', displayImage);
document.querySelector('#btn-display-clock').addEventListener('click', displayClock);
