/* data.js — the onboarding tracker demo's fabricated world. Nothing here is a real person.

   The source app learns about a new hire from the identity platform's approval emails, which land under a Gmail
   label: one when the onboarding request is raised, more when someone comments, and a last one when the request
   is approved (or rejected / revoked). The 10-minute sync parses them into the sheet. So this file is mostly
   EMAILS, written in the shape the app's own parser reads (labels in this order, values after each label), and
   mock.js runs the real sync over them; the sheet rows are its output. Dates are relative to today, so the
   dashboard's "starts in N days" badges always read sensibly.

   - history: emails already read and synced, the checklist items IT and HR have ticked since, and one record
     added by hand (the dashboard's manual-entry failsafe);
   - arriving: two emails still unread in the label, for the visitor to sync. */
window.ONBOARD_DATA = (function () {
  'use strict';

  function day(n) { var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return d; }
  function us(n) { var d = day(n); return ('0' + (d.getMonth() + 1)).slice(-2) + '/' + ('0' + d.getDate()).slice(-2) + '/' + d.getFullYear(); }
  function iso(n) { var d = day(n); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function at(n, hh, mm) { var d = day(n); d.setHours(hh, mm || 0, 0, 0); return d.getTime(); }

  var PORTAL = 'https://uid.example.invalid/ui.com/portal/approval/';
  var FOOT = '<p><a href="' + PORTAL + '{id}">View the Request</a></p><p style="color:#999">© Identity platform notifications</p>';

  // One onboarding request, laid out the way the identity platform's email lists the form fields.
  function request(p) {
    var rows = [['Workspace Domain', 'example.edu'], ['Approval ID', p.id], ['Form', 'Staff Onboarding'],
      ['Last Name', p.last], ['First Name', p.first], ['Personal Email', p.personal], ['Home Address', p.address],
      ['Cell Phone', p.phone], ['Work Status', p.status], ['Start Date', us(p.start)], ['Date Official', us(p.official)],
      ['Duty Position', p.dept], ['Building', p.campus], ['Room', p.where], ['Job Description', p.role]];
    return '<p>A staff onboarding request needs your approval.</p><table>' +
      rows.map(function (r) { return '<tr><td><b>' + r[0] + '</b></td><td>' + r[1] + '</td></tr>'; }).join('') + '</table>' +
      FOOT.replace('{id}', p.id);
  }
  function comment(id, who, text) {
    return '<p>' + who + ' left a comment on Approval-' + id + '.</p><p>Comment: ' + text + '</p>' + FOOT.replace('{id}', id);
  }
  function decided(id, word) { return '<p>Onboarding request Approval-' + id + ' was ' + word + '.</p>' + FOOT.replace('{id}', id); }

  var people = [
    { id: '10418', first: 'Avery', last: 'Coleman', personal: 'avery.coleman@mail.example.com', address: '14 Orchard Lane, Maple Grove',
      phone: '410-555-0142', status: 'Full-time', start: 12, official: -6, dept: 'Elementary', campus: 'Lower Campus', where: '112',
      role: '3rd Grade Teacher', raised: -6 },
    { id: '10422', first: 'Priya', last: 'Natarajan', personal: 'priya.n@mail.example.com', address: '9 Linden Court, Maple Grove',
      phone: '410-555-0177', status: 'Full-time', start: 5, official: -9, dept: 'High School', campus: 'Upper Campus', where: '204',
      role: 'Mathematics Teacher', raised: -9 },
    { id: '10425', first: 'Tomás', last: 'Reyes', personal: 'treyes.home@mail.example.com', address: '301 Mill Road, Cedar Falls',
      phone: '410-555-0119', status: 'Part-time', start: 19, official: -2, dept: 'Facilities', campus: 'Upper Campus', where: 'Maintenance shop',
      role: 'Evening Custodian', raised: -2 },
    { id: '10409', first: 'Hannah', last: 'Brooks', personal: 'hbrooks@mail.example.com', address: '77 Birch Street, Maple Grove',
      phone: '410-555-0163', status: 'Full-time', start: -21, official: -40, dept: 'Business Office', campus: 'Upper Campus', where: 'Front office',
      role: 'Accounts Assistant', raised: -40 },
    { id: '10401', first: 'Elijah', last: 'Grant', personal: 'egrant.coach@mail.example.com', address: '5 Ridge View, Cedar Falls',
      phone: '410-555-0108', status: 'Seasonal', start: -30, official: -52, dept: 'Athletics', campus: 'Upper Campus', where: 'Field house',
      role: 'Assistant Basketball Coach', raised: -52 },
    { id: '10414', first: 'Casey', last: 'Morgan', personal: 'caseym@mail.example.com', address: '220 Hollow Road, Cedar Falls',
      phone: '410-555-0131', status: 'Part-time', start: 8, official: -14, dept: 'Transportation', campus: 'Bus lot', where: 'Dispatch',
      role: 'Bus Driver', raised: -14 },
    { id: '10431', first: 'Grace', last: 'Liu', personal: 'grace.liu@mail.example.com', address: '48 Willow Way, Maple Grove',
      phone: '410-555-0186', status: 'Full-time', start: 26, official: 0, dept: 'High School', campus: 'Upper Campus', where: '118',
      role: 'Spanish Teacher', raised: 0 }
  ];
  var P = {}; people.forEach(function (p) { P[p.id] = p; });
  function subj(id, what) { return '[Identity] Staff Onboarding Approval-' + id + ' ' + what; }

  var emails = [
    { id: 'e01', thread: 'a10401', at: at(-52, 9, 14), subject: subj('10401', 'Approval Requested'), html: request(P['10401']) },
    { id: 'e02', thread: 'a10401', at: at(-31, 16, 2), subject: subj('10401', 'Approved'), html: decided('10401', 'approved') },
    { id: 'e03', thread: 'a10409', at: at(-40, 8, 51), subject: subj('10409', 'Approval Requested'), html: request(P['10409']) },
    { id: 'e04', thread: 'a10409', at: at(-38, 13, 20), subject: '(Approval-10409) Kendra Moss Commented on Staff Onboarding',
      html: comment('10409', 'Kendra Moss', 'Benefits paperwork is with the business manager; she starts on payroll the 1st.') },
    { id: 'e05', thread: 'a10409', at: at(-22, 15, 45), subject: subj('10409', 'Approved'), html: decided('10409', 'approved') },
    { id: 'e06', thread: 'a10422', at: at(-9, 10, 3), subject: subj('10422', 'Approval Requested'), html: request(P['10422']) },
    { id: 'e07', thread: 'a10414', at: at(-14, 11, 37), subject: subj('10414', 'Approval Requested'), html: request(P['10414']) },
    { id: 'e08', thread: 'a10414', at: at(-4, 9, 12), subject: subj('10414', 'Revoked'), html: decided('10414', 'revoked: the candidate accepted another position') },
    { id: 'e09', thread: 'a10418', at: at(-6, 14, 26), subject: subj('10418', 'Approval Requested'), html: request(P['10418']) },
    { id: 'e10', thread: 'a10418', at: at(-5, 8, 40), subject: '(Approval-10418) Kendra Moss Commented on Staff Onboarding',
      html: comment('10418', 'Kendra Moss', 'Offer letter is signed. I-9 appointment is Thursday at 9.') },
    { id: 'e11', thread: 'a10425', at: at(-2, 15, 9), subject: subj('10425', 'Approval Requested'), html: request(P['10425']) },
    // still unread when the visitor arrives
    { id: 'e12', thread: 'a10418', at: at(0, 7, 58), subject: '(Approval-10418) Ray Delgado Commented on Staff Onboarding',
      html: comment('10418', 'Ray Delgado', 'Laptop is imaged and on the cart; badge photo after the staff meeting.'), arriving: true },
    { id: 'e13', thread: 'a10431', at: at(0, 8, 21), subject: subj('10431', 'Approval Requested'), html: request(P['10431']), arriving: true }
  ];

  // What IT and HR have ticked since the history was synced (column letters, as the dashboard sends them).
  var ALL = ['M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W'];
  var ticks = {
    '10401': ALL, '10409': ALL,
    '10422': ['M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'W'],     // one left: benefits
    '10418': ['M', 'P', 'Q', 'S'],
    '10425': ['P']
  };
  var manual = { firstName: 'Lena', lastName: 'Ortiz', email: '', startDate: iso(6), department: 'Kindergarten', role: 'Teacher Aide',
    manager: 'Kindergarten lead teacher', location: 'Lower Campus', notes: 'Hired at Tuesday\'s board meeting; the identity request will follow.' };

  return { emails: emails, ticks: ticks, manual: manual, people: people };
})();
