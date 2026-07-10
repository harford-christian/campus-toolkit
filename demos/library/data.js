/* data.js — fabricated Library catalog for the showcase demo.
   All titles are well-known public-domain / classic children's books; every
   student name, email and ID here is invented. No real records appear.
   Shape matches what PortalServer.js returns to BrowseCatalog.html:
     uid, title, author, genre, readingLevel, status ('Available'|'Out'),
     dueDate (ISO string when Out), coverUrl (''=CSS placeholder cover),
     description, callNumber, note (librarian "why we love it", = staff pick). */
window.LIBRARY_DATA = {
  books: [
    { uid:'HCS-0001', title:'The Very Hungry Caterpillar', author:'Eric Carle', genre:'Picture Book', readingLevel:'Pre-K', status:'Available', dueDate:'', coverUrl:'', callNumber:'E CAR', description:'A tiny caterpillar eats through a week of food before spinning a cocoon and becoming a beautiful butterfly.' },
    { uid:'HCS-0002', title:'Where the Wild Things Are', author:'Maurice Sendak', genre:'Picture Book', readingLevel:'Pre-K', status:'Out', dueDate:'2026-06-22', coverUrl:'', callNumber:'E SEN', description:'Sent to bed without supper, Max sails to an island of Wild Things and is crowned their king.' },
    { uid:'HCS-0003', title:'Brown Bear, Brown Bear, What Do You See?', author:'Bill Martin Jr.', genre:'Picture Book', readingLevel:'Pre-K', status:'Available', dueDate:'', coverUrl:'', callNumber:'E MAR', description:'A rhythmic parade of colorful animals introduces the youngest readers to colors and names.' },
    { uid:'HCS-0004', title:'Goodnight Moon', author:'Margaret Wise Brown', genre:'Picture Book', readingLevel:'Pre-K', status:'Available', dueDate:'', coverUrl:'', callNumber:'E BRO', description:'A little bunny says goodnight to everything in the great green room as the stars come out.' },
    { uid:'HCS-0005', title:'The Snowy Day', author:'Ezra Jack Keats', genre:'Picture Book', readingLevel:'Pre-K', status:'Available', dueDate:'', coverUrl:'https://covers.openlibrary.org/b/id/10134995-L.jpg', callNumber:'E KEA', description:'Peter wakes to a city blanketed in snow and spends a wonder-filled day exploring it.', note:'A perfect first snow-day read — every child sees themselves in Peter.' },
    { uid:'HCS-0006', title:'Corduroy', author:'Don Freeman', genre:'Picture Book', readingLevel:'Pre-K', status:'Available', dueDate:'', coverUrl:'', callNumber:'E FRE', description:'A department-store teddy bear searches the store at night for his missing button — and finds a friend.' },

    { uid:'HCS-0007', title:'Green Eggs and Ham', author:'Dr. Seuss', genre:'Early Reader', readingLevel:'K-2', status:'Out', dueDate:'2026-06-28', coverUrl:'', callNumber:'E SEU', description:'Sam-I-Am will not stop until his friend tries a curious green breakfast — anywhere, with anyone.' },
    { uid:'HCS-0008', title:'Frog and Toad Are Friends', author:'Arnold Lobel', genre:'Early Reader', readingLevel:'K-2', status:'Available', dueDate:'', coverUrl:'', callNumber:'E LOB', description:'Five gentle stories about two best friends and the small adventures they share.' },
    { uid:'HCS-0009', title:'The Cat in the Hat', author:'Dr. Seuss', genre:'Early Reader', readingLevel:'K-2', status:'Available', dueDate:'', coverUrl:'', callNumber:'E SEU', description:'A mischievous cat turns a rainy afternoon upside down for two kids stuck indoors.' },
    { uid:'HCS-0010', title:'Amelia Bedelia', author:'Peggy Parish', genre:'Early Reader', readingLevel:'Grades 1-3', status:'Available', dueDate:'', coverUrl:'', callNumber:'E PAR', description:'A literal-minded housekeeper takes every instruction exactly as written, with hilarious results.' },

    { uid:'HCS-0011', title:'Charlotte’s Web', author:'E.B. White', genre:'Chapter Book', readingLevel:'Grades 3-5', status:'Available', dueDate:'', coverUrl:'https://covers.openlibrary.org/b/id/8461797-L.jpg', callNumber:'F WHI', description:'A clever barn spider spins words in her web to save Wilbur the pig from the butcher.', note:'Our most-loved read-aloud — bring tissues for the ending.' },
    { uid:'HCS-0012', title:'The Tale of Despereaux', author:'Kate DiCamillo', genre:'Chapter Book', readingLevel:'Grades 3-5', status:'Out', dueDate:'2026-06-19', coverUrl:'', callNumber:'F DIC', description:'A tiny, big-eared mouse who loves stories sets out to rescue a princess from the dungeon.' },
    { uid:'HCS-0013', title:'Charlie and the Chocolate Factory', author:'Roald Dahl', genre:'Chapter Book', readingLevel:'Grades 3-5', status:'Out', dueDate:'2026-06-30', coverUrl:'', callNumber:'F DAH', description:'A poor boy wins a golden ticket into Willy Wonka’s magical and mysterious chocolate factory.' },
    { uid:'HCS-0014', title:'Matilda', author:'Roald Dahl', genre:'Chapter Book', readingLevel:'Grades 3-5', status:'Available', dueDate:'', coverUrl:'', callNumber:'F DAH', description:'A brilliant girl with a secret power outwits her awful parents and a terrifying headmistress.' },
    { uid:'HCS-0015', title:'The Boxcar Children', author:'Gertrude Chandler Warner', genre:'Chapter Book', readingLevel:'Grades 3-5', status:'Available', dueDate:'', coverUrl:'', callNumber:'F WAR', description:'Four orphaned siblings make a cozy home in an abandoned boxcar and solve their first mystery.' },
    { uid:'HCS-0016', title:'Ramona Quimby, Age 8', author:'Beverly Cleary', genre:'Chapter Book', readingLevel:'Grades 3-5', status:'Available', dueDate:'', coverUrl:'', callNumber:'F CLE', description:'Third grade brings new teachers, new worries, and everyday adventures for spirited Ramona.' },

    { uid:'HCS-0017', title:'Holes', author:'Louis Sachar', genre:'Middle Grade', readingLevel:'Grades 4-6', status:'Out', dueDate:'2026-06-10', coverUrl:'https://covers.openlibrary.org/b/id/19797-L.jpg', callNumber:'F SAC', description:'Wrongly sent to a desert detention camp, Stanley digs holes all day and uncovers a buried family curse.', note:'A perfect mystery-adventure — kids race to the last page.' },
    { uid:'HCS-0018', title:'Bridge to Terabithia', author:'Katherine Paterson', genre:'Middle Grade', readingLevel:'Grades 4-6', status:'Available', dueDate:'', coverUrl:'', callNumber:'F PAT', description:'Two lonely friends invent a secret magical kingdom in the woods behind their homes.' },
    { uid:'HCS-0019', title:'Wonder', author:'R.J. Palacio', genre:'Middle Grade', readingLevel:'Grades 4-6', status:'Available', dueDate:'', coverUrl:'https://covers.openlibrary.org/b/id/8223160-L.jpg', callNumber:'F PAL', description:'August Pullman, born with a facial difference, enters mainstream school for the first time in fifth grade.', note:'Choose kind. The book that starts the best classroom conversations.' },
    { uid:'HCS-0020', title:'Because of Winn-Dixie', author:'Kate DiCamillo', genre:'Middle Grade', readingLevel:'Grades 4-6', status:'Available', dueDate:'', coverUrl:'', callNumber:'F DIC', description:'A stray dog helps a preacher’s daughter make friends and find her place in a new town.' },

    { uid:'HCS-0021', title:'Number the Stars', author:'Lois Lowry', genre:'Historical Fiction', readingLevel:'Grades 4-6', status:'Available', dueDate:'', coverUrl:'', callNumber:'F LOW', description:'In WWII Denmark, ten-year-old Annemarie helps her best friend’s family escape the Nazis.' },
    { uid:'HCS-0022', title:'Sarah, Plain and Tall', author:'Patricia MacLachlan', genre:'Historical Fiction', readingLevel:'Grades 3-5', status:'Available', dueDate:'', coverUrl:'', callNumber:'F MAC', description:'A mail-order bride from Maine comes to the prairie and slowly becomes a family’s new mother.' },
    { uid:'HCS-0023', title:'The War That Saved My Life', author:'Kimberly Brubaker Bradley', genre:'Historical Fiction', readingLevel:'Grades 5+', status:'Available', dueDate:'', coverUrl:'', callNumber:'F BRA', description:'Evacuated from wartime London, a disabled girl discovers freedom and family in the countryside.' },

    { uid:'HCS-0024', title:'The Lion, the Witch and the Wardrobe', author:'C.S. Lewis', genre:'Fantasy', readingLevel:'Grades 4-6', status:'Out', dueDate:'2026-06-25', coverUrl:'', callNumber:'F LEW', description:'Four children step through a wardrobe into Narnia, a land held in endless winter by a White Witch.' },
    { uid:'HCS-0025', title:'Harry Potter and the Sorcerer’s Stone', author:'J.K. Rowling', genre:'Fantasy', readingLevel:'Grades 5+', status:'Out', dueDate:'2026-06-21', coverUrl:'https://covers.openlibrary.org/b/id/276518-L.jpg', callNumber:'F ROW', description:'On his eleventh birthday, an orphan learns he is a wizard and heads off to Hogwarts.', note:'The one that turns reluctant readers into lifelong ones.' },
    { uid:'HCS-0026', title:'Percy Jackson: The Lightning Thief', author:'Rick Riordan', genre:'Fantasy', readingLevel:'Grades 5+', status:'Available', dueDate:'', coverUrl:'', callNumber:'F RIO', description:'A boy discovers he is the son of a Greek god and must stop a war among the Olympians.' },
    { uid:'HCS-0027', title:'The Hobbit', author:'J.R.R. Tolkien', genre:'Fantasy', readingLevel:'Middle School', status:'Available', dueDate:'', coverUrl:'', callNumber:'F TOL', description:'Bilbo Baggins joins thirteen dwarves on a quest to reclaim a treasure guarded by a dragon.' },
    { uid:'HCS-0028', title:'The BFG', author:'Roald Dahl', genre:'Fantasy', readingLevel:'Grades 3-5', status:'Available', dueDate:'', coverUrl:'', callNumber:'F DAH', description:'A Big Friendly Giant and a brave girl team up to stop the child-eating giants for good.' },

    { uid:'HCS-0029', title:'A Wrinkle in Time', author:'Madeleine L’Engle', genre:'Sci-Fi', readingLevel:'Grades 5+', status:'Out', dueDate:'2026-06-27', coverUrl:'', callNumber:'F LEN', description:'Meg, her brother, and a friend travel across space and time to rescue her missing scientist father.' },
    { uid:'HCS-0030', title:'The Giver', author:'Lois Lowry', genre:'Sci-Fi', readingLevel:'Middle School', status:'Out', dueDate:'2026-07-02', coverUrl:'', callNumber:'F LOW', description:'In a colorless, controlled society, one boy is chosen to inherit the memories of the past.' },
    { uid:'HCS-0031', title:'The Wild Robot', author:'Peter Brown', genre:'Sci-Fi', readingLevel:'Grades 4-6', status:'Available', dueDate:'', coverUrl:'https://covers.openlibrary.org/b/id/7443301-L.jpg', callNumber:'F BRO', description:'A robot named Roz washes ashore on a wild island and learns to survive — and to belong.', note:'Gentle, funny, and surprisingly moving. A staff favorite this year.' },

    { uid:'HCS-0032', title:'Hatchet', author:'Gary Paulsen', genre:'Adventure', readingLevel:'Grades 5+', status:'Available', dueDate:'', coverUrl:'', callNumber:'F PAU', description:'After a plane crash, a thirteen-year-old survives alone in the northern wilderness with only a hatchet.' },
    { uid:'HCS-0033', title:'Island of the Blue Dolphins', author:'Scott O’Dell', genre:'Adventure', readingLevel:'Grades 5+', status:'Available', dueDate:'', coverUrl:'', callNumber:'F ODE', description:'A young girl is left behind on an island and survives alone for eighteen years.' },
    { uid:'HCS-0034', title:'My Side of the Mountain', author:'Jean Craighead George', genre:'Adventure', readingLevel:'Grades 5+', status:'Available', dueDate:'', coverUrl:'', callNumber:'F GEO', description:'A city boy runs away to the Catskill Mountains to live off the land with a falcon named Frightful.' },

    { uid:'HCS-0035', title:'The Westing Game', author:'Ellen Raskin', genre:'Mystery', readingLevel:'Grades 5+', status:'Available', dueDate:'', coverUrl:'', callNumber:'F RAS', description:'Sixteen heirs must solve a tricky puzzle to inherit a fortune from an eccentric millionaire.' },
    { uid:'HCS-0036', title:'Encyclopedia Brown, Boy Detective', author:'Donald J. Sobol', genre:'Mystery', readingLevel:'Grades 3-5', status:'Out', dueDate:'2026-06-24', coverUrl:'', callNumber:'F SOB', description:'A ten-year-old detective cracks neighborhood cases using sharp logic and careful observation.' },
    { uid:'HCS-0037', title:'From the Mixed-Up Files of Mrs. Basil E. Frankweiler', author:'E.L. Konigsburg', genre:'Mystery', readingLevel:'Grades 4-6', status:'Available', dueDate:'', coverUrl:'', callNumber:'F KON', description:'Two runaway siblings hide out in a museum and unravel the mystery of a marble statue.' },

    { uid:'HCS-0038', title:'Dog Man: A Tale of Two Kitties', author:'Dav Pilkey', genre:'Graphic Novel', readingLevel:'Grades 1-3', status:'Out', dueDate:'2026-06-18', coverUrl:'https://covers.openlibrary.org/b/isbn/9780545935210-L.jpg', callNumber:'GN PIL', description:'Part dog, part cop, all hero — Dog Man fights crime and chaos in a laugh-out-loud comic.', note:'The single most-requested series at the desk. Always checked out for a reason.' },
    { uid:'HCS-0039', title:'Smile', author:'Raina Telgemeier', genre:'Graphic Novel', readingLevel:'Grades 4-6', status:'Out', dueDate:'2026-06-29', coverUrl:'', callNumber:'GN TEL', description:'A true middle-school story of braces, friendship troubles, and growing up.' },
    { uid:'HCS-0040', title:'New Kid', author:'Jerry Craft', genre:'Graphic Novel', readingLevel:'Grades 5+', status:'Available', dueDate:'', coverUrl:'', callNumber:'GN CRA', description:'One of the only kids of color at his new private school, Jordan navigates two very different worlds.' },
    { uid:'HCS-0041', title:'Amulet: The Stonekeeper', author:'Kazu Kibuishi', genre:'Graphic Novel', readingLevel:'Grades 4-6', status:'Available', dueDate:'', coverUrl:'', callNumber:'GN KIB', description:'After moving into a mysterious old house, two siblings are pulled into a fantastical underground world.' },

    { uid:'HCS-0042', title:'National Geographic Kids: Sharks', author:'Anne Schreiber', genre:'Non-Fiction', readingLevel:'Grades 3-5', status:'Available', dueDate:'', coverUrl:'', callNumber:'J 597.3 SCH', description:'Vivid photos and fast facts about the ocean’s most famous and misunderstood predators.' },
    { uid:'HCS-0043', title:'What If You Had Animal Teeth?', author:'Sandra Markle', genre:'Non-Fiction', readingLevel:'Grades 1-3', status:'Available', dueDate:'', coverUrl:'', callNumber:'J 591.4 MAR', description:'Imagine trading your teeth for a beaver’s or a shark’s in this playful science picture book.' },
    { uid:'HCS-0044', title:'The Magic School Bus: Inside the Earth', author:'Joanna Cole', genre:'Non-Fiction', readingLevel:'Grades 1-3', status:'Available', dueDate:'', coverUrl:'', callNumber:'J 550 COL', description:'Ms. Frizzle’s class takes a wild field trip down through the layers of the Earth.' },

    { uid:'HCS-0045', title:'The Story of Ruby Bridges', author:'Robert Coles', genre:'Biography', readingLevel:'Grades 3-5', status:'Available', dueDate:'', coverUrl:'', callNumber:'J B BRIDGES', description:'The true story of the brave six-year-old who helped integrate a New Orleans school in 1960.' },
    { uid:'HCS-0046', title:'Who Was Albert Einstein?', author:'Jess Brallier', genre:'Biography', readingLevel:'Grades 4-6', status:'Out', dueDate:'2026-06-20', coverUrl:'', callNumber:'J B EINSTEIN', description:'The life of the curious, daydreaming boy who grew up to reimagine our understanding of the universe.' },
    { uid:'HCS-0047', title:'I Am Rosa Parks', author:'Brad Meltzer', genre:'Biography', readingLevel:'Grades 1-3', status:'Available', dueDate:'', coverUrl:'', callNumber:'J B PARKS', description:'An illustrated introduction to the woman whose quiet courage helped launch a movement.' },

    { uid:'HCS-0048', title:'A Child’s Garden of Verses', author:'Robert Louis Stevenson', genre:'Poetry', readingLevel:'Grades 1-3', status:'Available', dueDate:'', coverUrl:'', callNumber:'J 811 STE', description:'Classic, timeless poems about childhood, imagination, and the wonder of everyday play.' },
    { uid:'HCS-0049', title:'Where the Sidewalk Ends', author:'Shel Silverstein', genre:'Poetry', readingLevel:'Grades 3-5', status:'Available', dueDate:'', coverUrl:'https://covers.openlibrary.org/b/id/31070-L.jpg', callNumber:'J 811 SIL', description:'Silly, strange, and wonderful poems with the author’s own line drawings.', note:'The poetry book kids actually beg to check out. Start here.' },
    { uid:'HCS-0050', title:'Falling Up', author:'Shel Silverstein', genre:'Poetry', readingLevel:'Grades 3-5', status:'Available', dueDate:'', coverUrl:'', callNumber:'J 811 SIL', description:'More topsy-turvy poems and drawings from the beloved author of Where the Sidewalk Ends.' }
  ],

  // Used by the Student Dashboard view (getStudentBooks). Fully invented student.
  studentBooks: {
    ok: true,
    studentName: 'Jordan Miller',
    studentId: 'S-1042',
    email: 'jordan.miller@example.org',
    currentlyOut: [
      { uid:'HCS-0017', title:'Holes', author:'Louis Sachar', coverUrl:'', dueDate:'2026-07-08T00:00:00.000Z', daysUntilDue: 5 },
      { uid:'HCS-0038', title:'Dog Man: A Tale of Two Kitties', author:'Dav Pilkey', coverUrl:'', dueDate:'2026-07-01T00:00:00.000Z', daysUntilDue: -2 }
    ],
    history: [
      { timestamp:'2026-06-20T14:30:00.000Z', bookId:'HCS-0025', action:'Returned', title:'Harry Potter and the Sorcerer’s Stone' },
      { timestamp:'2026-06-06T13:10:00.000Z', bookId:'HCS-0031', action:'Returned', title:'The Wild Robot' },
      { timestamp:'2026-05-22T09:45:00.000Z', bookId:'HCS-0011', action:'Returned', title:'Charlotte’s Web' }
    ]
  }
};
