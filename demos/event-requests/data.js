/* data.js — fabricated data for the Event Requests & Approvals demo.
   Fake staff, events, doors, and approval groups. No real people or records.
   Event dates are stored as day-offsets from "today" (see mock.js) so the
   dashboard always shows upcoming events whenever the demo is opened.
   Approval-group model: a group is REQUIRED on a request per these triggers —
     Planning & Events  → always
     AV / IT Team       → avRequired === 'Yes'
     Facilities / Setup Crew → heavyItems === 'Yes'
     Security & Doors   → doorSchedule starts with 'Yes'
     Athletics / Business Office → added explicitly. */
window.EVENTREQ_DATA = {
  currentUser: { email: 'demo@harfordchristian.org', isAdmin: true, isSuperApprover: false },
  myGroups: ['AV / IT Team', 'Security & Doors'],
  allGroups: [
    'Planning & Events', 'AV / IT Team', 'Facilities / Setup Crew',
    'Security & Doors', 'Athletics', 'Business Office'
  ],
  doors: [
    { name: 'Front Entrance',      group: 'Main Building' },
    { name: 'Main Office Door',    group: 'Main Building' },
    { name: 'Lobby North',         group: 'Main Building' },
    { name: 'Lobby South',         group: 'Main Building' },
    { name: 'Gym Doors',           group: 'Athletics' },
    { name: 'Gym Lobby',           group: 'Athletics' },
    { name: 'Locker Room Hall',    group: 'Athletics' },
    { name: 'Field House',         group: 'Athletics' },
    { name: 'Auditorium Main',     group: 'Arts' },
    { name: 'Auditorium Stage Door', group: 'Arts' },
    { name: 'Band Room',           group: 'Arts' },
    { name: 'Choir Room',          group: 'Arts' },
    { name: 'Cafeteria East',      group: 'Support' },
    { name: 'Kitchen Service',     group: 'Support' },
    { name: 'Gymnasium Storage',   group: 'Support' }
  ],
  // Declarative requests. mock.js expands inDays/time into real date strings.
  requests: [
    {
      token: 'req-a1b2c3d4-fall-band', requesterName: 'Jane Smith', requesterEmail: 'jsmith@harfordchristian.org',
      eventName: 'Fall Band Concert', eventType: 'School', location: 'Auditorium',
      inDays: 34, time: '19:00', setup: true,
      avRequired: 'Yes', heavyItems: 'No', doorSchedule: 'Yes, door schedule configured',
      target: 'Auditorium Main, Lobby North', startTime: '18:00', endTime: '21:30', doorActions: '',
      status: 'Pending',
      requiredGroups: ['Planning & Events', 'AV / IT Team', 'Security & Doors'],
      approvals: { 'Planning & Events': 'Approved', 'AV / IT Team': 'Pending', 'Security & Doors': 'Pending' }
    },
    {
      token: 'req-e5f6a7b8-bball', requesterName: 'Coach Rivera', requesterEmail: 'mrivera@harfordchristian.org',
      eventName: 'Varsity Basketball Home Opener', eventType: 'School', location: 'Main Gymnasium',
      inDays: 90, time: '18:00', setup: false,
      avRequired: 'No', heavyItems: 'Yes', doorSchedule: 'No',
      target: '', startTime: '', endTime: '', doorActions: '',
      status: 'Pending',
      requiredGroups: ['Planning & Events', 'Athletics', 'Facilities / Setup Crew'],
      approvals: { 'Planning & Events': 'Pending', 'Athletics': 'Pending', 'Facilities / Setup Crew': 'Pending' }
    },
    {
      token: 'req-c9d0e1f2-worship', requesterName: 'Pastor Dan Ellis', requesterEmail: 'dellis@harfordchristian.org',
      eventName: 'Sunday Worship Service', eventType: 'Church', location: 'Chapel',
      inDays: 9, time: '09:00', setup: false,
      avRequired: 'No', heavyItems: 'No', doorSchedule: 'Yes, door schedule configured',
      target: '', startTime: '', endTime: '', doorActions: 'Unlock|Front Entrance, Lobby North|08:00|12:30',
      status: 'Active',
      requiredGroups: ['Planning & Events', 'Security & Doors', 'Business Office'],
      approvals: { 'Planning & Events': 'Approved', 'Security & Doors': 'Approved', 'Business Office': 'Approved' }
    },
    {
      token: 'req-3a4b5c6d-robotics', requesterName: 'Mr. Patel', requesterEmail: 'rpatel@harfordchristian.org',
      eventName: 'Robotics Club Showcase', eventType: 'School', location: 'STEM Lab',
      inDays: 49, time: '16:00', setup: false,
      avRequired: 'Yes', heavyItems: 'No', doorSchedule: 'No',
      target: '', startTime: '', endTime: '', doorActions: '',
      status: 'Pending',
      requiredGroups: ['Planning & Events', 'AV / IT Team'],
      approvals: { 'Planning & Events': 'Pending', 'AV / IT Team': 'Approved' }
    },
    {
      token: 'req-7e8f9a0b-musical', requesterName: 'Ms. Dawson', requesterEmail: 'kdawson@harfordchristian.org',
      eventName: 'Spring Musical Rehearsal', eventType: 'School', location: 'Auditorium',
      inDays: 43, time: '16:00', setup: false,
      avRequired: 'No', heavyItems: 'No', doorSchedule: 'Yes, door schedule configured',
      target: '', startTime: '', endTime: '', doorActions: 'Unlock|Auditorium Main|16:00|21:00;Lock|Band Room|20:00|',
      status: 'Active',
      requiredGroups: ['Planning & Events', 'Security & Doors'],
      approvals: { 'Planning & Events': 'Approved', 'Security & Doors': 'Approved' }
    },
    {
      token: 'req-1c2d3e4f-blood', requesterName: 'Jane Smith', requesterEmail: 'jsmith@harfordchristian.org',
      eventName: 'Community Blood Drive', eventType: 'Church', location: 'Fellowship Hall',
      inDays: 61, time: '10:00', setup: true,
      avRequired: 'No', heavyItems: 'Yes', doorSchedule: 'No',
      target: '', startTime: '', endTime: '', doorActions: '',
      status: 'Pending',
      requiredGroups: ['Planning & Events', 'Facilities / Setup Crew', 'Business Office'],
      approvals: { 'Planning & Events': 'Pending', 'Facilities / Setup Crew': 'Approved', 'Business Office': 'Pending' }
    },
    {
      token: 'req-5a6b7c8d-inservice', requesterName: 'Mr. Patel', requesterEmail: 'rpatel@harfordchristian.org',
      eventName: 'Faculty In-Service Day', eventType: 'School', location: 'Media Center',
      inDays: 35, time: '08:00', setup: false,
      avRequired: 'No', heavyItems: 'No', doorSchedule: 'No',
      target: '', startTime: '', endTime: '', doorActions: '',
      status: 'Denied',
      requiredGroups: ['Planning & Events'],
      approvals: { 'Planning & Events': 'Denied' }
    },
    {
      token: 'req-9e0f1a2b-artfair', requesterName: 'Ms. Dawson', requesterEmail: 'kdawson@harfordchristian.org',
      eventName: 'Elementary Art Fair', eventType: 'School', location: 'Commons',
      inDays: 106, time: '17:00', setup: false,
      avRequired: 'No', heavyItems: 'No', doorSchedule: 'No',
      target: '', startTime: '', endTime: '', doorActions: '',
      status: 'Pending',
      requiredGroups: ['Planning & Events'],
      approvals: { 'Planning & Events': 'Pending' }
    },
    {
      token: 'req-d3e4f5a6-graduation', requesterName: 'Jane Smith', requesterEmail: 'jsmith@harfordchristian.org',
      eventName: 'Graduation Ceremony', eventType: 'School', location: 'Main Gymnasium',
      inDays: 155, time: '10:00', setup: true,
      avRequired: 'Yes', heavyItems: 'Yes', doorSchedule: 'Yes, door schedule configured',
      target: 'Front Entrance, Lobby North, Lobby South', startTime: '09:00', endTime: '13:00', doorActions: '',
      status: 'Pending',
      requiredGroups: ['Planning & Events', 'AV / IT Team', 'Facilities / Setup Crew', 'Security & Doors'],
      approvals: {
        'Planning & Events': 'Approved', 'AV / IT Team': 'Pending',
        'Facilities / Setup Crew': 'Pending', 'Security & Doors': 'Approved'
      }
    }
  ]
};
