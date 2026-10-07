// PRD proposals are centralized here; confirmed progression and charge rules are shared.
export const BALANCE = {
  capacity: 10, refillMs: 36 * 60_000, practiceMs: 10_000,
  recovery: { hunger: [40, 60_000], energy: [60, 300_000], fun: [30, 120_000], social: [30, 120_000], hygiene: [50, 60_000], bladder: [80, 30_000] },
  decay: { hunger: 12, energy: 8, fun: 6, social: 6, hygiene: 8, bladder: 15 },
  activityMs: 120_000, sportMs: 300_000, upgradeMs: 30 * 60_000,
  // Reach per output (views, streams, fans cheering, users) before quality; 1,000 reach = 1 fame point.
  reaches: [10_000, 100_000, 1_000_000, 10_000_000], famePerReach: 1 / 1000, seasonMinReach: 10_000, contractBoost: .25,
  tiers: [['Newcomer', 0, 1], ['Emerging', 100, 2], ['Established', 1000, 4], ['Star', 10000, 6], ['Icon', 100000, 8]],
  milestones: [100, 1000, 10000, 100000], seasonMs: 28 * 86400_000, walkMsPerBlock: 25_000, walkCapMs: 90_000,
};
// Careers sit under four umbrellas. Origins are [humble start, best start]; the start is drawn at random.
export const UMBRELLAS = {sport: 'Sports', creator: 'Content creation', music: 'Entertainment', acting: 'Entertainment', tech: 'Technology'};
const career = (name, icon, family, skills, origins, location, output, beats, focus = skills[0]) => ({name, icon, family, umbrella: UMBRELLAS[family], skills, origins, location, output, beats, focus, audience: family === 'tech' ? 'users' : family === 'music' ? 'streams' : family === 'sport' ? 'fans cheering' : 'views'});
export const CAREERS = {
  football: career('Footballer', '⚽', 'sport', ['passing', 'dribbling', 'shooting', 'defending'], ['Street footballer', 'Academy prodigy'], 'sports', 'Match', ['Find space behind the defence.', 'A defender closes down your passing lane.', 'The ball breaks near your penalty area.', 'You have a clear view of goal.', 'Track the runner on the flank.', 'One final attack could change the game.'], 'passing'),
  musician: career('Musician', '♫', 'music', ['technique', 'songwriting', 'production', 'stage presence'], ['Street musician', 'Childhood prodigy'], 'studio', 'Song', ['Find the melody that makes this song yours.', 'The vocal passage reaches beyond your planned range.', 'Choose the final arrangement and mix.']),
  basketball: career('Basketball player', '◉', 'sport', ['shooting', 'passing', 'handling', 'defending'], ['Neighbourhood player', 'Academy prospect'], 'sports', 'Game', ['The defence leaves a shooting lane.', 'A teammate cuts toward the hoop.', 'Protect the ball against a pressing defender.', 'Contest a shot in the paint.', 'Create space from the wing.', 'Make the final possession count.'], 'passing'),
  wrestling: career('Wrestler', '★', 'sport', ['technique', 'strength', 'stamina', 'charisma'], ['Independent performer', 'Promotion prospect'], 'sports', 'Bout', ['Your opponent steps into grappling range.', 'Read the incoming move.', 'The crowd needs a moment to remember.', 'Your opponent is tiring.', 'Find the opening for a signature move.', 'Close the bout with a pin or a strong finish.']),
  tennis: career('Tennis player', '◌', 'sport', ['serve', 'forehand', 'backhand', 'footwork'], ['Public court player', 'Academy prodigy'], 'sports', 'Match', ['Set the tone with your serve.', 'Return a deep forehand.', 'Reach a backhand on the sideline.', 'Choose your approach to the net.', 'The opponent serves under pressure.', 'Find the winner on match point.']),
  vlogger: career('Vlogger', '◈', 'creator', ['storytelling', 'filming', 'editing', 'charisma'], ['Everyday beginner', 'Mentored storyteller'], 'creator', 'Vlog', ['Find an opening for today’s story.', 'An unexpected interruption changes the shoot.', 'Decide what to keep in the final cut.']),
  video: career('Video creator', '▷', 'creator', ['research', 'scripting', 'editing', 'presentation'], ['Self-taught creator', 'Media-trained creator'], 'creator', 'Video', ['Choose a hook that earns attention.', 'A key detail is missing from your research.', 'Set a pace that keeps viewers watching.']),
  skitmaker: career('Skitmaker', '☺', 'creator', ['comedy', 'acting', 'writing', 'timing'], ['Street comedy performer', 'Theatre-trained talent'], 'creator', 'Skit', ['Make the setup clear and funny.', 'Your scene partner changes a line.', 'Deliver the punchline at the right moment.']),
  streamer: career('Streamer', '◍', 'creator', ['commentary', 'engagement', 'production', 'format skill'], ['Bedroom beginner', 'Performance talent'], 'creator', 'Stream', ['Chat is asking for something unexpected.', 'A technical fault interrupts the stream.', 'Choose how to finish the segment.']),
  actor: career('Actor', '◇', 'acting', ['acting', 'expression', 'improvisation', 'charisma'], ['Independent theatre performer', 'Recognised young talent'], 'studio', 'Performance', ['Interpret your character’s motivation.', 'The director requests a restrained reaction.', 'Respond to your scene partner’s surprise.']),
  adult: career('Adult entertainment', '◆', 'acting', ['performance', 'presentation', 'production', 'business'], ['Independent subscription creator', 'Adult studio newcomer'], 'studio', 'After-dark release', ['Late-night negotiations: your rate, your limits, and who gets the final cut.', 'The lights dim and the camera rolls. Set the mood for tonight’s steamy shoot.', 'Your co-star cancels last minute and the set is getting heated.'], 'performance'),
  founder: career('Founder', '⬡', 'tech', ['product judgement', 'leadership', 'sales', 'finance'], ['Bootstrapped founder', 'Mentored builder'], 'tech', 'Product', ['Choose a feature after customer feedback.', 'Allocate a limited production budget.', 'Resolve a problem before delivery.']),
  developer: career('Developer', '⌘', 'tech', ['coding', 'debugging', 'architecture', 'communication'], ['Self-taught freelancer', 'Mentored coding prodigy'], 'tech', 'Client project', ['Inspect a fictional bug in the client project.', 'Choose a repair that preserves stability.', 'Communicate a delivery tradeoff.']),
  web3: career('Web3 builder', '⬢', 'tech', ['product', 'community', 'research', 'technical skill'], ['Independent newcomer', 'Community-connected talent'], 'tech', 'Product', ['Pick a useful fictional product direction.', 'Respond to community concerns.', 'Handle a launch-readiness decision.']),
};
export const LOCATIONS = {
  home: {name: 'Your apartment', subtitle: 'A little room for big dreams', icon: '⌂', color: '#edc594'},
  sports: {name: 'Arena district', subtitle: 'Leave it all on the pitch', icon: '⚽', color: '#88bda5'},
  studio: {name: 'Sound & screen', subtitle: 'Where your next chapter gets made', icon: '♫', color: '#b4a7d9'},
  creator: {name: 'Creator quarter', subtitle: 'Make something worth sharing', icon: '▷', color: '#e0a28f'},
  tech: {name: 'Innovation hub', subtitle: 'Start small. Build something lasting.', icon: '⌘', color: '#85b9ca'},
  nightclub: {name: 'Club Neon', subtitle: 'Dance till the lights come on', icon: '🪩', color: '#7b4fa3'},
  lounge: {name: 'Velvet Lounge', subtitle: 'Chill, chat and karaoke', icon: '🍸', color: '#b23a48'},
  cinema: {name: 'Palm Cinema', subtitle: 'Popcorn and premieres', icon: '🍿', color: '#d23b4b'},
  mall: {name: 'Palm Mall', subtitle: 'Shops, food court and fashion', icon: '🛒', color: '#2f6fb3'},
  tvStation: {name: 'PCTV Studios', subtitle: 'Interviews and talk shows', icon: '📺', color: '#3d6a8a'},
  radio: {name: 'Palm FM', subtitle: 'Airplay and call-ins', icon: '📻', color: '#e08a3d'},
  market: {name: 'Balogun-style market', subtitle: 'Busy stalls, fabrics and snacks', icon: '🧺', color: '#d9573f'},
  gym: {name: 'Iron Palm Gym', subtitle: 'Get fit with the city', icon: '🏋️', color: '#2f3237'},
  hospital: {name: 'Palm General Hospital', subtitle: 'Check-ups and recovery', icon: '🏥', color: '#3d9a7a'},
  worship: {name: 'Palm Chapel & Mosque', subtitle: 'Quiet, calm and community', icon: '🕊️', color: '#c9a46a'},
  eventHall: {name: 'Grand Event Hall', subtitle: 'Owambe parties and launches', icon: '🎉', color: '#c9a227'},
  stadium: {name: 'Palm National Stadium', subtitle: 'Big matches and concerts', icon: '🏟', color: '#2f7a55'},
  park: {name: 'Central Park', subtitle: 'Walk, jog, picnic and breathe', icon: '🌳', color: '#5aa36b'},
  airport: {name: 'Palm International Airport', subtitle: 'Fly out for shows', icon: '✈️', color: '#5b6fa8'},
  beach: {name: 'Island beach', subtitle: 'Sun, sand and the lagoon', icon: '🏖️', color: '#e8c97a'},
  plaza: {name: 'Palm plaza', subtitle: 'Meet the city. Find your people.', icon: '◈', color: '#c3c48c'},
  street: {name: 'Your street', subtitle: 'Step out into Palm City', icon: '🚪', color: '#c9d6bf'},
};
// Every location is an 11×11 lot in one open neighbourhood; x/z are lot centres in world units.
export const TOWN = {
  home: {x: -16, z: 0, pin: '🏠', height: 4.5}, plaza: {x: 0, z: 0, pin: '🛍️', height: 2.6}, studio: {x: 16, z: 0, pin: '🎙️', height: 3.9},
  sports: {x: -16, z: -16, pin: '🏟️', height: 2.4}, creator: {x: 0, z: -16, pin: '🎬', height: 3.3}, tech: {x: 16, z: -16, pin: '💡', height: 7.6},
  // Places around the city: downtown nightlife and media, Palm Heights services, and the island beach.
  nightclub: {x: 32, z: 0, pin: '🪩', height: 3.4}, lounge: {x: 48, z: 0, pin: '🍸', height: 3}, cinema: {x: 64, z: 0, pin: '🍿', height: 4},
  mall: {x: 32, z: -16, pin: '🛒', height: 4.4}, tvStation: {x: 48, z: -16, pin: '📺', height: 6.5}, radio: {x: 64, z: -16, pin: '📻', height: 5.5},
  market: {x: -32, z: 0, pin: '🧺', height: 2.2}, gym: {x: -32, z: -16, pin: '🏋️', height: 3.2}, hospital: {x: -48, z: -16, pin: '🏥', height: 4.6},
  worship: {x: -64, z: -16, pin: '🕊️', height: 4.8}, eventHall: {x: 16, z: -32, pin: '🎉', height: 3.6}, stadium: {x: -16, z: -32, pin: '🏟', height: 4.2},
  park: {x: 0, z: -32, pin: '🌳', height: 1.5}, airport: {x: 64, z: -48, pin: '✈️', height: 3.8}, beach: {x: 0, z: 28, pin: '🏖️', height: 2},
};
export const lotAt = (x, z) => Object.keys(TOWN).find(key => Math.abs(x - TOWN[key].x) <= 5.5 && Math.abs(z - TOWN[key].z) <= 5.5);
export const ITEMS = {
  // There are no coins: items unlock at a fame level and are free to claim. Fame is never spent.
  chair: {name: 'Lounge chair', fame: 25, description: 'Place it in a free spot at home.', furniture: true},
  gear: {name: 'Career equipment', fame: 50, description: 'Practise at home. Production quality +5 per level above 1. Higher levels need more fame.', upgradable: true, slot: 'gear'},
  jacket: {name: 'Signature jacket', fame: 150, description: 'An emerald layer for your everyday look.', slot: 'clothes'},
  trophyShelf: {name: 'Award shelf', fame: 1000, description: 'A place for the milestones you earn.', furniture: true},
  // Home items: place them at home, then tap them to use. `use` says what they do while you use them;
  // `extra` changes other needs, `onItem` puts you on the item itself (a seat or a treadmill).
  wardrobe: {name: 'Wardrobe', fame: 20, description: 'Change outfits at home. Tap it to open your wardrobe.', furniture: true},
  ankaraRug: {name: 'Ankara print rug', fame: 50, description: 'A bright patterned rug for the living room.', furniture: true},
  floorLamp: {name: 'Floor lamp', fame: 30, description: 'A tall lamp for warm evenings.', furniture: true},
  plants: {name: 'Indoor plant pack', fame: 40, description: 'Monstera and snake plants to water.', furniture: true, use: {verb: 'Water plants', icon: '❀', need: 'fun', amount: 5, ms: 10_000, pose: 'water'}},
  mirror: {name: 'Full-length mirror', fame: 60, description: 'Check your look before you head out.', furniture: true, use: {verb: 'Check your look', icon: '🪞', need: 'fun', amount: 10, ms: 15_000, pose: 'gesture'}},
  beanBag: {name: 'Bean bag', fame: 80, description: 'A comfy seat for lazy afternoons.', furniture: true, use: {verb: 'Lounge', icon: '◒', need: 'fun', amount: 25, ms: 45_000, pose: 'sit', seat: .4, onItem: true}},
  bookshelf: {name: 'Bookshelf', fame: 100, description: 'Read a good book to unwind, and learn a little for your career.', furniture: true, use: {verb: 'Read a book', icon: '📖', need: 'fun', amount: 20, ms: 40_000, pose: 'chat', learn: {family: '*', points: 3}}},
  microwave: {name: 'Microwave', fame: 120, description: 'A fast, so-so meal when you are in a rush.', furniture: true, use: {verb: 'Quick meal', icon: '🍱', need: 'hunger', amount: 25, ms: 15_000, pose: 'chat'}},
  coffeeMachine: {name: 'Coffee machine', fame: 150, description: 'A quick energy boost.', furniture: true, use: {verb: 'Make coffee', icon: '☕', need: 'energy', amount: 20, ms: 20_000, pose: 'chat'}},
  washingMachine: {name: 'Washing machine', fame: 250, description: 'Fresh clothes keep you clean.', furniture: true, use: {verb: 'Do laundry', icon: '🧺', need: 'hygiene', amount: 20, ms: 30_000, pose: 'chat'}},
  dressingTable: {name: 'Dressing table', fame: 300, description: 'Groom and get ready for the day.', furniture: true, use: {verb: 'Get ready', icon: '💄', need: 'hygiene', amount: 30, ms: 30_000, pose: 'work', seat: .52}},
  gamingConsole: {name: 'Gaming console', fame: 400, description: 'Big fun, a little tiring.', furniture: true, use: {verb: 'Play games', icon: '🎮', need: 'fun', amount: 40, ms: 60_000, pose: 'work', seat: .4, extra: {energy: -5}}},
  soundSystem: {name: 'Sound system', fame: 500, description: 'Turn it up and dance.', furniture: true, use: {verb: 'Dance', icon: '🔊', need: 'fun', amount: 35, ms: 45_000, pose: 'perform', extra: {energy: -5}}},
  aquarium: {name: 'Aquarium', fame: 600, description: 'Calming fish to watch.', furniture: true, use: {verb: 'Watch the fish', icon: '🐠', need: 'fun', amount: 12, ms: 20_000, pose: null}},
  treadmill: {name: 'Treadmill', fame: 800, description: 'Run at home: fun, but sweaty and tiring.', furniture: true, use: {verb: 'Run', icon: '🏃', need: 'fun', amount: 20, ms: 40_000, pose: 'sport', onItem: true, extra: {energy: -10, hygiene: -15}}},
  // Home extensions, built on the lawn around your house. Tap them at home to use them.
  garden: {name: 'Garden', fame: 300, description: 'Vegetable beds and flowers to tend.', extension: {x: -6.6, z: 6.4, face: 3.1416}, use: {verb: 'Tend the garden', icon: '🌱', need: 'fun', amount: 20, ms: 30_000, pose: 'water', extra: {hunger: 10}}},
  terrace: {name: 'Rooftop terrace', fame: 800, description: 'A deck with lights for hangouts.', extension: {x: -7.6, z: -1.6, face: 1.5708}, use: {verb: 'Hang out on the terrace', icon: '🌇', need: 'fun', amount: 25, ms: 40_000, pose: 'sit', seat: .45, extra: {social: 10}}},
  garage: {name: 'Garage', fame: 1500, description: 'Show off your rides.', extension: {x: 7.6, z: -1.6, face: -1.5708}, use: {verb: 'Tinker with your ride', icon: '🔧', need: 'fun', amount: 15, ms: 30_000, pose: 'chat'}},
  pool: {name: 'Swimming pool', fame: 3000, description: 'Swim laps at home.', extension: {x: 6.6, z: 6.4, face: 3.1416}, use: {verb: 'Swim laps', icon: '🏊', need: 'hygiene', amount: 25, ms: 40_000, pose: 'sport', extra: {fun: 20, energy: -5}}},
  gymRoom: {name: 'Home gym room', fame: 5000, description: 'A full training room: workouts build fitness.', extension: {x: 3.2, z: -7.6, face: 0}, use: {verb: 'Train in your gym', icon: '🏋️', need: 'fun', amount: 15, ms: 45_000, pose: 'sport', extra: {energy: -10, hygiene: -15}, fitness: 1}},
  studioRoom: {name: 'Home recording studio', fame: 8000, description: 'Record without travelling. Musicians and creators train here.', extension: {x: -3.2, z: -7.6, face: 0}, use: {verb: 'Record in your studio', icon: '🎙️', need: 'fun', amount: 15, ms: 45_000, pose: 'perform', learn: {family: 'music', points: 8}, learnAlso: 'creator'}},
  // Home extensions, built on the lawn around your house. Tap them at home to use them.
  garden: {name: 'Garden', fame: 300, description: 'Vegetable beds and flowers to tend.', extension: {x: -6.6, z: 6.4, face: 3.1416}, use: {verb: 'Tend the garden', icon: '🌱', need: 'fun', amount: 20, ms: 30_000, pose: 'water', extra: {hunger: 10}}},
  terrace: {name: 'Rooftop terrace', fame: 800, description: 'A deck with lights for hangouts.', extension: {x: -7.6, z: -1.6, face: 1.5708}, use: {verb: 'Hang out on the terrace', icon: '🌇', need: 'fun', amount: 25, ms: 40_000, pose: 'sit', seat: .45, extra: {social: 10}}},
  garage: {name: 'Garage', fame: 1500, description: 'Show off your rides.', extension: {x: 7.6, z: -1.6, face: -1.5708}, use: {verb: 'Tinker with your ride', icon: '🔧', need: 'fun', amount: 15, ms: 30_000, pose: 'chat'}},
  pool: {name: 'Swimming pool', fame: 3000, description: 'Swim laps at home.', extension: {x: 6.6, z: 6.4, face: 3.1416}, use: {verb: 'Swim laps', icon: '🏊', need: 'hygiene', amount: 25, ms: 40_000, pose: 'sport', extra: {fun: 20, energy: -5}}},
  gymRoom: {name: 'Home gym room', fame: 5000, description: 'A full training room: workouts build fitness.', extension: {x: 3.2, z: -7.6, face: 0}, use: {verb: 'Train in your gym', icon: '🏋️', need: 'fun', amount: 15, ms: 45_000, pose: 'sport', extra: {energy: -10, hygiene: -15}, fitness: 1}},
  studioRoom: {name: 'Home recording studio', fame: 8000, description: 'Record without travelling. Musicians and creators train here.', extension: {x: -3.2, z: -7.6, face: 0}, use: {verb: 'Record in your studio', icon: '🎙️', need: 'fun', amount: 15, ms: 45_000, pose: 'perform', learn: {family: 'music', points: 8}, learnAlso: 'creator'}},
  // Home extensions, built on the lawn around your house. Tap them at home to use them.
  garden: {name: 'Garden', fame: 300, description: 'Vegetable beds and flowers to tend.', extension: {x: -6.6, z: 6.4, face: 3.1416}, use: {verb: 'Tend the garden', icon: '🌱', need: 'fun', amount: 20, ms: 30_000, pose: 'water', extra: {hunger: 10}}},
  terrace: {name: 'Rooftop terrace', fame: 800, description: 'A deck with lights for hangouts.', extension: {x: -7.6, z: -1.6, face: 1.5708}, use: {verb: 'Hang out on the terrace', icon: '🌇', need: 'fun', amount: 25, ms: 40_000, pose: 'sit', seat: .45, extra: {social: 10}}},
  garage: {name: 'Garage', fame: 1500, description: 'Show off your rides.', extension: {x: 7.6, z: -1.6, face: -1.5708}, use: {verb: 'Tinker with your ride', icon: '🔧', need: 'fun', amount: 15, ms: 30_000, pose: 'chat'}},
  pool: {name: 'Swimming pool', fame: 3000, description: 'Swim laps at home.', extension: {x: 6.6, z: 6.4, face: 3.1416}, use: {verb: 'Swim laps', icon: '🏊', need: 'hygiene', amount: 25, ms: 40_000, pose: 'sport', extra: {fun: 20, energy: -5}}},
  gymRoom: {name: 'Home gym room', fame: 5000, description: 'A full training room: workouts build fitness.', extension: {x: 3.2, z: -7.6, face: 0}, use: {verb: 'Train in your gym', icon: '🏋️', need: 'fun', amount: 15, ms: 45_000, pose: 'sport', extra: {energy: -10, hygiene: -15}, fitness: 1}},
  studioRoom: {name: 'Home recording studio', fame: 8000, description: 'Record without travelling. Musicians and creators train here.', extension: {x: -3.2, z: -7.6, face: 0}, use: {verb: 'Record in your studio', icon: '🎙️', need: 'fun', amount: 15, ms: 45_000, pose: 'perform', learn: {family: 'music', points: 8}, learnAlso: 'creator'}},
  // Home extensions, built on the lawn around your house. Tap them at home to use them.
  garden: {name: 'Garden', fame: 300, description: 'Vegetable beds and flowers to tend.', extension: {x: -6.6, z: 6.4, face: 3.1416}, use: {verb: 'Tend the garden', icon: '🌱', need: 'fun', amount: 20, ms: 30_000, pose: 'water', extra: {hunger: 10}}},
  terrace: {name: 'Rooftop terrace', fame: 800, description: 'A deck with lights for hangouts.', extension: {x: -7.6, z: -1.6, face: 1.5708}, use: {verb: 'Hang out on the terrace', icon: '🌇', need: 'fun', amount: 25, ms: 40_000, pose: 'sit', seat: .45, extra: {social: 10}}},
  garage: {name: 'Garage', fame: 1500, description: 'Show off your rides.', extension: {x: 7.6, z: -1.6, face: -1.5708}, use: {verb: 'Tinker with your ride', icon: '🔧', need: 'fun', amount: 15, ms: 30_000, pose: 'chat'}},
  pool: {name: 'Swimming pool', fame: 3000, description: 'Swim laps at home.', extension: {x: 6.6, z: 6.4, face: 3.1416}, use: {verb: 'Swim laps', icon: '🏊', need: 'hygiene', amount: 25, ms: 40_000, pose: 'sport', extra: {fun: 20, energy: -5}}},
  gymRoom: {name: 'Home gym room', fame: 5000, description: 'A full training room: workouts build fitness.', extension: {x: 3.2, z: -7.6, face: 0}, use: {verb: 'Train in your gym', icon: '🏋️', need: 'fun', amount: 15, ms: 45_000, pose: 'sport', extra: {energy: -10, hygiene: -15}, fitness: 1}},
  studioRoom: {name: 'Home recording studio', fame: 8000, description: 'Record without travelling. Musicians and creators train here.', extension: {x: -3.2, z: -7.6, face: 0}, use: {verb: 'Record in your studio', icon: '🎙️', need: 'fun', amount: 15, ms: 45_000, pose: 'perform', learn: {family: 'music', points: 8}, learnAlso: 'creator'}},
  // Upgrades: claim them once and they work in the background (no placing needed).
  // Gadgets you carry: they work anywhere (not on a trip).
  laptop: {name: 'Laptop', fame: 300, description: 'Tech careers can practise anywhere.', gadget: true},
  dslr: {name: 'DSLR camera', fame: 600, description: 'Take pro photos anywhere: social, and a little fame when you post.', gadget: true, use: {verb: 'Take photos', icon: '📷', need: 'social', amount: 10, ms: 20_000, pose: 'photo', post: true}},
  drone: {name: 'Drone camera', fame: 800, description: 'Creators earn 5% more fame from their work.', gadget: true},
  vrHeadset: {name: 'VR headset', fame: 1200, description: 'A big fun boost, anywhere.', gadget: true, use: {verb: 'Play VR', icon: '🥽', need: 'fun', amount: 45, ms: 40_000, pose: 'vr'}},
  curtains: {name: 'Blackout curtains', fame: 90, description: 'Darker nights at home: sleep 10% faster.', upgrade: {sleep: 10}},
  generator: {name: 'Generator', fame: 350, description: 'Keeps your lights and fridge on during power cuts.', upgrade: {generator: true}},
  sectional: {name: 'L-shaped sectional sofa', fame: 450, description: 'A bigger sofa: relaxing at home gives +15 more fun.', upgrade: {sofa: 15}},
  kingBed: {name: 'King-size bed', fame: 700, description: 'A bigger bed: sleep 20% faster.', upgrade: {sleep: 20}},
  ac: {name: 'Air conditioner', fame: 900, description: 'Cool rooms: sleep 15% faster, and hygiene drains 10% slower at home.', upgrade: {sleep: 15, hygiene: 10}},
  smartTv: {name: 'Bigger smart TV', fame: 1200, description: 'Watching your career on TV teaches up to 2 more insights.', upgrade: {insights: 2}},
  // More home items to place and use. `learn` trains your focus skill if your career is in that family.
  wallArt: {name: 'Wall art', fame: 70, description: 'A framed canvas on a stand.', furniture: true},
  barStools: {name: 'Kitchen bar stools', fame: 110, description: 'Perch at the counter.', furniture: true, use: {verb: 'Sit at the bar', icon: '🪑', need: 'fun', amount: 8, ms: 20_000, pose: 'sit', seat: .62, onItem: true}},
  balconySet: {name: 'Balcony chairs', fame: 260, description: 'Two chairs and a little table for slow afternoons.', furniture: true, use: {verb: 'Relax outside', icon: '☀', need: 'fun', amount: 18, ms: 30_000, pose: 'sit', seat: .46, onItem: true}},
  ringLight: {name: 'Ring light & camera', fame: 350, description: 'Film clips at home. Creators train as they film.', furniture: true, use: {verb: 'Film a clip', icon: '💡', need: 'social', amount: 15, ms: 30_000, pose: 'perform', learn: {family: 'creator', points: 4}}},
  piano: {name: 'Keyboard piano', fame: 650, description: 'Play for fun. Musicians train as they play.', furniture: true, use: {verb: 'Play piano', icon: '🎹', need: 'fun', amount: 25, ms: 40_000, pose: 'work', seat: .5, learn: {family: 'music', points: 4}}},
  bathtub: {name: 'Bathtub', fame: 700, description: 'Slower than a shower, but relaxing.', furniture: true, use: {verb: 'Take a bath', icon: '🛁', need: 'hygiene', amount: 60, ms: 60_000, pose: 'sitFloor', onItem: true, extra: {fun: 10}}},
  studioMic: {name: 'Home studio mic', fame: 800, description: 'Record at home. Musicians train as they record.', furniture: true, use: {verb: 'Record vocals', icon: '🎙️', need: 'fun', amount: 15, ms: 40_000, pose: 'perform', learn: {family: 'music', points: 6}}},
  trophyCabinet: {name: 'Trophy cabinet', fame: 1500, description: 'Shows off the awards you have won.', furniture: true, use: {verb: 'Admire your trophies', icon: '🏆', need: 'fun', amount: 10, ms: 10_000, pose: null}},
  weights: {name: 'Weight bench', fame: 1000, description: 'Lift weights: fun, but sweaty and tiring.', furniture: true, use: {verb: 'Lift weights', icon: '🏋️', need: 'fun', amount: 20, ms: 40_000, pose: 'sport', extra: {energy: -10, hygiene: -15}}},
};
// The wardrobe: clothes and accessories by slot. Each unlocks with fame (claimed free at Palm Boutique,
// Palm plaza) and most carry one perk. Wearing changes how you look; perks change the rules a little.
export const WEAR_SLOTS = {top: 'Tops', bottom: 'Bottoms', shoes: 'Shoes', head: 'Headwear', face: 'Eyewear', neck: 'Necklaces', ears: 'Earrings', wrist: 'Wrist', bag: 'Bags'};
// Perks add up across everything you wear, up to the cap.
export const PERKS = {
  battle: {cap: 20, label: v => `+${v}% hit chance in battles`},
  success: {cap: 15, label: v => `+${v}% success in career moments`},
  energy: {cap: 30, label: v => `${v}% less energy used`},
  hunger: {cap: 40, label: v => `Hunger drains ${v}% slower`},
  hygiene: {cap: 40, label: v => `Hygiene drains ${v}% slower`},
  fun: {cap: 40, label: v => `Fun drains ${v}% slower`},
  social: {cap: 40, label: v => `Social drains ${v}% slower`},
  fame: {cap: 25, label: v => `+${v}% fame from your work`},
  sleep: {cap: 40, label: v => `Sleep ${v}% faster`},
  chat: {cap: 10, label: v => `+${v} social from every chat`},
  scandal: {cap: 50, label: v => `${v}% less fame lost in mishaps`},
};
export const WEAR = {
  // Tops. `fit` is the cut: tee, tank, kit, jacket, hoodie, pyjama, suit, robe (agbada) or gown.
  plainTee: {name: 'Plain tee', slot: 'top', fame: 0, fit: 'tee', color: '#8ea9a4', note: 'A clean everyday basic.'},
  statementShirt: {name: 'Statement shirt', slot: 'top', fame: 100, fit: 'tee', color: '#e05a47', perk: ['battle', 5], note: 'Loud colours, louder confidence.'},
  ankaraShirt: {name: 'Ankara shirt', slot: 'top', fame: 50, fit: 'tee', color: '#e8a23a', perk: ['social', 10], note: 'Bright prints start conversations.'},
  tracksuitTop: {name: 'Tracksuit top', slot: 'top', fame: 80, fit: 'jacket', color: '#2f6fb3', perk: ['energy', 5], note: 'Light and easy to move in.'},
  teamJersey: {name: 'Team jersey', slot: 'top', fame: 120, fit: 'kit', color: '#c8102e', perk: ['success', 3], note: 'Play for the badge.'},
  hoodie: {name: 'Streetwear hoodie', slot: 'top', fame: 150, fit: 'hoodie', color: '#3b4252', perk: ['fun', 10], note: 'Cosy, and never boring.'},
  rainJacket: {name: 'Rain jacket', slot: 'top', fame: 60, fit: 'jacket', color: '#f2c230', perk: ['hygiene', 10], note: 'Stay dry, stay fresh.'},
  pyjamaTop: {name: 'Pyjama top', slot: 'top', fame: 40, fit: 'pyjama', color: '#9fb7d9', perk: ['sleep', 15], note: 'Sleep like you mean it.'},
  swimVest: {name: 'Swim vest', slot: 'top', fame: 200, fit: 'tank', color: '#2bb3c0', perk: ['energy', 3], note: 'Beach-ready and breezy.'},
  businessSuit: {name: 'Business suit', slot: 'top', fame: 600, fit: 'suit', color: '#2b2f3a', accent: '#7a2433', perk: ['success', 5], note: 'Dressed for the deal.'},
  agbada: {name: 'Agbada', slot: 'top', fame: 1500, fit: 'robe', color: '#f0e6d2', accent: '#c9a227', perk: ['fame', 5], note: 'Flowing robes for big occasions.'},
  stageOutfit: {name: 'Sparkly stage outfit', slot: 'top', fame: 2500, fit: 'jacket', color: '#7b4fa3', perk: ['success', 8], note: 'Made to catch the spotlight.'},
  eveningGown: {name: 'Evening gown', slot: 'top', fame: 3000, fit: 'gown', color: '#9b1b30', perk: ['scandal', 25], note: 'So elegant, the blogs forgive you.'},
  redCarpetTux: {name: 'Red-carpet tux', slot: 'top', fame: 5000, fit: 'suit', color: '#111111', accent: '#d4af37', perk: ['fame', 10], note: 'Every camera finds you.'},
  // Bottoms: trousers, shorts or a skirt.
  jeans: {name: 'Classic jeans', slot: 'bottom', fame: 0, cut: 'trousers', color: '#34435e', note: 'They go with everything.'},
  comfyJoggers: {name: 'Comfy joggers', slot: 'bottom', fame: 60, cut: 'trousers', color: '#555b66', perk: ['energy', 10], note: 'Easier on you: less energy used.'},
  cargoShorts: {name: 'Cargo shorts', slot: 'bottom', fame: 80, cut: 'shorts', color: '#b49a6c', perk: ['hunger', 10], note: 'Pockets full of snacks.'},
  sportShorts: {name: 'Sport shorts', slot: 'bottom', fame: 100, cut: 'shorts', color: '#f2f2ee', perk: ['battle', 3], note: 'Quick on your feet.'},
  ankaraSkirt: {name: 'Ankara skirt', slot: 'bottom', fame: 150, cut: 'skirt', color: '#d9573f', perk: ['social', 10], note: 'Everyone asks where you got it.'},
  swimShorts: {name: 'Swim shorts', slot: 'bottom', fame: 150, cut: 'shorts', color: '#2bb3c0', perk: ['hygiene', 5], note: 'Always ready for a dip.'},
  tailoredTrousers: {name: 'Tailored trousers', slot: 'bottom', fame: 300, cut: 'trousers', color: '#23262e', perk: ['success', 3], note: 'Sharp lines, sharp mind.'},
  pyjamaBottoms: {name: 'Pyjama bottoms', slot: 'bottom', fame: 40, cut: 'trousers', color: '#9fb7d9', perk: ['sleep', 10], note: 'Pairs with the pyjama top.'},
  // Shoes.
  sneakers: {name: 'White sneakers', slot: 'shoes', fame: 0, color: '#f4f1ea', note: 'Fresh out the box.'},
  slides: {name: 'Pool slides', slot: 'shoes', fame: 30, color: '#2b2d42', perk: ['fun', 3], note: 'Maximum chill.'},
  runningShoes: {name: 'Running shoes', slot: 'shoes', fame: 120, color: '#e05a47', perk: ['energy', 5], note: 'Spring in every step.'},
  loafers: {name: 'Leather loafers', slot: 'shoes', fame: 400, color: '#4a2e1f', perk: ['success', 2], note: 'Polished and professional.'},
  goldSneakers: {name: 'Gold sneakers', slot: 'shoes', fame: 4000, color: '#d4af37', perk: ['fame', 5], note: 'Impossible to miss.'},
  // Accessories.
  cap: {name: 'Baseball cap', slot: 'head', fame: 50, color: '#2f6fb3', perk: ['scandal', 10], note: 'A low-key disguise.'},
  headphones: {name: 'Headphones', slot: 'head', fame: 200, color: '#2b2b2b', perk: ['fun', 15], note: 'Your own soundtrack, all day.'},
  fila: {name: 'Fila cap', slot: 'head', fame: 600, color: '#7a2433', perk: ['chat', 3], note: 'Traditional style that elders respect.'},
  gele: {name: 'Gele headwrap', slot: 'head', fame: 800, color: '#c9a227', perk: ['fame', 3], note: 'A crown of fabric for owambe.'},
  glasses: {name: 'Prescription glasses', slot: 'face', fame: 100, color: '#2b2b2b', perk: ['success', 2], note: 'See every detail.'},
  sunglasses: {name: 'Sunglasses', slot: 'face', fame: 150, color: '#14161a', perk: ['scandal', 20], note: 'Fans recognise you less.'},
  beads: {name: 'Coral beads', slot: 'neck', fame: 700, color: '#d2493b', perk: ['chat', 3], note: 'Royal and warm.'},
  chain: {name: 'Gold chain', slot: 'neck', fame: 1000, color: '#d4af37', perk: ['fame', 3], note: 'Flashy, and the fans love it.'},
  studs: {name: 'Gold studs', slot: 'ears', fame: 300, color: '#d4af37', perk: ['fame', 2], note: 'A small sparkle.'},
  watch: {name: 'Luxury watch', slot: 'wrist', fame: 2000, color: '#c9a227', perk: ['success', 3], note: 'Never late for your moment.'},
  handbag: {name: 'Designer handbag', slot: 'bag', fame: 1200, color: '#6b2737', perk: ['hunger', 10], note: 'Room for snacks and lip gloss.'},
};
// Total perks from what someone is wearing, each capped.
export function wearPerks(wear = {}) {
  const totals = {};
  for (const id of Object.values(wear || {})) { const perk = WEAR[id]?.perk; if (perk) totals[perk[0]] = (totals[perk[0]] || 0) + perk[1]; }
  for (const key of Object.keys(totals)) totals[key] = Math.min(totals[key], PERKS[key].cap);
  return totals;
}
// Emotes: short animations anyone nearby can see. `ms` is how long each plays.
export const EMOTES = {
  wave: {label: 'Wave', icon: '👋', ms: 3500},
  dance: {label: 'Dance', icon: '💃', ms: 9000},
  shoki: {label: 'Shoki dance', icon: '🕺', ms: 9000},
  selfie: {label: 'Take a selfie', icon: '🤳', ms: 5000},
  laugh: {label: 'Laugh', icon: '😂', ms: 4000},
  cry: {label: 'Cry', icon: '😢', ms: 5000},
  facepalm: {label: 'Facepalm', icon: '🤦', ms: 3500},
  victory: {label: 'Victory', icon: '🙌', ms: 4000},
  sitFloor: {label: 'Sit on the floor', icon: '🧘', ms: 60_000},
  scroll: {label: 'Scroll on your phone', icon: '📱', ms: 30_000},
};
// Quick reactions in local chat.
export const REACTIONS = ['👍', '😂', '🔥', '❤️', '👏', '😮'];
// Pets: adopt one at Palm plaza. Keep them fed and happy and they give you a perk.
export const PETS = {
  cat: {name: 'Cat', fame: 200, icon: '🐈', perk: ['social', 10], note: 'Naps with you. Social drains slower.'},
  dog: {name: 'Dog', fame: 300, icon: '🐕', perk: ['fun', 15], note: 'Follows you everywhere. Fun drains slower.'},
  parrot: {name: 'Parrot', fame: 600, icon: '🦜', perk: ['chat', 2], note: 'Repeats what you say. More social from chats.'},
};
export const PET_CARE = {decay: {food: 10, joy: 8}, feed: 40, play: 30, cuddle: 12, happy: 30};
// Everything that adjusts the rules for a character: worn perks, a happy pet and home upgrades.
export function perksFor(s) {
  const totals = wearPerks(s?.wear), pet = s?.pet && PETS[s.pet.kind];
  if (s?.fitness >= 1) totals.energy = Math.min((totals.energy || 0) + Math.floor(s.fitness), PERKS.energy.cap);
  if (pet && s.pet.food > PET_CARE.happy && s.pet.joy > PET_CARE.happy) totals[pet.perk[0]] = Math.min((totals[pet.perk[0]] || 0) + pet.perk[1], PERKS[pet.perk[0]].cap);
  return totals;
}
// Home upgrades a character owns, added together ({sleep, sofa, hygiene, insights, generator}).
export function upgradesFor(s) {
  const totals = {};
  for (const key of Object.keys(s?.inventory || {})) { const up = ITEMS[key]?.upgrade; if (up) for (const [k, v] of Object.entries(up)) totals[k] = typeof v === 'number' ? (totals[k] || 0) + v : v; }
  return totals;
}
// Weather and seasons follow real time, the same for everyone. Weather changes every two hours.
const mixHash = n => Math.imul((n + 7) | 0, 2654435761) >>> 0;
export function weatherAt(now) {
  const slot = Math.floor(now / 7_200_000), month = new Date(now).getUTCMonth(), roll = mixHash(slot) % 100;
  if (roll < 22) return 'rain';
  if ([10, 11, 0, 1].includes(month) && roll < 70) return 'harmattan';
  return 'clear';
}
// Festive seasons: Independence week (1–7 October), Detty December, Christmas and New Year.
export function festivalAt(now) {
  const d = new Date(now), m = d.getUTCMonth(), day = d.getUTCDate();
  if (m === 9 && day <= 7) return 'independence';
  if (m === 11 && day >= 20) return 'christmas';
  if (m === 11) return 'detty';
  if (m === 0 && day <= 3) return 'newyear';
  return null;
}
// Go-slow: some minutes the roads jam and drives take longer.
export const goSlowAt = now => mixHash(Math.floor(now / 60_000) + 991) % 100 < 18;
// Random life moments while you play, a few minutes apart. Fame is [share of your fame, minimum].
export const LIFE_EVENT = {firstMs: 4 * 60_000, gapMs: [5 * 60_000, 9 * 60_000], powerCutMs: 3 * 60_000};
export const LIFE_EVENTS = {
  luckyBreak: {icon: '🌟', title: 'Lucky break', text: 'A producer shared your latest post. New fans are pouring in.', fame: [.02, 50], weight: 2},
  fanGift: {icon: '🎁', title: 'A fan sent you a gift', text: 'A tin of chin-chin and a handwritten note. Sweet!', needs: {fun: 10, hunger: 10}, weight: 3},
  sneeze: {icon: '🤧', title: 'You sneezed on a live stream', text: 'Harmless, but it is now a meme with its own remix.', fame: [.005, 10], weight: 2},
  slip: {icon: '🍌', title: 'You slipped and fell', text: 'Right in front of a fan’s camera. Ouch, and the internet saw it.', fame: [-.01, -10], needs: {fun: -10}, weight: 2, where: 'out'},
  wrongName: {icon: '😬', title: 'You called someone the wrong name', text: 'They smiled, but it was awkward for everyone.', needs: {social: -12}, weight: 2},
  wardrobe: {icon: '👔', title: 'Wardrobe malfunction', text: 'A button popped at the worst moment. Fans had jokes.', fame: [-.01, -10], needs: {fun: -5}, weight: 1, where: 'out'},
  lyrics: {icon: '🎤', title: 'You forgot the lyrics', text: 'Mid-song and live. The crowd sang it for you, at least.', fame: [-.01, -10], weight: 2, family: 'music', where: 'out'},
  fanSelfie: {icon: '🤳', title: 'A fan wants a selfie', text: 'They are shaking with excitement.', weight: 3, where: 'out', minFame: 500, prompt: 'fanSelfie', guarded: true},
  journalist: {icon: '📰', title: 'A journalist wants a quote', text: 'About your rival, of course.', weight: 2, minFame: 1000, prompt: 'journalist'},
  paparazzi: {icon: '📸', title: 'Paparazzi spotted you', text: 'Flashes everywhere. Careful: the next ten minutes are on camera.', weight: 2, where: 'out', minFame: 5000, fame: [.003, 10], guarded: true, paps: true},
  rivalHit: {icon: '🥊', title: 'Your rival dropped a hit', text: 'Duke Adeyemi is all over the radio. Time to answer?', weight: 1, minFame: 2000},
  mumCalls: {icon: '📞', title: 'Mum called', text: '"Have you eaten?" You feel loved.', needs: {social: 15}, weight: 2},
  familyVisit: {icon: '👪', title: 'Family came to visit', text: 'Mum is on the sofa with jollof she brought.', needs: {social: 20, hunger: 15}, weight: 1, where: 'home', family: null, visit: true},
  landlord: {icon: '🔑', title: 'The landlord dropped by', text: 'He fixed the leaking tap and told you an hour of gossip.', needs: {social: 5, fun: -5}, weight: 1, where: 'home'},
  powerCut: {icon: '💡', title: 'NEPA took light', text: 'Power cut! No TV, gaming or appliances until it comes back.', weight: 3, where: 'home'},
};
// Choices some life moments ask for. Fame is [share of your fame, minimum]; needs change too.
export const PROMPTS = {
  fanSelfie: {options: [{label: '📸 Smile for the selfie', fame: [.002, 5], needs: {social: 10}, emote: 'selfie', text: 'The fan posted it. Wholesome.'}, {label: '🙅 Not now', needs: {social: -5}, text: 'They walked off, a bit sad.'}]},
  journalist: {options: [{label: '😇 Stay classy', fame: [.004, 10], text: '"We wish everyone well." The blogs called you mature.'}, {label: '🔥 Throw shade', fame: [.01, 25], risk: .45, riskFame: [-.012, -25], text: 'Spicy. The quote is everywhere.', riskText: 'It backfired. Fans called you petty.'}]},
};
// Your rival: a fictional celebrity who keeps you on your toes. Beef with them can win or lose fame.
export const RIVAL = {name: 'Duke Adeyemi', cooldownMs: 30 * 60_000};
// Your team: hire people (free with fame) for lasting help.
export const TEAM = {
  mentor: {name: 'Mentor', icon: '🧑‍🏫', fame: 500, note: 'Skills train 25% faster.'},
  manager: {name: 'Personal manager', icon: '🧑‍💼', fame: 2000, note: 'Books gigs: do the booked activity in time for bonus fame.'},
  bodyguard: {name: 'Bodyguard', icon: '🕶️', fame: 20_000, note: 'Keeps paparazzi and selfie-hunters away; mishaps cost 20% less fame.'},
};
export const GIG = {everyMs: 15 * 60_000, windowMs: 10 * 60_000};
// Home items that need electricity during a power cut (unless you own a generator).
export const POWERED = ['gamingConsole', 'soundSystem', 'coffeeMachine', 'microwave', 'washingMachine', 'ringLight', 'studioMic'];
// Phone apps: deliveries take a minute; groceries make home cooking more filling.
export const DELIVERY_MS = 60_000, GROCERY = {pack: 10, bonus: 15};
// Social feed posts: a little social, and a little fame at most every 10 minutes.
export const POSTS = {cooldownMs: 10 * 60_000, max: 280};
// Things to do at each place. Each fills needs over time; some train a career family or earn a little fame.
export const VENUE_ACTS = {
  dance: {venue: 'nightclub', name: 'Hit the dance floor', icon: '💃', need: 'fun', amount: 40, ms: 60_000, extra: {social: 20, energy: -10}, pose: 'dance'},
  djSet: {venue: 'nightclub', name: 'Play a DJ set', icon: '🎧', need: 'fun', amount: 25, ms: 60_000, extra: {social: 10}, pose: 'perform', family: 'music', learn: 6, fame: 15},
  bar: {venue: 'nightclub', name: 'Chapman at the bar', icon: '🍹', need: 'fun', amount: 12, ms: 20_000, extra: {hunger: 5, social: 5}, pose: 'chat'},
  chill: {venue: 'lounge', name: 'Chill in a booth', icon: '🛋️', need: 'fun', amount: 25, ms: 45_000, extra: {social: 15}, pose: 'sit', seat: .5},
  karaoke: {venue: 'lounge', name: 'Sing karaoke', icon: '🎤', need: 'fun', amount: 30, ms: 45_000, extra: {social: 10}, pose: 'perform', family: 'music', learn: 3},
  network: {venue: 'lounge', name: 'Network with VIPs', icon: '🤝', need: 'social', amount: 25, ms: 40_000, pose: 'gesture', fame: 5},
  film: {venue: 'cinema', name: 'Watch a film', icon: '🎬', need: 'fun', amount: 45, ms: 90_000, extra: {hunger: -5}, pose: 'sit', seat: .5, family: 'acting', learn: 3},
  barber: {venue: 'mall', name: 'Barber & salon', icon: '💈', menu: 'barber'},
  tattoo: {venue: 'mall', name: 'Ink Palm tattoos', icon: '🖋️', menu: 'tattoo'},
  phoneShop: {venue: 'mall', name: 'Phone shop', icon: '📱', menu: 'phones'},
  tailor: {venue: 'market', name: 'Tailor', icon: '🧵', menu: 'tailor'},
  bukka: {venue: 'market', name: 'Eat at the bukka', icon: '🍲', need: 'hunger', amount: 60, ms: 30_000, extra: {social: 5}, pose: 'sit', seat: .45},
  fineDining: {venue: 'lounge', name: 'Fine dining', icon: '🍽️', need: 'hunger', amount: 70, ms: 60_000, extra: {fun: 20, social: 10}, pose: 'sit', seat: .5, minFame: 500},
  shop: {venue: 'mall', name: 'Window-shop', icon: '🛍️', need: 'fun', amount: 20, ms: 30_000, pose: 'chat', page: 'shopping'},
  foodCourt: {venue: 'mall', name: 'Food court meal', icon: '🍔', need: 'hunger', amount: 45, ms: 30_000, extra: {fun: 5}, pose: 'sit', seat: .5},
  interview: {venue: 'tvStation', name: 'TV interview', icon: '🎙️', need: 'social', amount: 15, ms: 45_000, pose: 'gesture', interview: true},
  talkShow: {venue: 'tvStation', name: 'Sit in a talk-show audience', icon: '📺', need: 'fun', amount: 25, ms: 45_000, pose: 'sit', seat: .5},
  airplay: {venue: 'radio', name: 'Get radio airplay', icon: '📻', need: 'social', amount: 10, ms: 40_000, pose: 'perform', family: 'music', fame: 25},
  callIn: {venue: 'radio', name: 'Call-in show', icon: '☎️', need: 'social', amount: 20, ms: 30_000, pose: 'chat'},
  ludo: {venue: 'park', name: 'Play Ludo & Ayo', icon: '🎲', need: 'fun', amount: 25, ms: 40_000, extra: {social: 15}, pose: 'sitFloor'},
  volunteer: {venue: 'hospital', name: 'Volunteer', icon: '🤲', need: 'social', amount: 20, ms: 60_000, extra: {fun: 10, energy: -5}, pose: 'chat', fame: 10, charity: true},
  stalls: {venue: 'market', name: 'Browse the stalls', icon: '🧺', need: 'fun', amount: 15, ms: 30_000, extra: {social: 10}, pose: 'chat', groceries: 5},
  snack: {venue: 'market', name: 'Buy puff-puff', icon: '🍩', need: 'hunger', amount: 20, ms: 15_000, extra: {fun: 5}, pose: 'chat'},
  workout: {venue: 'gym', name: 'Work out', icon: '🏋️', need: 'fun', amount: 15, ms: 45_000, extra: {energy: -12, hygiene: -15}, pose: 'sport', fitness: 1},
  checkup: {venue: 'hospital', name: 'Get a check-up', icon: '🩺', need: 'energy', amount: 50, ms: 60_000, extra: {hunger: 25, hygiene: 20}, pose: 'sit', seat: .55},
  reflect: {venue: 'worship', name: 'Pray and reflect', icon: '🕊️', need: 'fun', amount: 15, ms: 45_000, extra: {social: 20}, pose: 'sit', seat: .48},
  owambe: {venue: 'eventHall', name: 'Party at an owambe', icon: '🎉', need: 'social', amount: 40, ms: 90_000, extra: {fun: 30, hunger: 15}, pose: 'shoki'},
  match: {venue: 'stadium', name: 'Watch a big match', icon: '⚽', need: 'fun', amount: 40, ms: 75_000, extra: {social: 15}, pose: 'victory', family: 'sport', learn: 3},
  jog: {venue: 'park', name: 'Jog round the park', icon: '🏃', need: 'fun', amount: 15, ms: 40_000, extra: {energy: -8}, pose: 'sport', fitness: 1},
  picnic: {venue: 'park', name: 'Picnic on the grass', icon: '🧺', need: 'fun', amount: 20, ms: 40_000, extra: {hunger: 15}, pose: 'sitFloor'},
  yoga: {venue: 'park', name: 'Meditation & yoga', icon: '🧘', need: 'fun', amount: 15, ms: 40_000, extra: {energy: 10}, pose: 'sitFloor'},
  flight: {venue: 'airport', name: 'Fly out for a weekend show', icon: '✈️', need: 'fun', amount: 50, ms: 120_000, extra: {energy: -10}, pose: 'sit', seat: .5, fame: 30},
  swim: {venue: 'beach', name: 'Swim in the lagoon', icon: '🏊', need: 'hygiene', amount: 20, ms: 40_000, extra: {fun: 25, energy: -5}, pose: 'sport'},
  sunbathe: {venue: 'beach', name: 'Relax on the sand', icon: '🏖️', need: 'fun', amount: 30, ms: 45_000, extra: {energy: 5}, pose: 'sitFloor'},
  beachBall: {venue: 'beach', name: 'Beach football', icon: '⚽', need: 'fun', amount: 25, ms: 40_000, extra: {energy: -10, social: 10}, pose: 'sport', family: 'sport', learn: 3},
};
// Shops: tailor colours for your tops, and tattoo spots.
export const TAILOR_COLORS = ['#e05a47', '#e8a23a', '#f2c230', '#2fae6b', '#3d9a7a', '#2f6fb3', '#7b4fa3', '#d9573f', '#111111', '#f4f2ee', '#c9a227', '#9b1b30'];
export const TATTOOS = {arm: 'Upper-arm band', neck: 'Neck script', hand: 'Hand star'};
// Fitness: workouts raise your fitness level, and each level means 1% less energy used (up to 10%).
export const FITNESS = {max: 10, perWorkout: .25};
// The kitchen menu. Each dish fills hunger over `ms` and may lift other needs; some unlock with fame.
export const FOODS = {
  jollof: {name: 'Jollof rice', icon: '🍛', hunger: 60, ms: 90_000, extra: {fun: 5}},
  friedRice: {name: 'Fried rice & chicken', icon: '🍗', hunger: 55, ms: 80_000, extra: {social: 5}},
  poundedYam: {name: 'Pounded yam & egusi', icon: '🥣', hunger: 80, ms: 120_000, extra: {energy: -5}},
  dodo: {name: 'Fried plantain (dodo)', icon: '🍌', hunger: 25, ms: 30_000},
  puffPuff: {name: 'Puff-puff', icon: '🍩', hunger: 15, ms: 20_000, extra: {fun: 5}},
  smoothie: {name: 'Fruit smoothie', icon: '🥤', hunger: 10, ms: 15_000, extra: {energy: 10}},
  zobo: {name: 'Zobo drink', icon: '🍷', hunger: 5, ms: 10_000, extra: {fun: 8}},
  chapman: {name: 'Chapman', icon: '🍹', hunger: 5, ms: 10_000, extra: {fun: 10, social: 5}, fame: 500},
  // Takeaway: order on the Shopping app and eat it when it arrives.
  suya: {name: 'Suya', icon: '🍢', hunger: 35, ms: 25_000, extra: {fun: 8}, takeaway: true},
  shawarma: {name: 'Shawarma', icon: '🌯', hunger: 45, ms: 30_000, extra: {fun: 5}, takeaway: true},
};
// VIP sponsorship deals: free items unlocked by fame, claimed at Palm Motors in Palm plaza.
// Fame is not spent and claimed items stay yours. Brand names are fictional.
export const SPONSORSHIPS = {
  scooter: {name: 'City e-scooter', sponsor: 'Volt Mobility', fame: 100, kind: 'ride', icon: '🛵', color: '#3d9a7a', description: 'Zip between lots in style. Your first sponsor believes in you.'},
  designer: {name: 'Designer look', sponsor: 'Maison Palme', fame: 500, kind: 'style', icon: '🕶️', color: '#1f1f24', description: 'A tailored black-and-gold outfit for red carpets.'},
  coupe: {name: 'Rossa sports coupé', sponsor: 'Rossa Motori', fame: 5_000, kind: 'ride', icon: '🏎️', color: '#c9302c', description: 'Low, loud and very red.'},
  suv: {name: 'Atlas luxury SUV', sponsor: 'Atlas Autos', fame: 20_000, kind: 'ride', icon: '🚙', color: '#23262f', description: 'Tinted windows for when the paparazzi find you.'},
  bicycle: {name: 'City bicycle', sponsor: 'Palm Cycles', fame: 20, kind: 'ride', icon: '🚲', color: '#e05a47', description: 'Free, healthy and never stuck in traffic.'},
  motorbike: {name: 'Kinetic sports motorbike', sponsor: 'Kinetic Moto', fame: 1_500, kind: 'ride', icon: '🏍️', color: '#2b2d42', description: 'Fast, nimble, and it slips through go-slow.'},
  limo: {name: 'Royal limousine', sponsor: 'Royal Limousines', fame: 50_000, kind: 'ride', icon: '🚘', color: '#111111', description: 'Arrive in style: fans notice, and you earn a little fame when you pull up.'},
  yacht: {name: 'Lagoon yacht', sponsor: 'Lagoon Marine', fame: 75_000, kind: 'yacht', icon: '🛥️', color: '#f2f2f0', description: 'Moored by your street. Throw yacht parties on the lagoon.'},
  helicopter: {name: 'SkyPalm helicopter', sponsor: 'SkyPalm Aviation', fame: 250_000, kind: 'ride', icon: '🚁', color: '#d4af37', description: 'Fly straight over the city. No roads, no traffic, no rain delays.'},
  hypercar: {name: 'Vitesse hypercar', sponsor: 'Vitesse', fame: 100_000, kind: 'ride', icon: '🏁', color: '#1d4fa8', description: 'A hand-built hypercar for Icons only. A sponsorship deal, free to claim.'},
  studioFlat: {name: 'Cosy studio flat', sponsor: 'Palm Realty', fame: 0, kind: 'home', icon: '🛏️', color: '#9aa7b3', rest: 1, description: 'A cheap and cheerful starter home with a fresh coat of paint.'},
  duplex: {name: 'Lekki-style duplex', sponsor: 'Palm Realty', fame: 8_000, kind: 'home', icon: '🏘️', color: '#7a5a43', rest: .85, description: 'Two storeys, wood floors and room to grow. Home recovery is 15% faster.'},
  beachHouse: {name: 'Lagoon beach house', sponsor: 'Coastline Estates', fame: 40_000, kind: 'home', icon: '🏖️', color: '#2bb3c0', rest: .75, description: 'Sandy floors and sea breeze. Home recovery is 25% faster.'},
  penthouse: {name: 'Skyline penthouse', sponsor: 'Palm Realty', fame: 60_000, kind: 'home', icon: '🌆', color: '#2f3237', rest: .75, description: 'Dark marble and city views. Home recovery is 25% faster.'},
  studioFlat: {name: 'Cosy studio flat', sponsor: 'Palm Realty', fame: 0, kind: 'home', icon: '🛏️', color: '#9aa7b3', rest: 1, description: 'A cheap and cheerful starter home with a fresh coat of paint.'},
  duplex: {name: 'Lekki-style duplex', sponsor: 'Palm Realty', fame: 8_000, kind: 'home', icon: '🏘️', color: '#7a5a43', rest: .85, description: 'Two storeys, wood floors and room to grow. Home recovery is 15% faster.'},
  beachHouse: {name: 'Lagoon beach house', sponsor: 'Coastline Estates', fame: 40_000, kind: 'home', icon: '🏖️', color: '#2bb3c0', rest: .75, description: 'Sandy floors and sea breeze. Home recovery is 25% faster.'},
  penthouse: {name: 'Skyline penthouse', sponsor: 'Palm Realty', fame: 60_000, kind: 'home', icon: '🌆', color: '#2f3237', rest: .75, description: 'Dark marble and city views. Home recovery is 25% faster.'},
  studioFlat: {name: 'Cosy studio flat', sponsor: 'Palm Realty', fame: 0, kind: 'home', icon: '🛏️', color: '#9aa7b3', rest: 1, description: 'A cheap and cheerful starter home with a fresh coat of paint.'},
  duplex: {name: 'Lekki-style duplex', sponsor: 'Palm Realty', fame: 8_000, kind: 'home', icon: '🏘️', color: '#7a5a43', rest: .85, description: 'Two storeys, wood floors and room to grow. Home recovery is 15% faster.'},
  beachHouse: {name: 'Lagoon beach house', sponsor: 'Coastline Estates', fame: 40_000, kind: 'home', icon: '🏖️', color: '#2bb3c0', rest: .75, description: 'Sandy floors and sea breeze. Home recovery is 25% faster.'},
  penthouse: {name: 'Skyline penthouse', sponsor: 'Palm Realty', fame: 60_000, kind: 'home', icon: '🌆', color: '#2f3237', rest: .75, description: 'Dark marble and city views. Home recovery is 25% faster.'},
  studioFlat: {name: 'Cosy studio flat', sponsor: 'Palm Realty', fame: 0, kind: 'home', icon: '🛏️', color: '#9aa7b3', rest: 1, description: 'A cheap and cheerful starter home with a fresh coat of paint.'},
  duplex: {name: 'Lekki-style duplex', sponsor: 'Palm Realty', fame: 8_000, kind: 'home', icon: '🏘️', color: '#7a5a43', rest: .85, description: 'Two storeys, wood floors and room to grow. Home recovery is 15% faster.'},
  beachHouse: {name: 'Lagoon beach house', sponsor: 'Coastline Estates', fame: 40_000, kind: 'home', icon: '🏖️', color: '#2bb3c0', rest: .75, description: 'Sandy floors and sea breeze. Home recovery is 25% faster.'},
  penthouse: {name: 'Skyline penthouse', sponsor: 'Palm Realty', fame: 60_000, kind: 'home', icon: '🌆', color: '#2f3237', rest: .75, description: 'Dark marble and city views. Home recovery is 25% faster.'},
  townhouse: {name: 'Palm Heights townhouse', sponsor: 'Palm Realty', fame: 2_000, kind: 'home', icon: '🏡', color: '#b86b52', rest: .9, description: 'Warm wood floors and art on the walls. Home recovery 10% faster.'},
  villa: {name: 'Lagoon villa', sponsor: 'Coastline Estates', fame: 25_000, kind: 'home', icon: '🏝️', color: '#3a8fa8', rest: .8, description: 'Marble, sea light and a statement chandelier. Home recovery 20% faster.'},
  mansion: {name: 'Island mansion', sponsor: 'Isle Royale', fame: 150_000, kind: 'home', icon: '🏰', color: '#b8932f', rest: .7, description: 'Gold trim, a grand piano and room for the whole entourage. Home recovery 30% faster.'},
};
// Travel follows the roads. Walking takes BALANCE.walkMsPerBlock per 16-unit block, never more than
// BALANCE.walkCapMs; every ride is a fraction of the walking time. Home and its street are next door.
// Walkers keep to the sidewalk; cars drive in a lane.
// Walking is the slowest way around; the street outside your door shares your home's lot.
export const RIDE_SPEED = {walk: 1, bicycle: .85, scooter: .75, keke: .75, danfo: .7, hatchback: .65, taxi: .6, suv: .55, okada: .55, coupe: .5, motorbike: .5, limo: .5, hypercar: .35, helicopter: .15};
// Public transport anyone can take. Ride-hailing is booked with a smartphone.
export const TRANSIT = {
  danfo: {name: 'Danfo bus', icon: '🚌', color: '#f2c230', note: 'Cheap and cheerful, a bit slower.'},
  keke: {name: 'Keke', icon: '🛺', color: '#f2c230', note: 'Handy for short hops.'},
  okada: {name: 'Okada', icon: '🏍️', color: '#b23a48', note: 'Fastest through go-slow traffic.'},
  taxi: {name: 'Ride-hailing', icon: '🚕', color: '#2fae6b', note: 'Booked on your smartphone.'},
};
// Rides that dodge go-slow traffic, or rain delays.
export const NO_JAM = ['walk', 'bicycle', 'okada', 'motorbike', 'helicopter'], NO_RAIN = ['helicopter'];
// Tuning at Palm Motors: each level makes trips in your own ride a little shorter.
export const TUNING = [{fame: 1_000, cut: 5}, {fame: 5_000, cut: 10}, {fame: 20_000, cut: 15}];
// Best-start characters begin with a family car; sponsored rides come from fame.
export const STARTER_RIDE = 'hatchback';
export const LOT = location => location === 'street' ? 'home' : location;
export const arrivalSpot = location => location === 'street' ? {x: 0, z: 6.2} : {x: 0, z: 1};
export function route(from, to, mode = 'walk') {
  // Helicopters fly straight from door to door.
  if (LOT(from) === 'beach' || LOT(to) === 'beach') {
    if (LOT(from) === LOT(to)) return [{x: 0, z: 27}, {x: 0, z: 27}];
    const other = LOT(from) === 'beach' ? to : from, o = TOWN[LOT(other)], door = LOT(other) === 'home' ? {x: o.x, z: o.z + 6.2} : {x: o.x, z: o.z}, edge = mode === 'walk' ? 1.9 : .75, road = o.z + 8 - edge;
    const points = [door, {x: o.x, z: road}, ...(o.z < 0 ? [{x: 8 - edge, z: road}, {x: 8 - edge, z: 8 - edge}] : []), {x: 0, z: 8 - edge}, {x: 0, z: 22}, {x: 0, z: 27}];
    return LOT(from) === 'beach' ? points.reverse() : points;
  }
  if (mode === 'fly') { const door = (key, lot) => LOT(key) === 'home' ? {x: lot.x, z: lot.z + 6.2} : {x: lot.x, z: lot.z}; return [door(from, TOWN[LOT(from)]), door(to, TOWN[LOT(to)])]; }
  // Homes are entered and left by the front door on the street; venues are walked into.
  const edge = mode === 'walk' ? 1.9 : .75, a = TOWN[LOT(from)], b = TOWN[LOT(to)], road = lot => lot.z + 8 - edge, door = (key, lot) => LOT(key) === 'home' ? {x: lot.x, z: lot.z + 6.2} : {x: lot.x, z: lot.z};
  const points = [door(from, a), {x: a.x, z: road(a)}];
  if (road(a) !== road(b)) { const side = a.x + (b.x >= a.x ? 8 - edge : edge - 8); points.push({x: side, z: road(a)}, {x: side, z: road(b)}); }
  points.push({x: b.x, z: road(b)}, door(to, b));
  return points;
}
export const routeLength = points => points.slice(1).reduce((n, p, i) => n + Math.abs(p.x - points[i].x) + Math.abs(p.z - points[i].z), 0);
export const tripMs = (from, to, ride = 'walk') => Math.round(Math.min(BALANCE.walkCapMs, routeLength(route(from, to)) / 16 * BALANCE.walkMsPerBlock) * (RIDE_SPEED[ride] ?? 1));
export function along(points, f) {
  const total = routeLength(points); let left = Math.max(0, Math.min(1, f)) * total;
  for (let i = 1; i < points.length; i++) { const a = points[i - 1], b = points[i], d = Math.abs(b.x - a.x) + Math.abs(b.z - a.z);
    if (left <= d || i === points.length - 1) { const t = d ? Math.min(1, left / d) : 1; return {x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, axis: b.x !== a.x ? 'x' : 'z', heading: Math.atan2(b.x - a.x, b.z - a.z)}; }
    left -= d; }
  return {...points.at(-1), axis: 'z', heading: 0};
}
// Your phone holds every menu. Better models unlock with fame (free, never spent).
export const PHONES = {
  // lag: [min, max] ms before an app opens; hang: chance of an "isn't responding" dialog.
  basic: {name: 'Starter phone', fame: 0, color: '#3b4a42', screen: '#f4f7f1', perk: 'Gets you by. Slow to open apps and sometimes freezes.', network: 'E', battery: 23, lag: [900, 2000], hang: .14, nag: .35},
  smart: {name: 'Glow smartphone', fame: 300, color: '#2f6fb3', screen: '#eef5fc', perk: 'Smoother, colourful, shows friends online. The odd stutter.', network: '4G', battery: 61, lag: [250, 650], hang: .03, nag: 0},
  pro: {name: 'Pro edition', fame: 5_000, color: '#7b4fa3', screen: '#f5effa', perk: 'Flagship feel: big clock, dock, next unlock widget. Smooth.', network: '5G', battery: 88, lag: [0, 0], hang: 0, nag: 0},
  gold: {name: 'Gold edition', fame: 50_000, color: '#b8932f', screen: '#fbf6e8', perk: 'Premium gold, glass icons, instant. Everyone notices.', network: '5G', battery: 100, lag: [0, 0], hang: 0, nag: 0},
};
// Watching TV can teach your career a little. One insight per WATCH_COOLDOWN; longer watching teaches more.
export const WATCH = {
  sport: {title: 'Watch the big match', label: 'Watching the big match', hero: 'That number 24 guy'},
  music: {title: 'Watch a live concert', label: 'Watching a concert', hero: 'The headliner'},
  acting: {title: 'Watch a movie', label: 'Watching a movie', hero: 'The lead actor'},
  creator: {title: 'Binge top creators', label: 'Binge-watching creators', hero: 'That creator'},
  tech: {title: 'Watch a tech keynote', label: 'Watching a keynote', hero: 'The keynote speaker'},
};
// First insight after 10s of watching, then one every 30s, five at most (+1 point each). A session that
// teaches anything starts a 20-minute cooldown; watching during it is just for fun. Sessions run 2:20.
export const WATCH_COOLDOWN = 20 * 60_000, WATCH_FIRST = 10_000, WATCH_EVERY = 30_000, WATCH_MAX = 5, WATCH_SESSION = 140_000;
const INSIGHTS = {
  dribbling: 'That number 24 guy glided past three defenders. You learnt to dribble a little better.',
  shooting: 'Their striker buried one from 25 metres. Your shooting clicked a little more.',
  passing: 'The playmaker found impossible angles. You see passing lanes a bit better now.',
  defending: 'The centre-back read every run. You learnt to anticipate attackers.',
  handling: 'Their point guard’s crossover was unreal. Your ball handling improved.',
  serve: 'Ace after ace. You noticed how they tossed the ball and your serve got sharper.',
  forehand: 'That inside-out forehand was textbook. Yours feels a little crisper.',
  backhand: 'One-handed backhand down the line. You picked up the timing.',
  footwork: 'Never off balance once. You learnt to move your feet better.',
  strength: 'Pure power in that slam. You understand leverage a little better.',
  stamina: 'Still fighting in the final minute. You learnt to pace yourself.',
  acting: 'You learnt from the main actor’s abilities. You now understand the importance of emotion in acting.',
  expression: 'The close-ups showed how much a face can say without words. Your expression improved.',
  improvisation: 'That unscripted moment felt so real. You learnt to trust your instincts.',
  charisma: 'The star owned every room. You picked up a little of that presence.',
  songwriting: 'The bridge in that ballad gave you chills. Your songwriting grew.',
  'stage presence': 'The headliner had 50,000 people in the palm of their hand. You learnt to own a stage.',
  production: 'That mix was so clean. You noticed tricks for your own production.',
  storytelling: 'Every cut moved the story forward. Your storytelling sharpened.',
  editing: 'Tight cuts, no wasted seconds. You learnt to edit with intent.',
  comedy: 'The timing on that punchline was perfect. You got a little funnier.',
  timing: 'A pause, then the laugh. You understand comic timing better.',
  engagement: 'They answered chat like old friends. You learnt to engage your audience.',
  presentation: 'Calm, clear, confident. Your presentation improved.',
  'product judgement': 'One feature, done brilliantly. Your product judgement grew.',
  leadership: 'The founder rallied the room. You learnt a little about leading.',
  coding: 'The live demo wrote itself. You picked up a cleaner way to code.',
  deception: 'Nobody saw the twist coming. You learnt how misdirection works (in fiction).',
  planning: 'Every step of the plan clicked into place. Your planning improved.',
};
export const insightFor = (family, skill) => INSIGHTS[skill] || `${WATCH[family]?.hero || 'Someone on screen'} was brilliant. You learnt a little more about ${skill}.`;
export const RIDES = {hatchback: {name: 'Family hatchback', icon: '🚗', color: '#5f8f8a'}, ...Object.fromEntries(Object.entries(SPONSORSHIPS).filter(([, d]) => d.kind === 'ride'))};
// Talking to an NPC is instant: a short chat, a line of dialogue and a little social boost per cool-off.
// Character looks: a fixed set of skin tones, hairstyles, hair colours and body shapes.
export const SKIN_TONES = ['#f6d9c5', '#ecc3a2', '#dba67f', '#c98d64', '#ad7350', '#8d5b3d', '#6e442e', '#4b2e20'];
export const HAIRSTYLES = {curls: 'Soft curls', short: 'Short crop', afro: 'Afro', braids: 'Box braids', locs: 'Locs', bun: 'Top bun', ponytail: 'Ponytail', long: 'Long & straight', bob: 'Bob', buzz: 'Buzz cut', fade: 'Fade', cornrows: 'Cornrows', bald: 'Bald'};
export const HAIR_COLORS = {black: '#1d1714', brown: '#5a3a26', auburn: '#8a3b22', blonde: '#d8b46a', grey: '#a9a6a1', pink: '#d97aa6'};
export const BUILDS = {slim: {name: 'Slim', w: .86, hip: .92}, average: {name: 'Average', w: 1, hip: 1}, athletic: {name: 'Athletic', w: 1.08, hip: .98, shoulders: 1.18}, curvy: {name: 'Curvy', w: 1.04, hip: 1.25}, heavy: {name: 'Heavy', w: 1.3, hip: 1.25}};
export const HEIGHTS = {short: {name: 'Short', h: .9}, average: {name: 'Average', h: 1}, tall: {name: 'Tall', h: 1.1}};
export const pick = (table, value, fallback) => Object.hasOwn(table, value) ? value : fallback;
// When a need runs critically low the character does something embarrassing in public: fans catch it
// and fame drops. Each need can only cause one mishap per cooldown, and some mishaps reset the need.
export const MISHAP = {at: 5, cooldownMs: 10 * 60_000, gapMs: 2 * 60_000, minFame: 10};
export const MISHAPS = {
  bladder: {icon: '💦', title: 'You peed on yourself', text: 'Fans caught it on camera and roasted you online.', fame: .03, set: {bladder: 100, hygiene: 10}},
  hunger: {icon: '😵', title: 'You fainted from hunger', text: 'In public, too. Blogs are calling it a “diva hunger strike”.', fame: .02, set: {hunger: 20}},
  energy: {icon: '💤', title: 'You fell asleep standing up', text: 'Right in the middle of a conversation. Fans turned it into a meme.', fame: .02, set: {energy: 15}},
  hygiene: {icon: '🤢', title: 'Your body odour cleared the room', text: 'A fan’s post went viral: “smells like failure”.', fame: .02, set: {}},
  fun: {icon: '📱', title: 'You posted a cringe 3am rant', text: 'Bored out of your mind, you went live. Fans unfollowed in droves.', fame: .015, set: {fun: 20}},
  social: {icon: '🪴', title: 'You livestreamed a chat with your houseplant', text: 'Lonely and talking to a fern. Fans are worried about you.', fame: .015, set: {social: 15}},
};
export const NPC_TALK = {social: 10, cooldownMs: 45_000, lines: ['Big things are coming for you, I can feel it.', 'Saw your last post. You’re getting better!', 'This city never sleeps, eh?', 'Keep practising. People are starting to notice.', 'Have you been to Palm Motors? Those cars, ehn!', 'Don’t forget to rest. Burnout is real.', 'You know who you should meet? Everybody!', 'Fame is a marathon, not a sprint.']};
// Key NPCs always look the same so players recognise them; background people get random looks.
export const NPCS = [
  {id:'nova', name:'Nova', career:'musician', location:'studio', role:'Producer', color:'#b4a7d9', look:{skin:'#8d5b3d', hair:'locs', hairColor:'black', build:'average', height:'tall'}},
  {id:'kai', name:'Kai', career:'football', location:'sports', role:'Scout', color:'#88bda5', look:{skin:'#c98d64', hair:'fade', hairColor:'black', build:'athletic', height:'average'}},
  {id:'mika', name:'Mika', career:'vlogger', location:'plaza', role:'Creator', color:'#e0a28f', look:{skin:'#ecc3a2', hair:'bun', hairColor:'pink', build:'slim', height:'short'}},
  {id:'ari', name:'Ari', career:'founder', location:'tech', role:'Builder', color:'#85b9ca', look:{skin:'#6e442e', hair:'short', hairColor:'black', build:'heavy', height:'average'}},
  {id:'sola', name:'Sola', career:'actor', location:'creator', role:'Director', color:'#d4a373', look:{skin:'#ad7350', hair:'bald', hairColor:'black', build:'average', height:'tall'}},
];
export const clamp = (value, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, value));
export const effort = (level, base = 35) => level <= 4 ? base * level : 4 * base * 2 ** (level - 4);
export function obstacles(location, furniture=[]) {
  const rects={
    home:[[-2.8,-4,4.2,1],[-.7,-4.25,.8,.9],[.5,-4.2,1.3,.8],[2.5,-3.5,1.95,2.5],[4.1,-4,.7,.65],[-3.6,1.5,1.2,3.2],[-1.7,1.5,1.2,1.5],[-2.8,4.4,2.9,.65],[4.1,3.2,.6,1.1],[2.55,2.7,.13,3.7],[.5,3,1.5,1.5],[.5,2.1,.7,.7],[.5,3.9,.7,.7]],
    sports:[[-4.1,-3.6,1.9,2.2],[4.3,0,.9,5]],
    studio:[[-2.2,-3.3,3.6,1.35],[-2.2,-1.9,.6,.6],[-.7,3.5,2.2,1],[0,2.2,1.3,.9]],
    creator:[[-2.2,-3.3,3.6,1.35],[-2.2,-1.9,.6,.6],[-.7,3.5,2.2,1],[0,2.2,1.3,.9]],
    tech:[[-2.2,-3.3,3.6,1.35],[-2.2,-1.9,.6,.6],[-.7,3.5,2.2,1],[0,2.2,1.3,.9]],
    nightclub:[[0,-3.9,2.7,1.1],[-4.3,0,1.2,3.6],[-2,-4.2,.7,.7],[2,-4.2,.7,.7]],
    lounge:[[-3,2.85,2.2,1.2],[3,2.85,2.2,1.2],[0,-3.8,3,1.4],[3.9,-2,1.2,3.2]],
    cinema:[[0,.4,6.7,.7],[0,2.8,6.7,.7],[0,4,6.7,.7],[-4.6,3,.6,1]],
    mall:[[-3.4,-4.6,2.8,.6],[0,-4.6,2.8,.6],[3.4,-4.6,2.8,.6],[-3.6,2.8,2.4,1.2],[1.6,2,.9,.9],[3.2,2,.9,.9],[1.6,3.5,.9,.9],[3.2,3.5,.9,.9]],
    tvStation:[[-1,-3.4,1.4,.6],[0,2.6,7,.7],[0,3.4,7,.7],[0,4.2,7,.7]],
    radio:[[0,-4.2,4,1],[3.6,2.6,1.6,.8]],
    market:[[-3.4,-3,2.2,1.2],[0,-3,2.2,1.2],[3.4,-3,2.2,1.2],[-3.4,1,2.2,1.2],[0,1.2,2.2,1.2],[3.4,1,2.2,1.2],[3,3,1.2,.8]],
    gym:[[-3.6,-3.6,.7,1.4],[-1.8,-3.6,.7,1.4],[0,-3.6,.7,1.4],[1.8,-3.6,.7,1.4],[3.6,-3.6,.7,1.4]],
    hospital:[[-2.6,-3.6,1,1.9],[0,-3.6,1,1.9],[-3,2.5,2.8,1]],
    worship:[[-2.4,-1.4,3,.6],[2.4,-1.4,3,.6],[-2.4,0,3,.6],[2.4,0,3,.6],[-2.4,1.4,3,.6],[2.4,2.8,3,.6],[-2.4,2.8,3,.6],[0,-4.4,2.5,1.1]],
    eventHall:[[-3.5,-2,1.3,1.3],[3.5,-2,1.3,1.3],[-3.5,2,1.3,1.3],[3.5,2,1.3,1.3],[0,3.6,1.3,1.3],[0,-4.4,5,1.2]],
    stadium:[[-4.95,0,1.4,9.5],[4.95,0,1.4,9.5]],
    park:[[-2.4,1.2,3.6,1.8],[0,3.5,1.6,.5]],
    airport:[[-3.6,-3,1.8,.7],[-1.4,-3,1.8,.7],[0,.8,5.7,.6],[0,2,5.7,.6]],
    beach:[[0,4.4,11,2.4]],
    plaza:[[-3.1,-3.3,3.2,2.35],[3.1,-3.3,3.2,2.35],[-3,2.4,2,.75],[2.7,1.8,1.1,1.1],[3.3,3.9,2.4,1.3]],
  }[location]||[];
  return [...rects,...(location==='home'?furniture.map(f=>[f.x,f.z,.85,.85]):[])];
}
export function walkable(location,x,z,furniture=[]){
  if(location==='street')return Number.isFinite(x)&&Number.isFinite(z)&&Math.abs(x)<=7&&z>=5.7&&z<=7.3;
  return Number.isFinite(x)&&Number.isFinite(z)&&Math.abs(x)<=4.8&&Math.abs(z)<=4.8&&!obstacles(location,furniture).some(([cx,cz,w,d])=>Math.abs(x-cx)<w/2+.16&&Math.abs(z-cz)<d/2+.16);
}
export function canPlace(furniture,item,x,z){
  // The bottom half of the apartment is permanently kept open for access.
  return Number.isInteger(x)&&Number.isInteger(z)&&x>=-3&&x<=3&&z>=-3&&z<=0&&walkable('home',x,z,furniture.filter(f=>f.item!==item))&&![[-2.2,-4,4.3,1.3],[2.5,-3.5,2.5,3]].some(([cx,cz,w,d])=>Math.abs(x-cx)<w/2+.45&&Math.abs(z-cz)<d/2+.45);
}
