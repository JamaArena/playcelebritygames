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
export const UMBRELLAS = {sport: 'Sports', creator: 'Content creation', music: 'Entertainment', acting: 'Entertainment', tech: 'Technology', risk: 'Technology'};
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
  hacker: career('Fraudster', '⌁', 'risk', ['technical skill', 'deception', 'planning', 'risk judgement'], ['Small-time hustler', 'Crew recruit'], 'tech', 'Operation', ['Choose a route through an invented simulation.', 'An invented complication raises exposure.', 'Decide whether to complete the simulation or stop.']),
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
  risk: {title: 'Watch a heist movie', label: 'Watching a heist movie', hero: 'The film’s mastermind'},
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
export const NPC_TALK = {social: 10, cooldownMs: 45_000, lines: ['Big things are coming for you, I can feel it.', 'Saw your last post. You’re getting better!', 'This city never sleeps, eh?', 'Keep practising. People are starting to notice.', 'Have you been to Palm Motors? Those cars, ehn!', 'Don’t forget to rest. Burnout is real.', 'You know who you should meet? Everybody!', 'Fame is a marathon, not a sprint.']};
export const NPCS = [
  {id:'nova', name:'Nova', career:'musician', location:'studio', role:'Producer', color:'#b4a7d9'},
  {id:'kai', name:'Kai', career:'football', location:'sports', role:'Scout', color:'#88bda5'},
  {id:'mika', name:'Mika', career:'vlogger', location:'plaza', role:'Creator', color:'#e0a28f'},
  {id:'ari', name:'Ari', career:'founder', location:'tech', role:'Builder', color:'#85b9ca'},
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
