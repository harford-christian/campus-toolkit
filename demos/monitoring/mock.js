/* mock.js — Campus Monitoring demo backend. Single client call
   getMonitorSnapshotForClient() returns the fabricated snapshot with a freshened
   checkedAt so Refresh feels live. Mirrors WebApp.js / Monitor.js. */
window.MOCK_BACKEND = {
  getMonitorSnapshotForClient: function () {
    var s = JSON.parse(JSON.stringify(window.MONITOR_SNAP));
    s.checkedAt = new Date().toISOString();
    return s;
  },
  getMonitorSnapshot: function () { return this.getMonitorSnapshotForClient(); },
  runMonitorPoll: function () { var s = window.MONITOR_SNAP; return { count: s.count, rollups: s.rollups }; }
};
