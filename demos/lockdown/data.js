/* data.js — fabricated data for the Emergency Lockdown demo.
   Fake doors, categories, and a demo user. No real staff, emails, or door names. */
window.LOCKDOWN_DATA = {
  demoUser: 'demo@harfordchristian.org',
  doors: [
    { name: 'Main Entrance',   group: 'Front' },
    { name: 'Front Office',    group: 'Front' },
    { name: 'Gymnasium Lobby', group: 'Athletics' },
    { name: 'Gym Side Exit',   group: 'Athletics' },
    { name: 'Cafeteria',       group: 'Commons' },
    { name: 'Library',         group: 'Commons' },
    { name: 'Elementary Wing', group: 'Classrooms' },
    { name: 'Science Hall',    group: 'Classrooms' },
    { name: 'Chapel',          group: 'Other' },
    { name: 'Loading Dock',    group: 'Other' }
  ],
  categories: [
    { category: 'Test',                shortCode: 'TEST', extraFields: [], alertEmails: '' },
    { category: 'Known Family Member', shortCode: 'KFM',  extraFields: ['Student name', 'Grade', 'Relation to subject'], alertEmails: '' },
    { category: 'Suspicious Person',   shortCode: 'SUS',  extraFields: ['Location on campus', 'Direction of travel'], alertEmails: '' },
    { category: 'Medical Emergency',   shortCode: 'MED',  extraFields: ['Room / area'], alertEmails: '' },
    { category: 'Severe Weather',      shortCode: 'WX',   extraFields: [], alertEmails: '' },
    { category: 'Active Threat',       shortCode: 'AT',   extraFields: [], alertEmails: '' }
  ]
};
