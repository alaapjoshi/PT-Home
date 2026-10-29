export const SERVICE = 'b1198b58-5b2e-4a6b-90a3-94dcdba68110';
export const DATA = 'b1198b58-5b2e-4a6b-90a3-94dcdba68111';
export const RAD = Math.PI / 180;

// Illustrative complementary filter. Assumes MPU modules mounted with matching axes.
// For real rehabilitation measurements, calibrate axes to body segments and validate angles.
export function updateFilter(filter, r, timestamp) {
  const accelPitch = Math.atan2(r.ay, Math.sqrt(r.ax * r.ax + r.az * r.az));
  const accelRoll = Math.atan2(-r.ax, r.az);
  if (!filter.initialized) {
    filter.pitch = accelPitch;
    filter.roll = accelRoll;
    filter.initialized = true;
  } else {
    const dt = Math.max(0.001, Math.min(0.2, (timestamp - filter.time) / 1000));
    filter.pitch = 0.98 * (filter.pitch + r.gx * RAD * dt) + 0.02 * accelPitch;
    filter.roll = 0.98 * (filter.roll + r.gy * RAD * dt) + 0.02 * accelRoll;
  }
  filter.time = timestamp;
}
