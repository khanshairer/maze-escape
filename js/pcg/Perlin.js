export class Perlin {
  
  constructor(size) {
    this.size = size;
    this.gradients = [];
    this.createGrid();
  }


  createGrid() {
    for (let i = 0; i < this.size; i++) {
      let row = [];
      for (let j = 0; j < this.size; j++) {
        const angle = Math.random() * Math.PI * 2;
        row.push({ x: Math.cos(angle), y: Math.sin(angle) });
      }
      this.gradients.push(row);
    }
  }

  noise(x, y, frequency) {
    x = (x * frequency) % this.size;
    y = (y * frequency) % this.size;

    let x0 = Math.floor(x);
    let y0 = Math.floor(y);
    let x1 = (x0 + 1) % this.size;
    let y1 = (y0 + 1) % this.size;

    let dx = x - x0;
    let dy = y - y0;


    // cache gradients
    let g00 = this.gradients[x0][y0];
    let g10 = this.gradients[x1][y0];
    let g01 = this.gradients[x0][y1];
    let g11 = this.gradients[x1][y1];

    let dot1 = g00.x * dx + g00.y * dy;
    let dot2 = g10.x * (dx - 1) + g10.y * dy;
    let dot3 = g01.x * (dx) + g01.y * (dy - 1);
    let dot4 = g11.x * (dx - 1) + g11.y * (dy - 1);


    let fadedDx = this.fade(dx);
    let fadedDy = this.fade(dy);

    let lerp1 = this.lerp(dot1, dot2, fadedDx);
    let lerp2 = this.lerp(dot3, dot4, fadedDx);

    let value = this.lerp(lerp1, lerp2, fadedDy);

    return (value + 1)/2;
  }


  octaveNoise(x, y, baseFrequency, numOctaves, persistence, lacunarity) {
    let totalNoise = 0;
    let frequency = baseFrequency;
    let amplitude = 1;
    let maxAmplitude = 0;

    for (let i = 0; i < numOctaves; i++) {
      totalNoise += this.noise(x, y, frequency) * amplitude;
      maxAmplitude += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return totalNoise / maxAmplitude;
  }


  fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  lerp(a, b, t) {
    return a + t * (b - a);
  }

}