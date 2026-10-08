// Football match moves, shared by the 3D pitch (world.js) and the app. Pitch units: x 0–100 along the length
// (Blue attack x=100), y 0–64 across. Each decision replays as a short script of frames for six actors and the ball,
// told by what really happened: a goal only when the score changed, saves and misses otherwise.
export const FORMATION=[[5,32],[20,9],[20,24],[20,40],[20,55],[38,9],[38,24],[38,40],[38,55],[52,25],[52,39]];
// The six actors mapped onto formation slots: you up front, a winger, the keepers, two red centre-backs.
export const ACTOR_SLOT={A1:['A',9],A2:['A',5],AK:['A',0],BK:['B',0],B1:['B',2],B2:['B',3]};
export const REPLAY_NAMES={blue:['Emeka','Bayo'],red:['Duke','Musa']};
// Pitch units to the 3D pitch: Blue attack the white board at z −4.1, Red the one at z +4.1.
export const toPitch=(x,y)=>({x:(y-32)/32*2.9,z:4-x/100*8});

export function replayScript(choice,success,blueGoal,redGoal,me,result=''){
  const mate=REPLAY_NAMES.blue[choice.target==='striker'?1:0],[r1]=REPLAY_NAMES.red;
  const start={A1:[45,32],A2:[56,14],AK:[5,32],B1:[63,30],B2:[70,46],BK:[95,32]};
  const f=(t,pos,ball,text)=>({t,pos,ball,text});const at=(o,p)=>({...start,...o,...p});
  const miss=result==='Wide'||result==='Blocked'?'wide':result==='Saved'?'save':Math.random()<.5?'wide':'save';
  const dist=+(/(\d+)m/.exec(choice.label)?.[1]||20),sx=Math.max(48,Math.min(90,100-dist));
  // The opposition counter: a goal for Red, or your keeper keeps it out.
  const counter=(t,text)=>redGoal?f(t,at({A1:[40,30],AK:[4,24],B1:[14,30]}),[0,34],text||`${r1} breaks away… and scores.`):f(t,at({A1:[44,30],B1:[18,30],AK:[6,31]}),[6,31],'Your keeper gathers it.');
  const finish=(t,from,goalText,saveText)=>blueGoal?f(t,at({A1:from,BK:[96,40]}),[100,29],goalText):f(t,at({A1:from,BK:[94,from[1]]}),[94,from[1]],saveText);
  const kind=choice.event?choice.kind||'knock':choice.action;
  if(kind==='shoot')return [
    f(0,at({A1:[sx-8,32],B1:[sx+4,30]}),[sx-6,32],`${me} has it ${dist}m out…`),f(1,at({A1:[sx,31],B1:[sx+5,28]}),[sx+1,31],`${me} shapes to shoot…`),
    blueGoal?f(1.9,at({A1:[sx+1,31],B1:[sx+6,27],BK:[96,40]}),[100,27],'GOAL! Into the corner! 🎉'):miss==='save'?f(1.9,at({A1:[sx+1,31],BK:[95,30]}),[94,30],'Saved by the keeper!'):f(1.9,at({A1:[sx+1,31],BK:[95,36]}),[101,12],'It goes just wide…'),
    f(3.6,at({A1:[sx+3,30],A2:[sx+10,18],B1:[sx+8,28],BK:[95,32]}),blueGoal?[100,27]:miss==='save'?[95,32]:[101,12],blueGoal?`${me} scores!`:miss==='save'?'The keeper gathers it.':'Goal kick.')];
  if(kind==='penalty')return [
    f(0,at({A1:[86,32],B1:[80,26],B2:[80,40]}),[89,32],`${me} places the ball on the spot…`),f(1.2,at({A1:[88,32],B1:[80,26],B2:[80,40]}),[89,32],'The stadium holds its breath…'),
    blueGoal?f(2,at({A1:[89,32],BK:[96,40]}),[100,28],'GOAL! The keeper went the wrong way! 🎉'):success?f(2,at({A1:[89,32],BK:[96,30]}),[95,30],'Saved! What a stop!'):f(2,at({A1:[89,32],BK:[96,34]}),[101,22],'Over the bar!'),
    f(3.6,at({A1:[90,33],BK:[95,32]}),blueGoal?[100,28]:[95,32],blueGoal?`${me} celebrates by the corner flag!`:'Red clear their lines.')];
  if(kind==='corner'||kind==='fumble'){const corner=kind==='corner';return [
    f(0,at({A1:[84,30],A2:corner?[99,2]:[80,12],B1:[90,30],B2:[90,38]}),corner?[99,2]:[84,14],corner?`${REPLAY_NAMES.blue[1]} swings in the corner…`:`A cross comes in from ${REPLAY_NAMES.blue[1]}…`),
    f(1.2,at({A1:[90,32],B1:[91,29],B2:[91,38],BK:[96,30]}),corner?[91,32]:[94,34],corner?`${me} attacks the ball…`:'The keeper spills it!'),
    f(2.3,at({A1:[92,33],B1:[91,29],B2:[92,38],BK:blueGoal?[97,38]:[95,33]}),blueGoal?[100,30]:[95,33],blueGoal?'GOAL! 🎉':corner?'Headed straight at the keeper.':'The keeper recovers just in time.'),
    f(3.6,at({A1:[90,34],B1:[88,30],BK:[95,32]}),blueGoal?[100,30]:[95,32],blueGoal?`${me} is mobbed by the team!`:'Goal kick.')];}
  if(kind==='pass'){const wing=choice.target!=='striker',to=wing?[70,12]:[76,30];return [
    f(0,at({}),[47,32],`${me} looks up…`),f(1.1,at({A2:to,B1:[62,24]}),success?to:[63,22],success?`${me} threads it to ${mate}`:`${me} tries to find ${mate}…`),
    success?f(2.5,at({A1:[62,34],A2:[84,wing?18:28],B1:[70,26],B2:[80,38]}),[85,wing?18:28],`${mate} drives at the defence…`):f(2.4,at({A1:[50,30],A2:[66,16],B1:[56,26],B2:[62,40]}),[54,28],`${r1} cuts it out!`),
    blueGoal?f(3.8,at({A1:[78,34],A2:[86,24],BK:[96,40]}),[100,30],`${mate} finishes! GOAL! 🎉`):success?f(3.8,at({A1:[74,34],A2:[88,22],BK:[90,26]}),[78,30],`${mate} lays it back to ${me}.`):counter(3.8)];}
  if(kind==='dribble'){const lane=choice.target==='wing'?14:32;return [
    f(0,at({}),[47,32],`${me} runs at ${r1}…`),f(1.2,at({A1:[60,lane],B1:[62,lane+2]}),[61,lane],success?`${me} skips past ${r1}!`:`${r1} stands firm…`),
    success?f(2.6,at({A1:[78,lane+4],B1:[64,lane+6],BK:[94,30]}),[79,lane+4],`${me} is clear and closing in!`):f(2.4,at({A1:[61,lane],B1:[58,lane+2]}),[55,lane+4],`Tackled by ${r1}!`),
    success?f(3.8,at({A1:[82,lane+4],B1:[70,lane+6],BK:[94,30]}),[83,lane+4],'Now for the finish…'):counter(3.8,`${r1} goes all the way… GOAL.`)];}
  // Red attack your goal: tackles, interceptions, marking, and the defensive match events.
  const verb={intercept:`${me} reads the pass…`,mark:`${me} tracks the run…`,tackle:`${me} goes to ground…`,var:`${me} slides in inside the box…`,card:`${me} flies into a tackle…`,knock:`${me} takes a heavy knock…`}[kind]||`${me} closes in…`;
  const red=at({B1:[58,32],B2:[66,44],A1:[44,30]}),stopped=kind==='var'?!redGoal:success||['card','knock'].includes(kind)&&!redGoal;
  return [
    f(0,red,[57,32],`${r1} brings it forward…`),f(1.2,at({B1:[40,30],B2:[46,42],A1:[38,32]}),[39,30],verb),
    kind==='var'?f(2.5,at({B1:[16,30],A1:[17,32],AK:[5,30]}),[16,30],'📺 VAR is checking for a penalty…'):kind==='card'?f(2.5,at({B1:[38,30],A1:[39,31]}),[40,30],success?'Just a warning from the referee.':'🟨 Yellow card!'):stopped?f(2.5,at({B1:[38,30],A1:[40,32],A2:[56,16]}),[44,30],`${me} wins it back!`):f(2.5,at({B1:[22,30],A1:[34,32],AK:[6,30]}),[22,30],`${r1} is through on goal…`),
    stopped?f(3.8,at({A1:[50,32],A2:[64,18]}),[64,18],kind==='var'?'No penalty! Play on.':kind==='card'&&!success?'Red waste the free kick.':`…and plays it out to ${REPLAY_NAMES.blue[0]}.`):redGoal?f(3.8,at({B1:[18,30],AK:[3,24]}),[0,34],kind==='var'?'Penalty given… and scored by Red.':'GOAL for Red.'):f(3.8,at({B1:[18,30],AK:[6,31]}),[6,31],'Great save by your keeper!')];
}
