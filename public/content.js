// PRD proposals are centralized here; confirmed progression and charge rules are shared.
export const BALANCE = {
  capacity: 10, refillMs: 36 * 60_000, practiceMs: 3 * 60_000,
  recovery: { hunger: [40, 60_000], energy: [60, 300_000], fun: [30, 120_000], social: [30, 120_000], hygiene: [50, 60_000], bladder: [80, 30_000] },
  decay: { hunger: 12, energy: 8, fun: 6, social: 6, hygiene: 8, bladder: 15 },
  activityMs: 120_000, sportMs: 300_000, upgradeMs: 30 * 60_000,
  reaches: [100, 500, 2000, 10000], fees: [50, 250, 1000, 5000],
  tiers: [['Newcomer', 0, 1], ['Emerging', 100, 2], ['Established', 1000, 4], ['Star', 10000, 6], ['Icon', 100000, 8]],
  milestones: [100, 1000, 10000, 100000], seasonMs: 28 * 86400_000,
};
const career = (name, icon, family, skills, origins, location, output, beats, focus = skills[0]) => ({name, icon, family, skills, origins, location, output, beats, focus, audience: family === 'tech' ? 'users' : family === 'creator' ? 'subscribers' : 'fans'});
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
  adult: career('Adult entertainment', '◆', 'acting', ['performance', 'presentation', 'production', 'business'], ['Independent adult creator', 'Adult studio newcomer'], 'studio', 'Project', ['Agree on project terms and boundaries.', 'Choose the presentation for an abstract project.', 'Resolve a production scheduling issue.'], 'performance'),
  founder: career('Founder', '⬡', 'tech', ['product judgement', 'leadership', 'sales', 'finance'], ['Bootstrapped founder', 'Mentored builder'], 'tech', 'Product', ['Choose a feature after customer feedback.', 'Allocate a limited production budget.', 'Resolve a problem before delivery.']),
  developer: career('Developer', '⌘', 'tech', ['coding', 'debugging', 'architecture', 'communication'], ['Self-taught freelancer', 'Mentored coding prodigy'], 'tech', 'Client project', ['Inspect a fictional bug in the client project.', 'Choose a repair that preserves stability.', 'Communicate a delivery tradeoff.']),
  web3: career('Web3 builder', '⬢', 'tech', ['product', 'community', 'research', 'technical skill'], ['Independent newcomer', 'Community-connected talent'], 'tech', 'Product', ['Pick a useful fictional product direction.', 'Respond to community concerns.', 'Handle a launch-readiness decision.']),
  hacker: career('Fictional operator', '⌁', 'risk', ['technical skill', 'deception', 'planning', 'risk judgement'], ['Underground newcomer', 'Fictional crew recruit'], 'tech', 'Operation', ['Choose a route through an invented simulation.', 'An invented complication raises exposure.', 'Decide whether to complete the simulation or stop.']),
};
export const LOCATIONS = {
  home: {name: 'Your apartment', subtitle: 'A little room for big dreams', icon: '⌂', color: '#edc594'},
  sports: {name: 'Arena district', subtitle: 'Leave it all on the pitch', icon: '⚽', color: '#88bda5'},
  studio: {name: 'Sound & screen', subtitle: 'Where your next chapter gets made', icon: '♫', color: '#b4a7d9'},
  creator: {name: 'Creator quarter', subtitle: 'Make something worth sharing', icon: '▷', color: '#e0a28f'},
  tech: {name: 'Innovation hub', subtitle: 'Start small. Build something lasting.', icon: '⌘', color: '#85b9ca'},
  plaza: {name: 'Palm plaza', subtitle: 'Meet the city. Find your people.', icon: '◈', color: '#c3c48c'},
};
// Every location is an 11×11 lot in one open neighbourhood; x/z are lot centres in world units.
export const TOWN = {
  home: {x: -16, z: 0, pin: '🏠', height: 4.5}, plaza: {x: 0, z: 0, pin: '🛍️', height: 2.6}, studio: {x: 16, z: 0, pin: '🎙️', height: 3.9},
  sports: {x: -16, z: -16, pin: '🏟️', height: 2.4}, creator: {x: 0, z: -16, pin: '🎬', height: 3.3}, tech: {x: 16, z: -16, pin: '💡', height: 7.6},
};
export const lotAt = (x, z) => Object.keys(TOWN).find(key => Math.abs(x - TOWN[key].x) <= 5.5 && Math.abs(z - TOWN[key].z) <= 5.5);
export const ITEMS = {
  food: {name: 'Fresh groceries', price: 15, description: 'One meal. Restores 40 hunger after eating.'},
  gear: {name: 'Career equipment', price: 150, description: 'Practice at home. Production quality +5 per level above 1.', upgradable: true, slot: 'gear'},
  jacket: {name: 'Signature jacket', price: 75, description: 'An emerald layer for your everyday look.', slot: 'clothes'},
  chair: {name: 'Lounge chair', price: 80, description: 'Place it in a free apartment position.', furniture: true},
  trophyShelf: {name: 'Award shelf', price: 100, description: 'A place for the milestones you earn.', furniture: true},
};
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
    plaza:[[-3.1,-3.3,3.2,2.35],[3.1,-3.3,3.2,2.35],[-3,2.4,2,.75],[2.7,1.8,1.1,1.1]],
  }[location]||[];
  return [...rects,...(location==='home'?furniture.map(f=>[f.x,f.z,.85,.85]):[])];
}
export function walkable(location,x,z,furniture=[]){
  return Number.isFinite(x)&&Number.isFinite(z)&&Math.abs(x)<=4.8&&Math.abs(z)<=4.8&&!obstacles(location,furniture).some(([cx,cz,w,d])=>Math.abs(x-cx)<w/2+.16&&Math.abs(z-cz)<d/2+.16);
}
export function canPlace(furniture,item,x,z){
  // The bottom half of the apartment is permanently kept open for access.
  return Number.isInteger(x)&&Number.isInteger(z)&&x>=-3&&x<=3&&z>=-3&&z<=0&&walkable('home',x,z,furniture.filter(f=>f.item!==item))&&![[-2.2,-4,4.3,1.3],[2.5,-3.5,2.5,3]].some(([cx,cz,w,d])=>Math.abs(x-cx)<w/2+.45&&Math.abs(z-cz)<d/2+.45);
}
