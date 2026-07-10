/* data.js — fabricated data for the Door Automation demo (Index tabs, Dashboard,
   Leadership all share this). Fake doors, schedules, events, and metrics — no real
   door names, emails, sheet IDs, or hardware IDs. Date-dependent fields (today,
   trend dates, leadership days) are computed in mock.js relative to "today". */
window.DOOR_DATA = {
  doorGroups: ['ALL', 'Cafeteria', 'Gym Lobby', 'Library', 'Main Entrance', 'Science Wing'],
  doors: [
    { name: 'Main Entrance North', group: 'Main Entrance' },
    { name: 'Main Entrance South', group: 'Main Entrance' },
    { name: 'Main Entrance Vestibule', group: 'Main Entrance' },
    { name: 'Gym Lobby East', group: 'Gym Lobby' },
    { name: 'Gym Lobby West', group: 'Gym Lobby' },
    { name: 'Gym Lobby Court Door', group: 'Gym Lobby' },
    { name: 'Cafeteria Main', group: 'Cafeteria' },
    { name: 'Cafeteria Patio', group: 'Cafeteria' },
    { name: 'Cafeteria Kitchen', group: 'Cafeteria' },
    { name: 'Library Front', group: 'Library' },
    { name: 'Library Courtyard', group: 'Library' },
    { name: 'Science Wing A', group: 'Science Wing' },
    { name: 'Science Wing B', group: 'Science Wing' },
    { name: 'Science Wing Loading', group: 'Science Wing' },
    { name: 'Science Wing Rear', group: 'Science Wing' }
  ],
  // getTodayData.doorActions — a plausible bell-driven day.
  todayActions: [
    { rowIndex: 2, name: 'Morning Arrival', eventType: 'Unlock', groups: 'Main Entrance', unlockTime: '07:00', lockTime: '08:15', unlockStatus: 'Completed', lockStatus: 'Completed', unlockTriggerID: '', lockTriggerID: '' },
    { rowIndex: 3, name: 'All-Day Front', eventType: 'Unlock', groups: 'Main Entrance North', unlockTime: '07:30', lockTime: '16:00', unlockStatus: 'Completed', lockStatus: 'Scheduled', unlockTriggerID: '', lockTriggerID: '' },
    { rowIndex: 4, name: 'Lunch Cafeteria', eventType: 'Unlock', groups: 'Cafeteria', unlockTime: '11:15', lockTime: '12:45', unlockStatus: 'Completed', lockStatus: 'Completed', unlockTriggerID: '', lockTriggerID: '' },
    { rowIndex: 5, name: 'Dismissal', eventType: 'Unlock', groups: 'ALL', unlockTime: '15:00', lockTime: '15:45', unlockStatus: 'Scheduled', lockStatus: 'Scheduled', unlockTriggerID: '', lockTriggerID: '' },
    { rowIndex: 6, name: 'Evening Basketball', eventType: 'Unlock', groups: 'Gym Lobby', unlockTime: '17:30', lockTime: '21:00', unlockStatus: 'Pending', lockStatus: 'Pending', unlockTriggerID: '', lockTriggerID: '' },
    { rowIndex: 7, name: 'Science Wing Lockup', eventType: 'Lock', groups: 'Science Wing', unlockTime: '', lockTime: '16:30', unlockStatus: 'N/A', lockStatus: 'Scheduled', unlockTriggerID: '', lockTriggerID: '' }
  ],
  // getDoorStates.doors — a mid-afternoon live snapshot.
  liveStates: [
    { name: 'Main Entrance North', group: 'Main Entrance', ison: true },
    { name: 'Main Entrance South', group: 'Main Entrance', ison: false },
    { name: 'Main Entrance Vestibule', group: 'Main Entrance', ison: true },
    { name: 'Gym Lobby East', group: 'Gym Lobby', ison: false },
    { name: 'Gym Lobby West', group: 'Gym Lobby', ison: false },
    { name: 'Gym Lobby Court Door', group: 'Gym Lobby', ison: false },
    { name: 'Cafeteria Main', group: 'Cafeteria', ison: false },
    { name: 'Cafeteria Patio', group: 'Cafeteria', ison: false },
    { name: 'Cafeteria Kitchen', group: 'Cafeteria', ison: false },
    { name: 'Library Front', group: 'Library', ison: true },
    { name: 'Library Courtyard', group: 'Library', ison: null, noSensor: true },
    { name: 'Science Wing A', group: 'Science Wing', ison: false },
    { name: 'Science Wing B', group: 'Science Wing', ison: false },
    { name: 'Science Wing Loading', group: 'Science Wing', ison: false },
    { name: 'Science Wing Rear', group: 'Science Wing', ison: null, error: 'Sensor unreachable' }
  ],
  scheduleTypes: ['Normal', '2HR Delay', 'Summer', 'Church'],
  // getEditData.events — upcoming custom events (inDays → resolved in mock.js).
  editEvents: [
    { rowIndex: 12, name: 'Fall Open House', inDays: 40, recurrence: 'ONE_TIME', unlockTime: '18:00', lockTime: '20:30', groups: 'Main Entrance, Gym Lobby', status: 'Active', createdBy: 'TODAY_EDIT', category: 'School', type: 'Unlock', targetType: 'GROUPS', resolution: '' },
    { rowIndex: 13, name: 'Basketball vs Rivals', inDays: 12, recurrence: 'ONE_TIME', unlockTime: '17:30', lockTime: '21:00', groups: 'Gym Lobby', status: 'Active', createdBy: 'SPORTS_SYNC', category: 'School', type: 'Unlock', targetType: 'GROUPS', resolution: '' },
    { rowIndex: 14, name: 'Christmas Concert', inDays: 60, recurrence: 'ANNUAL', annual: '12-15', unlockTime: '18:00', lockTime: '21:00', groups: 'Main Entrance, Gym Lobby', status: 'Active', createdBy: 'admin', category: 'Both', type: 'Unlock', targetType: 'GROUPS', resolution: '' },
    { rowIndex: 15, name: 'Exam Week Doors', inDays: 20, recurrence: 'CONSECUTIVE:5:WEEKDAYS', unlockTime: '07:15', lockTime: '15:30', groups: 'Main Entrance North', status: 'Active', createdBy: 'admin', category: 'School', type: 'Unlock', targetType: 'GROUPS', resolution: '' }
  ],
  // getSchedulesData.schedules — grouped by `type`.
  schedules: [
    { type: 'Normal', name: 'Morning Arrival', days: 'WEEKDAYS', unlockTime: '07:00', lockTime: '08:15', groups: 'Main Entrance', category: 'School', enabled: true, rowIndex: 2, override: null },
    { type: 'Normal', name: 'All-Day Front', days: 'WEEKDAYS', unlockTime: '07:30', lockTime: '16:00', groups: 'Main Entrance North', category: 'School', enabled: true, rowIndex: 3, override: { soRow: 3, until: 'INDAYS:41', days: 'WEEKDAYS', unlockTime: '08:00', lockTime: '15:00', groups: 'Main Entrance North', enabled: true } },
    { type: 'Normal', name: 'Lunch Cafeteria', days: 'WEEKDAYS', unlockTime: '11:15', lockTime: '12:45', groups: 'Cafeteria', category: 'School', enabled: true, rowIndex: 4, override: null },
    { type: 'Normal', name: 'Dismissal', days: 'WEEKDAYS', unlockTime: '15:00', lockTime: '15:45', groups: 'ALL', category: 'School', enabled: true, rowIndex: 5, override: null },
    { type: '2HR Delay', name: 'Delayed Arrival', days: 'WEEKDAYS', unlockTime: '09:00', lockTime: '10:15', groups: 'Main Entrance', category: 'School', enabled: true, rowIndex: 8, override: null },
    { type: 'Summer', name: 'Summer Office', days: 'WEEKDAYS', unlockTime: '08:00', lockTime: '15:00', groups: 'Main Entrance North', category: 'School', enabled: false, rowIndex: 9, override: null },
    { type: 'Church', name: 'Sunday Service', days: '0', unlockTime: '08:30', lockTime: '12:30', groups: 'Main Entrance, Gym Lobby', category: 'Church', enabled: true, rowIndex: 10, override: null },
    { type: 'Church', name: 'Wednesday Evening', days: '3', unlockTime: '18:00', lockTime: '20:30', groups: 'Main Entrance', category: 'Church', enabled: true, rowIndex: 11, override: null }
  ],
  // getDashboardData scalar metrics (dailyTrends computed in mock.js).
  dashboard: {
    doorOpsTotal: 428, doorOpsSuccess: 421, doorOpsFailed: 3, doorOpsSkipped: 4, doorOpsAttempted: 424,
    successRate: 99, failRate: 1, remediationCount: 2, deviceOfflineCount: 0, staleTriggersCount: 1, schedulingErrors: 0,
    byActionType: {
      UNLOCK: { total: 168, success: 166, failed: 1, skipped: 1 },
      LOCK: { total: 170, success: 168, failed: 1, skipped: 1 },
      FIRE_BATCH: { total: 6, success: 6, failed: 0, skipped: 0 },
      POST_OP_CHECK: { total: 40, success: 39, failed: 1, skipped: 0 },
      STATE_CHECK: { total: 22, success: 22, failed: 0, skipped: 0 },
      REBUILD: { total: 10, success: 10, failed: 0, skipped: 0 },
      DAILY_RESET: { total: 30, success: 30, failed: 0, skipped: 0 },
      STALE_TRIGGERS: { total: 3, success: 2, failed: 0, skipped: 1 },
      UPDATE_TRIGGERS: { total: 30, success: 30, failed: 0, skipped: 0 },
      BUILD_DAY_EVENTS: { total: 30, success: 30, failed: 0, skipped: 0 },
      CE_SYNC: { total: 8, success: 8, failed: 0, skipped: 0 },
      EVENT_SYNC: { total: 8, success: 8, failed: 0, skipped: 0 },
      INVALID_SCHEDULE_TYPE: { total: 0, success: 0, failed: 0, skipped: 0 },
      BUILD_ACTIONS: { total: 30, success: 30, failed: 0, skipped: 0 }
    },
    sportsSyncStats: { created: 8, canceled: 1, syncFailed: 0 },
    // recentFailures / emergencyOps timestamps use INDAYS offsets, resolved in mock.js.
    recentFailures: [
      { inDays: -2, time: '15:02', source: 'Scheduler', action: 'LOCK', doors: 'Science Wing Rear', notes: 'Sensor unreachable; retried and locked on 2nd attempt' },
      { inDays: -6, time: '07:31', source: 'Scheduler', action: 'UNLOCK', doors: 'Gym Lobby East', notes: 'Relay timeout; remediated by post-op check' },
      { inDays: -11, time: '16:01', source: 'PostOpCheck', action: 'POST_OP_CHECK', doors: 'Cafeteria Patio', notes: 'State mismatch corrected' }
    ],
    emergencyOps: [
      { inDays: -8, time: '09:14', action: 'LOCKDOWN', result: 'SUCCESS', notes: 'Monthly lockdown drill' },
      { inDays: -8, time: '09:22', action: 'RESTORE', result: 'SUCCESS', notes: 'Drill ended; normal schedule restored' }
    ]
  }
};
