export function multiply(a, b) {
  return Array.from({length: 3}, (_, i) => Array.from({length: 3}, (_, j) =>
    a[i].reduce((sum, value, k) => sum + value * b[k][j], 0)));
}

export function ellipsoid(size, stretch, yawDegrees, rollDegrees) {
  const yaw = yawDegrees * Math.PI / 180;
  const roll = rollDegrees * Math.PI / 180;
  const tilt = 25 * Math.PI / 180;
  const ry = [[Math.cos(yaw),0,Math.sin(yaw)],[0,1,0],[-Math.sin(yaw),0,Math.cos(yaw)]];
  const rx = [[1,0,0],[0,Math.cos(tilt),-Math.sin(tilt)],[0,Math.sin(tilt),Math.cos(tilt)]];
  const rz = [[Math.cos(roll),-Math.sin(roll),0],[Math.sin(roll),Math.cos(roll),0],[0,0,1]];
  const rotation = multiply(rz, multiply(rx, ry));
  const sigma = [size * stretch, size * .65, size * .55];
  // Orthographic projection P selects world x/y. C = P R S² Rᵀ Pᵀ.
  const covariance = [0,0,0];
  for (let k = 0; k < 3; k++) {
    covariance[0] += rotation[0][k] ** 2 * sigma[k] ** 2;
    covariance[1] += rotation[0][k] * rotation[1][k] * sigma[k] ** 2;
    covariance[2] += rotation[1][k] ** 2 * sigma[k] ** 2;
  }
  return {rotation, sigma, covariance};
}

export function alphaAt(dx, dy, covariance, opacity) {
  const [xx, xy, yy] = covariance;
  const determinant = xx * yy - xy * xy;
  const q = (yy * dx * dx - 2 * xy * dx * dy + xx * dy * dy) / determinant;
  return opacity * Math.exp(-.5 * q);
}

export function over(color, alpha, background) {
  return color.map((channel, i) => channel * alpha + background[i] * (1 - alpha));
}

export function toSRGB(value) {
  return value <= .0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - .055;
}
