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
  plaza: {name: 'Palm plaza', subtitle: 'Meet the city. Find your people.', icon: '◈', color: '#c3c48c'},
  street: {name: 'Your street', subtitle: 'Step out into Palm City', icon: '🚪', color: '#c9d6bf'},
};
// Every location is an 11×11 lot in one open neighbourhood; x/z are lot centres in world units.
export const TOWN = {
  home: {x: -16, z: 0, pin: '🏠', height: 4.5}, plaza: {x: 0, z: 0, pin: '🛍️', height: 2.6}, studio: {x: 16, z: 0, pin: '🎙️', height: 3.9},
  sports: {x: -16, z: -16, pin: '🏟️', height: 2.4}, creator: {x: 0, z: -16, pin: '🎬', height: 3.3}, tech: {x: 16, z: -16, pin: '💡', height: 7.6},
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
  bookshelf: {name: 'Bookshelf', fame: 100, description: 'Read a good book to unwind.', furniture: true, use: {verb: 'Read a book', icon: '📖', need: 'fun', amount: 20, ms: 40_000, pose: 'chat'}},
  microwave: {name: 'Microwave', fame: 120, description: 'A fast, so-so meal when you are in a rush.', furniture: true, use: {verb: 'Quick meal', icon: '🍱', need: 'hunger', amount: 25, ms: 15_000, pose: 'chat'}},
  coffeeMachine: {name: 'Coffee machine', fame: 150, description: 'A quick energy boost.', furniture: true, use: {verb: 'Make coffee', icon: '☕', need: 'energy', amount: 20, ms: 20_000, pose: 'chat'}},
  washingMachine: {name: 'Washing machine', fame: 250, description: 'Fresh clothes keep you clean.', furniture: true, use: {verb: 'Do laundry', icon: '🧺', need: 'hygiene', amount: 20, ms: 30_000, pose: 'chat'}},
  dressingTable: {name: 'Dressing table', fame: 300, description: 'Groom and get ready for the day.', furniture: true, use: {verb: 'Get ready', icon: '💄', need: 'hygiene', amount: 30, ms: 30_000, pose: 'work', seat: .52}},
  gamingConsole: {name: 'Gaming console', fame: 400, description: 'Big fun, a little tiring.', furniture: true, use: {verb: 'Play games', icon: '🎮', need: 'fun', amount: 40, ms: 60_000, pose: 'work', seat: .4, extra: {energy: -5}}},
  soundSystem: {name: 'Sound system', fame: 500, description: 'Turn it up and dance.', furniture: true, use: {verb: 'Dance', icon: '🔊', need: 'fun', amount: 35, ms: 45_000, pose: 'perform', extra: {energy: -5}}},
  aquarium: {name: 'Aquarium', fame: 600, description: 'Calming fish to watch.', furniture: true, use: {verb: 'Watch the fish', icon: '🐠', need: 'fun', amount: 12, ms: 20_000, pose: null}},
  treadmill: {name: 'Treadmill', fame: 800, description: 'Run at home: fun, but sweaty and tiring.', furniture: true, use: {verb: 'Run', icon: '🏃', need: 'fun', amount: 20, ms: 40_000, pose: 'sport', onItem: true, extra: {energy: -10, hygiene: -15}}},
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
};
// VIP sponsorship deals: free items unlocked by fame, claimed at Palm Motors in Palm plaza.
// Fame is not spent and claimed items stay yours. Brand names are fictional.
export const SPONSORSHIPS = {
  scooter: {name: 'City e-scooter', sponsor: 'Volt Mobility', fame: 100, kind: 'ride', icon: '🛵', color: '#3d9a7a', description: 'Zip between lots in style. Your first sponsor believes in you.'},
  designer: {name: 'Designer look', sponsor: 'Maison Palme', fame: 500, kind: 'style', icon: '🕶️', color: '#1f1f24', description: 'A tailored black-and-gold outfit for red carpets.'},
  coupe: {name: 'Rossa sports coupé', sponsor: 'Rossa Motori', fame: 5_000, kind: 'ride', icon: '🏎️', color: '#c9302c', description: 'Low, loud and very red.'},
  suv: {name: 'Atlas luxury SUV', sponsor: 'Atlas Autos', fame: 20_000, kind: 'ride', icon: '🚙', color: '#23262f', description: 'Tinted windows for when the paparazzi find you.'},
  hypercar: {name: 'Vitesse hypercar', sponsor: 'Vitesse', fame: 100_000, kind: 'ride', icon: '🏁', color: '#1d4fa8', description: 'A hand-built hypercar for Icons only. A sponsorship deal, free to claim.'},
  townhouse: {name: 'Palm Heights townhouse', sponsor: 'Palm Realty', fame: 2_000, kind: 'home', icon: '🏡', color: '#b86b52', rest: .9, description: 'Warm wood floors and art on the walls. Home recovery 10% faster.'},
  villa: {name: 'Lagoon villa', sponsor: 'Coastline Estates', fame: 25_000, kind: 'home', icon: '🏝️', color: '#3a8fa8', rest: .8, description: 'Marble, sea light and a statement chandelier. Home recovery 20% faster.'},
  mansion: {name: 'Island mansion', sponsor: 'Isle Royale', fame: 150_000, kind: 'home', icon: '🏰', color: '#b8932f', rest: .7, description: 'Gold trim, a grand piano and room for the whole entourage. Home recovery 30% faster.'},
};
// Travel follows the roads. Walking takes BALANCE.walkMsPerBlock per 16-unit block, never more than
// BALANCE.walkCapMs; every ride is a fraction of the walking time. Home and its street are next door.
// Walkers keep to the sidewalk; cars drive in a lane.
// Walking is the slowest way around; the street outside your door shares your home's lot.
export const RIDE_SPEED = {walk: 1, scooter: .75, hatchback: .65, suv: .55, coupe: .5, hypercar: .35};
// Best-start characters begin with a family car; sponsored rides come from fame.
export const STARTER_RIDE = 'hatchback';
export const LOT = location => location === 'street' ? 'home' : location;
export const arrivalSpot = location => location === 'street' ? {x: 0, z: 6.2} : {x: 0, z: 1};
export function route(from, to, mode = 'walk') {
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
