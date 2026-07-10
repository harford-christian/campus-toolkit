/* data.js — fabricated content for the Lobby TV demo.
   Control-state schema mirrors lobby-control.json. The demo keeps HCS branding but
   uses invented content: local sample pages for the "slides" and "livestream" screens
   (so nothing hits YouTube), and placeholder photos for the carousel. */
window.LOBBYTV_DATA = {
  // Base control state; per-mode overrides are merged over this in mock.js.
  base: {
    rev: 7, updatedAt: '2026-07-10T09:00:00-04:00', updatedBy: 'demo@harfordchristian.org',
    scheduleOverride: 'auto', chapelCancelled: false,
    tickerMessages: ['Welcome to Harford Christian School', 'Spirit Week is next week — themes posted', 'Go Eagles!'],
    emergency: { active: false, message: '' },
    content: { mode: 'placeholder', slideUrl: '', videoId: '' },
    nightOff: { enabled: false, start: '21:00', end: '06:00' },
    athletePhotos: { enabled: false, start: '15:30', end: '22:00', intervalSecs: 8, livestreamWins: true, testUntil: '', testTeam: '' },
    tvPower: { command: 'on', commandAt: '2026-07-10T07:00:00-04:00' }
  },
  // Placeholder photos for the carousel (no real people).
  photos: [
    'https://picsum.photos/seed/hcslobby1/1280/720',
    'https://picsum.photos/seed/hcslobby2/1280/720',
    'https://picsum.photos/seed/hcslobby3/1280/720',
    'https://picsum.photos/seed/hcslobby4/1280/720',
    'https://picsum.photos/seed/hcslobby5/1280/720',
    'https://picsum.photos/seed/hcslobby6/1280/720'
  ],
  // Canned control states shown by the wrapper's TV tabs (?mode=…).
  modes: {
    slides:     { content: { mode: 'slides', slideUrl: 'slides-sample.html', videoId: '' } },
    pictures:   { content: { mode: 'carousel', interval: 5 },
                  tickerMessages: ['Homecoming photos — go Eagles!', 'Fall sports in full swing'] },
    livestream: { content: { mode: 'slides', slideUrl: 'live-sample.html', videoId: '' },
                  tickerMessages: ['● LIVE: Varsity Soccer vs Riverdale'] },
    emergency:  { emergency: { active: true, message: 'Lockdown drill in progress — please follow staff instructions.' },
                  content: { mode: 'placeholder' } },
    nightoff:   { nightOff: { enabled: true, start: '00:00', end: '23:59' }, content: { mode: 'placeholder' } }
  },
  // Seeded named presets (Apply loads one of these into the live control).
  presets: {
    'Morning Announcements': { content: { mode: 'slides', slideUrl: 'slides-sample.html', videoId: '' }, tickerMessages: ['Good morning, Eagles!', 'Chapel today at 9:50'] },
    'Game Day': { content: { mode: 'carousel', interval: 6 }, tickerMessages: ['Home game tonight — 6:00 PM', 'Wear your Eagle gear!'] },
    'Snow Delay': { scheduleOverride: 'delay2hr', content: { mode: 'placeholder' }, tickerMessages: ['2-hour delay today — buses run 2 hours late'] }
  }
};
