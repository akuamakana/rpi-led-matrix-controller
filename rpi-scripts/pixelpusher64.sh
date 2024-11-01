sudo /home/dietpi/rpi-matrix-pixelpusher/pixel-push \
  --led-show-refresh \
  --led-rows=64 \
  --led-cols=64 \
  --led-parallel=1 \
  --led-chain=1 \
  --led-gpio-mapping=adafruit-hat-pwm \
  --led-brightness=25 \
  -i wlan0 \
  -u 65507