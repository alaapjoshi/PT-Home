#include <Arduino.h>
#include <Wire.h>
#include <bluefruit.h>

// Feather nRF52832 + two MPU6050 modules at 0x68 and 0x69.
// MPU6050: VCC->3V, GND->GND, SDA->SDA, SCL->SCL.
// Sensor 1 AD0->GND; Sensor 2 AD0->3V.
// Output BLE notify packets: "millis,ax1,ay1,az1,gx1,gy1,gz1,ax2,ay2,az2,gx2,gy2,gz2\n"
// Accelerometer in g, gyroscope in degrees/sec. This is NOT a clinical device.

#define MPU_A 0x68
#define MPU_B 0x69
#define BLE_UUID_SERVICE "b1198b58-5b2e-4a6b-90a3-94dcdba68110"
#define BLE_UUID_DATA    "b1198b58-5b2e-4a6b-90a3-94dcdba68111"

BLEService motionService(BLE_UUID_SERVICE);
BLECharacteristic motionData(BLE_UUID_DATA);

struct Reading { float ax, ay, az, gx, gy, gz; };

bool writeRegister(uint8_t address, uint8_t reg, uint8_t value) {
  Wire.beginTransmission(address);
  Wire.write(reg);
  Wire.write(value);
  return Wire.endTransmission() == 0;
}

bool initMPU(uint8_t address) {
  Wire.beginTransmission(address);
  Wire.write(0x75); // WHO_AM_I
  if (Wire.endTransmission(false) != 0 || Wire.requestFrom(address, (uint8_t)1) != 1) return false;
  uint8_t id = Wire.read();
  if (id != 0x68) return false;
  return writeRegister(address, 0x6B, 0x00) && // wake up
         writeRegister(address, 0x1B, 0x00) && // gyro +/-250 dps
         writeRegister(address, 0x1C, 0x00) && // accel +/-2g
         writeRegister(address, 0x1A, 0x03);   // low-pass filter
}

bool readMPU(uint8_t address, Reading &r) {
  Wire.beginTransmission(address);
  Wire.write(0x3B);
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom(address, (uint8_t)14) != 14) return false;
  int16_t raw[7];
  for (int i = 0; i < 7; i++) raw[i] = (int16_t)((Wire.read() << 8) | Wire.read());
  r.ax = raw[0] / 16384.0f; r.ay = raw[1] / 16384.0f; r.az = raw[2] / 16384.0f;
  r.gx = raw[4] / 131.0f; r.gy = raw[5] / 131.0f; r.gz = raw[6] / 131.0f;
  return true;
}

void startAdvertising() {
  Bluefruit.Advertising.stop();
  Bluefruit.Advertising.addFlags(BLE_GAP_ADV_FLAGS_LE_ONLY_GENERAL_DISC_MODE);
  Bluefruit.Advertising.addTxPower();
  Bluefruit.Advertising.addService(motionService);
  Bluefruit.ScanResponse.addName();
  Bluefruit.Advertising.restartOnDisconnect(true);
  Bluefruit.Advertising.setInterval(32, 244);
  Bluefruit.Advertising.setFastTimeout(30);
  Bluefruit.Advertising.start(0);
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  Wire.setClock(100000);
  delay(500);
  bool a = initMPU(MPU_A), b = initMPU(MPU_B);
  Serial.printf("MPU 0x68: %s, MPU 0x69: %s\n", a ? "OK" : "MISSING", b ? "OK" : "MISSING");
  Bluefruit.begin();
  Bluefruit.setName("Feather-Rehab");
  motionService.begin();
  motionData.setProperties(CHR_PROPS_NOTIFY);
  motionData.setPermission(SECMODE_OPEN, SECMODE_NO_ACCESS);
  motionData.setMaxLen(200);
  motionData.begin();
  startAdvertising();
}

void loop() {
  static uint32_t lastSample = 0;
  if (millis() - lastSample < 50) return; // 20 Hz
  lastSample = millis();
  Reading a, b;
  if (!readMPU(MPU_A, a) || !readMPU(MPU_B, b)) {
    Serial.println("Sensor read failed. Check wiring and AD0.");
    return;
  }
  char payload[180];
  snprintf(payload, sizeof(payload), "%lu,%.3f,%.3f,%.3f,%.2f,%.2f,%.2f,%.3f,%.3f,%.3f,%.2f,%.2f,%.2f\n",
           (unsigned long)millis(), a.ax,a.ay,a.az,a.gx,a.gy,a.gz,b.ax,b.ay,b.az,b.gx,b.gy,b.gz);
  Serial.print(payload);
  if (Bluefruit.connected() && motionData.notifyEnabled()) {
    motionData.notify((uint8_t*)payload, strlen(payload));
  }
}
