/* data.js — fabricated sensor snapshot for the Campus Monitoring demo.
   Fake device IDs; HCS building names kept. checkedAt is stamped at load so the
   dashboard reads "just now". Shape matches Monitor.js getMonitorSnapshot(). */
window.MONITOR_SNAP = (function () {
  var devices = [
    { name: 'HS Kitchen Walk-in Freezer', type: 'THSensor', id: 'demo-th-0001', building: 'High School', category: 'fridge', status: 'normal', summary: '-2.4°F', detail: '-2.4°F (limits -10–10°F)', online: true },
    { name: 'EL Cafeteria Fridge', type: 'THSensor', id: 'demo-th-0002', building: 'Elementary', category: 'fridge', status: 'alert', summary: '52.6°F — ALERT', detail: 'high temp · 52.6°F (limits 34–41°F)', online: true },
    { name: 'HS Boiler Room', type: 'THSensor', id: 'demo-th-0003', building: 'High School', category: 'fridge', status: 'normal', summary: '78.1°F', detail: '78.1°F · humidity 44%', online: true },
    { name: 'HS Server Closet', type: 'THSensor', id: 'demo-th-0004', building: 'High School', category: 'fridge', status: 'normal', summary: '69.8°F', detail: '69.8°F (limits 50–80°F)', online: true },
    { name: 'EL Kitchen Leak Sensor', type: 'LeakSensor', id: 'demo-lk-0001', building: 'Elementary', category: 'leak', status: 'alert', summary: 'LEAK DETECTED', detail: 'battery 4/4', online: true },
    { name: 'HS Boiler Room Leak Sensor', type: 'LeakSensor', id: 'demo-lk-0002', building: 'High School', category: 'leak', status: 'normal', summary: 'Normal', detail: 'battery 3/4', online: true },
    { name: 'KG Water Heater Leak Sensor', type: 'LeakSensor', id: 'demo-lk-0003', building: 'Kindergarten', category: 'leak', status: 'offline', summary: 'Offline', detail: '', online: false },
    { name: 'HS Main Water Meter', type: 'WaterMeterController', id: 'demo-wm-0001', building: 'High School', category: 'meter', status: 'normal', summary: 'Normal', detail: 'valve open', online: true },
    { name: 'Bus Barn Hub', type: 'Hub', id: 'demo-hub-0001', building: 'Bus Barn', category: 'hub', status: 'info', summary: 'Online', detail: '10.20.4.11', online: true }
  ];
  var rollups = {
    leak: { alert: true, count: 1, names: ['EL Kitchen Leak Sensor'], devices: [
      { name: 'EL Kitchen Leak Sensor', status: 'alert', summary: 'LEAK DETECTED' },
      { name: 'HS Boiler Room Leak Sensor', status: 'normal', summary: 'Normal' },
      { name: 'KG Water Heater Leak Sensor', status: 'offline', summary: 'Offline' },
      { name: 'HS Main Water Meter', status: 'normal', summary: 'Normal' }
    ] },
    fridge: { alert: true, count: 1, names: ['EL Cafeteria Fridge'], devices: [
      { name: 'HS Kitchen Walk-in Freezer', status: 'normal', summary: '-2.4°F' },
      { name: 'EL Cafeteria Fridge', status: 'alert', summary: '52.6°F — ALERT' },
      { name: 'HS Boiler Room', status: 'normal', summary: '78.1°F' },
      { name: 'HS Server Closet', status: 'normal', summary: '69.8°F' }
    ] }
  };
  return { checkedAt: new Date().toISOString(), count: devices.length, devices: devices, rollups: rollups };
})();
