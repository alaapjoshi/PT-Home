import React, { useEffect, useRef, useState } from 'react';
import { Scene } from './components/Avatar.jsx';
import { SERVICE, DATA, RAD, updateFilter } from './lib/sensorFusion.js';

export function App() {
  const [status, setStatus] = useState('Disconnected');
  const [mode, setMode] = useState('arm');
  const [angle, setAngle] = useState(0);
  const [sample, setSample] = useState(null);
  const [recording, setRecording] = useState(false);
  const [count, setCount] = useState(0);
  const [log, setLog] = useState([]);
  const ble = useRef(null),
    filters = useRef([{ initialized: false }, { initialized: false }]);
  const baseline = useRef(null),
    buffer = useRef(''),
    recordingRef = useRef(false),
    armed = useRef(true),
    angleRef = useRef(0);
  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);
  function resetCalibration() {
    filters.current = [{ initialized: false }, { initialized: false }];
    baseline.current = null;
    setAngle(0);
    armed.current = true;
    setCount(0);
  }
  function processLine(line) {
    const values = line.trim().split(',').map(Number);
    if (values.length !== 13 || values.some((x) => !Number.isFinite(x))) return;
    const [t, ...d] = values;
    const a = { ax: d[0], ay: d[1], az: d[2], gx: d[3], gy: d[4], gz: d[5] };
    const b = { ax: d[6], ay: d[7], az: d[8], gx: d[9], gy: d[10], gz: d[11] };
    updateFilter(filters.current[0], a, t);
    updateFilter(filters.current[1], b, t);
    const diff = (filters.current[1].pitch - filters.current[0].pitch) / RAD;
    if (baseline.current === null) baseline.current = diff;
    const estimate = Math.min(145, Math.max(0, Math.abs(diff - baseline.current)));
    angleRef.current = estimate;
    setAngle(estimate);
    setSample({ t, a, b });
    if (estimate < 25) armed.current = true;
    if (estimate > 65 && armed.current) {
      armed.current = false;
      setCount((n) => n + 1);
    }
    if (recordingRef.current)
      setLog((old) =>
        old.length >= 12000
          ? old
          : [
              ...old,
              {
                time: t,
                angle: estimate,
                ...Object.fromEntries(d.map((v, i) => ['value' + i, v])),
              },
            ],
      );
  }
  function onNotify(event) {
    buffer.current += new TextDecoder().decode(event.target.value);
    const lines = buffer.current.split('\n');
    buffer.current = lines.pop() || '';
    for (const line of lines) processLine(line);
  }
  async function connect() {
    try {
      if (!navigator.bluetooth)
        throw new Error('Web Bluetooth is unavailable. Use Chrome or Edge on macOS.');
      setStatus('Selecting device…');
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ name: 'Feather-Rehab' }],
        optionalServices: [SERVICE],
      });
      device.addEventListener('gattserverdisconnected', () => {
        setStatus('Disconnected');
        ble.current = null;
      });
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(SERVICE);
      const characteristic = await service.getCharacteristic(DATA);
      characteristic.addEventListener('characteristicvaluechanged', onNotify);
      await characteristic.startNotifications();
      ble.current = { device, characteristic };
      resetCalibration();
      setStatus('Connected');
    } catch (e) {
      setStatus(e.message || 'Connection failed');
    }
  }
  function disconnect() {
    ble.current?.device.gatt.disconnect();
    ble.current = null;
    setStatus('Disconnected');
  }
  function exportCsv() {
    if (!log.length) return;
    const keys = Object.keys(log[0]);
    const csv = [keys.join(','), ...log.map((row) => keys.map((k) => row[k]).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rehab-session.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <main>
      <header>
        <h1>PT @Home</h1>
        <p>Two MPU6050 sensors · nRF52832 BLE · 3D movement visualization</p>
      </header>
      <section className="toolbar">
        <button onClick={connect} disabled={status === 'Connected'}>
          Connect Feather
        </button>
        <button onClick={disconnect}>Disconnect</button>
        <button onClick={resetCalibration}>Calibrate straight position</button>
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="arm">Arm</option>
          <option value="leg">Leg</option>
        </select>
        <span className="status">{status}</span>
      </section>
      <div className="layout">
        <section className="viewport">
          <Scene angle={angle * RAD} mode={mode} />
        </section>
        <aside>
          <h2>Live data</h2>
          <div className="metric">
            <small>Estimated bend</small>
            <strong>{angle.toFixed(1)}°</strong>
          </div>
          <div className="metric">
            <small>Repetitions (demo thresholds)</small>
            <strong>{count}</strong>
          </div>
          <p>
            Sensor A:{' '}
            {sample
              ? `${sample.a.ax.toFixed(2)}, ${sample.a.ay.toFixed(2)}, ${sample.a.az.toFixed(2)} g`
              : 'Waiting…'}
          </p>
          <p>
            Sensor B:{' '}
            {sample
              ? `${sample.b.ax.toFixed(2)}, ${sample.b.ay.toFixed(2)}, ${sample.b.az.toFixed(2)} g`
              : 'Waiting…'}
          </p>
          <button
            onClick={() => {
              setRecording((v) => !v);
            }}
          >
            {recording ? 'Stop recording' : 'Start recording'}
          </button>
          <button onClick={exportCsv} disabled={!log.length}>
            Export CSV ({log.length})
          </button>
          <button onClick={() => setLog([])}>Clear recording</button>
          <p className="note">
            Mount sensors with matching axes, hold both segments straight and stationary, then
            calibrate. The angle is an experimental estimate, not a medically validated measurement.
            Rotate the model with your mouse.
          </p>
        </aside>
      </div>
    </main>
  );
}
