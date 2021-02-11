'use strict';
const { ffmpeg } = require('eloquent-ffmpeg');
const { loadImage, createCanvas } = require('canvas');
const { SingleBar } = require('cli-progress');
const { relative } = require('path');

const FPS = 30;
const FRAMES = FPS * 30;

async function* animate() {
  // Example animation adapted from Mozilla Developer Network
  // https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Basic_animations

  const [ sun, moon, earth ] = await Promise.all([
    loadImage(__dirname + '/assets/sun.png'),
    loadImage(__dirname + '/assets/moon.png'),
    loadImage(__dirname + '/assets/earth.png'),
  ]);

  const canvas = createCanvas(300, 300);
  const ctx = canvas.getContext('2d');

  for (let frame = 0; frame < FRAMES; frame++) {
    const seconds = frame / FPS;
    const ms = seconds * 1000;

    ctx.globalCompositeOperation = 'destination-over';
    ctx.clearRect(0, 0, 300, 300);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.strokeStyle = 'rgba(0, 153, 255, 0.4)';
    ctx.save();
    ctx.translate(150, 150);

    // Earth
    ctx.rotate(2 * Math.PI / 60 * seconds + 2 * Math.PI / 60000 * ms);
    ctx.translate(105, 0);
    // Shadow
    ctx.fillRect(0, -12, 40, 24);
    ctx.drawImage(earth, -12, -12);

    ctx.save();

    ctx.rotate(2 * Math.PI / 6 * seconds + 2 * Math.PI / 6000 * ms);
    ctx.translate(0, 28.5);
    ctx.drawImage(moon, -3.5, -3.5);

    ctx.restore();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(150, 150, 105, 0, Math.PI * 2, false); // Earth orbit
    ctx.stroke();

    ctx.drawImage(sun, 0, 0, 300, 300);

    // get the image as buffer from the canvas
    yield canvas.toBuffer('image/png');
  }
}
exports.animate = animate;

async function render() {
  const outputPath = __dirname + '/2d_animation.mp4';

  const cmd = ffmpeg();

  cmd.input(animate())
    .args('-framerate', FPS.toString())
    .format('image2pipe');

  cmd.output(outputPath);

  const proc = await cmd.spawn();

  const duration = FRAMES / FPS;

  const bar = new SingleBar({
    format: `[{bar}] {percentage}% | ETA: {eta}s | {speed}x | {value}/{total}`,
  });
  bar.start(duration, 0, { speed: 0 });

  for await (const { speed, time } of proc.progress()) {
    bar.update(time / 1000, { speed });
  }

  await proc.complete();

  bar.update(duration, { speed: 0 });
  bar.stop();

  console.log(`Rendering completed! View the animation \`${relative('.', outputPath)}\``);
}

if (require.main === module)
  render();
