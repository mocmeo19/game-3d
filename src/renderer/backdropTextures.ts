import * as THREE from 'three';

/** Extend the cylindrical painting to a complete spherical background, including both poles. */
export function panoramaTexture(image: HTMLImageElement | null, horizon: number, sky: number, earth: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, new THREE.Color(sky).getStyle());
  gradient.addColorStop(0.5, new THREE.Color(sky).getStyle());
  gradient.addColorStop(1, earth);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (image) {
    const ratio = Math.PI * image.height / image.width;
    for (let y = 0; y < canvas.height; y++) {
      const elevation = Math.PI * (0.5 - (y + 0.5) / canvas.height);
      const v = horizon + Math.tan(elevation) / ratio;
      const sourceY = Math.max(0, Math.min(image.height - 1, (1 - v) * image.height));
      ctx.drawImage(image, 0, sourceY, image.width, 1, 0, y, canvas.width / 2, 1);
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(image, 0, sourceY, image.width, 1, 0, y, canvas.width / 2, 1);
      ctx.restore();
    }
    // Converge to the average edge colour at the poles, avoiding a pinched seam.
    const sample = document.createElement('canvas');
    sample.width = sample.height = 1;
    const sampler = sample.getContext('2d')!;
    for (const top of [true, false]) {
      sampler.clearRect(0, 0, 1, 1);
      sampler.drawImage(image, 0, top ? 0 : image.height - 1, image.width, 1, 0, 0, 1, 1);
      const [r, g, b] = sampler.getImageData(0, 0, 1, 1).data;
      const pole = top ? 0 : canvas.height;
      const fade = ctx.createLinearGradient(0, pole, 0, top ? 300 : canvas.height - 300);
      fade.addColorStop(0, `rgba(${r},${g},${b},1)`);
      fade.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = fade;
      ctx.fillRect(0, top ? 0 : canvas.height - 300, canvas.width, 300);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Seamless, restrained paving; world-space repetition keeps the floor detailed up close. */
export function groundTexture(base: string, edge: string, studio: boolean) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);
  let seed = 73;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 12000; i++) {
    ctx.fillStyle = `rgba(${random() > 0.5 ? '255,255,255' : '0,0,0'},${random() * 0.08})`;
    ctx.fillRect(random() * 512, random() * 512, 1 + random() * 3, 1 + random() * 3);
  }
  if (!studio) {
    ctx.strokeStyle = edge;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 2;
    for (let row = 0; row < 4; row++) {
      const y = row * 128;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
      for (let x = (row % 2) * 128; x <= 512; x += 256) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 128); ctx.stroke();
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(100, 100);
  texture.anisotropy = 8;
  return texture;
}
