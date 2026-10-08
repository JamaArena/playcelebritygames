// Words for each career: what its skills are called, the situations you face at work, and what you learn.
// Skill keys stay the same in saves; only the names you see change.

export const SKILL_NAMES = {
  football: {passing: 'Passing range', dribbling: 'Skill moves', shooting: 'Finishing', defending: 'Tackling'},
  musician: {technique: 'Vocals & instrument', songwriting: 'Songwriting', production: 'Beat making', 'stage presence': 'Stage presence'},
  basketball: {shooting: 'Three-pointers', passing: 'Court vision', handling: 'Ball handling', defending: 'Blocks & steals'},
  wrestling: {technique: 'Grappling', strength: 'Power slams', stamina: 'Ring stamina', charisma: 'Mic skills'},
  tennis: {serve: 'Big serve', forehand: 'Forehand', backhand: 'Backhand slice', footwork: 'Court speed'},
  vlogger: {storytelling: 'Storytelling', filming: 'Camera work', editing: 'Jump-cut editing', charisma: 'On-camera vibe'},
  video: {research: 'Deep research', scripting: 'Script writing', editing: 'Motion editing', presentation: 'Presenting'},
  skitmaker: {comedy: 'Punchlines', acting: 'Character work', writing: 'Skit writing', timing: 'Comic timing'},
  streamer: {commentary: 'Live commentary', engagement: 'Chat hype', production: 'Stream setup', 'format skill': 'Gameplay'},
  actor: {acting: 'Method acting', expression: 'Facial expression', improvisation: 'Improv', charisma: 'Screen presence'},
  adult: {performance: 'Performance', presentation: 'Lighting & angles', production: 'Production', business: 'Fan business'},
  founder: {'product judgement': 'Product sense', leadership: 'Leadership', sales: 'Pitching', finance: 'Fundraising'},
  developer: {coding: 'HTML & JavaScript', debugging: 'Debugging', architecture: 'System design', communication: 'Client calls'},
  web3: {product: 'Smart contracts', community: 'Community building', research: 'Tokenomics', 'technical skill': 'Solidity'},
};
export const skillName = (career, skill) => SKILL_NAMES[career]?.[skill] || (skill ? skill[0].toUpperCase() + skill.slice(1) : '');

// Situations at work: [what happens, [safe choice, balanced choice, risky choice], skill index per choice]. One is drawn at random each step;
// each choice trains (and is tested on) its own skill, so what you pick matters, not only how risky it is.
export const WORK_SCENES = {
  musician: [
    ['The producer plays you a beat with no hook yet.', ['Hum a simple hook', 'Write a call-and-response chorus', 'Freestyle the whole hook in one take'], '013'],
    ['Your voice cracks on the bridge.', ['Drop the key a little', 'Take a breath and go again', 'Push through for a raw, gritty take'], '203'],
    ['The label wants a radio edit.', ['Trim the intro', 'Rework the structure for radio', 'Rewrite it as a club banger'], '212'],
    ['A guitarist offers a wild solo idea.', ['Keep the solo short', 'Trade four bars each', 'Let them shred for a full minute'], '203'],
    ['Your verse feels too long.', ['Cut four bars', 'Rewrite the punchline', 'Rap it double-time'], '110'],
    ['The drums sound flat in the mix.', ['Add a little reverb', 'Layer a second kick', 'Swap in live drums'], '220'],
    ['A fan request lands mid-session: make it Afrobeats.', ['Add a shaker groove', 'Rebuild the rhythm around log drums', 'Flip the whole song to amapiano'], '221'],
    ['The harmony clashes with the lead.', ['Mute the harmony', 'Rewrite the harmony a third up', 'Stack five-part harmonies'], '210'],
    ['You are running out of studio time.', ['Lock the safest take', 'Comp the best parts quickly', 'One more take, all or nothing'], '220'],
    ['The outro needs something special.', ['Fade out on the chorus', 'Add a stripped acoustic outro', 'End on a surprise key change'], '201'],
  ],
  vlogger: [
    ['It starts raining in the middle of your shoot.', ['Move indoors', 'Film the rain as part of the story', 'Dance in the rain on camera'], '103'],
    ['A stranger walks into your shot.', ['Cut and reshoot', 'Say hi and keep rolling', 'Interview them on the spot'], '130'],
    ['Your mic battery dies.', ['Swap to the phone mic', 'Add subtitles later', 'Go silent-film style with captions'], '122'],
    ['The danfo ride turns into chaos.', ['Keep the camera low', 'Narrate the chaos', 'Make the conductor your co-host'], '103'],
    ['The opening feels slow.', ['Start with the best moment', 'Add a quick teaser montage', 'Open with a cliffhanger question'], '220'],
    ['A brand asks for a mention.', ['Add a short shout-out', 'Weave it into the story', 'Build the whole vlog around it'], '300'],
    ['Your friend forgets their lines.', ['Do another take', 'Keep the blooper in', 'Turn it into an improv segment'], '123'],
    ['The light is going down.', ['Wrap up quickly', 'Use the golden hour', 'Shoot a night-time special'], '110'],
    ['Comments ask for a day-in-the-life.', ['Show your morning', 'Film a full day sped up', 'Swap lives with a fan for a day'], '023'],
    ['The final cut is ten minutes too long.', ['Trim the slow bits', 'Split it into two parts', 'Cut it to a 60-second reel'], '202'],
  ],
  video: [
    ['Your topic is trending, but so are ten other videos.', ['Cover the basics well', 'Find a fresh angle', 'Go deep with an exclusive interview'], '103'],
    ['A fact in your script might be wrong.', ['Cut the claim', 'Double-check with a source', 'Turn the myth-busting into the hook'], '101'],
    ['The thumbnail is not popping.', ['Brighten the colours', 'Add a bold three-word title', 'Stage a dramatic photo shoot'], '213'],
    ['Your animation is taking too long.', ['Use simple text slides', 'Animate only the key moments', 'Pull an all-nighter for full motion graphics'], '222'],
    ['The intro loses viewers at 10 seconds.', ['Cut straight to the point', 'Open with a surprising stat', 'Start with a mini-documentary scene'], '201'],
    ['An expert agrees to a quick call.', ['Ask three questions', 'Record a proper interview', 'Bring them on camera as co-host'], '033'],
    ['Your voiceover sounds tired.', ['Re-record the intro', 'Add energy with music', 'Re-record everything standing up'], '323'],
    ['The middle section drags.', ['Speed up the cuts', 'Add a visual example', 'Restructure into a countdown'], '201'],
    ['A viewer sends a great question.', ['Answer it in the description', 'Add a short Q&A segment', 'Make the whole video about it'], '130'],
    ['Upload time is near.', ['Publish what you have', 'Polish the first minute', 'Delay a day for a perfect cut'], '221'],
  ],
  skitmaker: [
    ['The setup is not landing in rehearsal.', ['Make it shorter', 'Add a relatable Lagos detail', 'Switch the whole premise'], '202'],
    ['Your co-star improvises a line.', ['Stick to the script', 'Play along', 'Build a whole runner from it'], '130'],
    ['The punchline feels predictable.', ['Slow down the delivery', 'Add a twist before it', 'Flip the ending completely'], '320'],
    ['You need a costume fast.', ['Use what you have', 'Borrow from the market', 'Go full wig-and-gele transformation'], '110'],
    ['A neighbour complains about the noise.', ['Lower your voice', 'Put them in the skit', 'Make the complaint the punchline'], '310'],
    ['The skit needs a sound effect.', ['Add a classic laugh track', 'Use a viral sound', 'Record your own ridiculous sound'], '300'],
    ['Mummy character or Daddy character?', ['Play the strict Daddy', 'Play the dramatic Mummy', 'Play both in one take'], '111'],
    ['The ending runs long.', ['Cut on the laugh', 'Add a quick tag joke', 'End on a freeze-frame cliffhanger'], '320'],
    ['A brand wants a funny ad.', ['Keep it light', 'Write it as a mini story', 'Make fun of the brand itself'], '020'],
    ['Your timing is off on the first take.', ['Count the beat', 'Watch the playback', 'Do ten takes back to back'], '331'],
  ],
  streamer: [
    ['Chat starts spamming for a challenge.', ['Promise it later', 'Do a quick mini challenge', 'Go no-hit on the hardest level'], '133'],
    ['Your internet starts lagging.', ['Lower the quality', 'Switch to just chatting', 'Hotspot from your phone and push on'], '202'],
    ['A big streamer raids you.', ['Say thank you', 'Welcome everyone by name', 'Challenge them to a match live'], '113'],
    ['You lose three games in a row.', ['Take a break', 'Laugh it off with chat', 'Rage-quit for comedy'], '100'],
    ['A troll is ruining the chat.', ['Ignore them', 'Set slow mode', 'Roast them back, politely'], '120'],
    ['Someone donates with a wild request.', ['Read it out', 'Do half of it', 'Do the whole thing on camera'], '011'],
    ['The new game update just dropped.', ['Play what you know', 'Try the new mode', 'Speedrun the new content'], '033'],
    ['Your camera freezes.', ['Turn it off', 'Restart it quickly', 'Use a meme avatar for the rest'], '221'],
    ['Chat is getting quiet.', ['Ask a question', 'Start a poll', 'Run a giveaway'], '021'],
    ['It is time to end the stream.', ['Say goodbye', 'Share the highlights', 'Tease a huge surprise for tomorrow'], '101'],
  ],
  actor: [
    ['The director wants more emotion.', ['Hold the moment longer', 'Use a personal memory', 'Break down completely on camera'], '100'],
    ['You forget a line mid-scene.', ['Ask for the line', 'Paraphrase smoothly', 'Improvise something better'], '022'],
    ['Your scene partner is late.', ['Rehearse alone', 'Run lines with a stand-in', 'Rewrite the scene as a monologue'], '023'],
    ['The stunt double is unavailable.', ['Skip the stunt', 'Do a safe version', 'Do the stunt yourself'], '303'],
    ['A big critic is on set today.', ['Play it safe', 'Bring your best take', 'Try a bold new interpretation'], '012'],
    ['The accent is not working.', ['Drop the accent', 'Practise with a coach', 'Go full method for the day'], '100'],
    ['The lighting team needs another hour.', ['Wait in your trailer', 'Rehearse with the crew', 'Rewrite your backstory'], '330'],
    ['The script calls for a crying scene.', ['Use eye drops', 'Think of a sad memory', 'Stay in character all day'], '100'],
    ['The director gives you freedom.', ['Stick to the plan', 'Add a small personal touch', 'Change the whole tone'], '012'],
    ['It is the final shot of the day.', ['Deliver the safe take', 'One more with feeling', 'One wild take for the blooper reel'], '012'],
  ],
  adult: [
    ['A new studio offers a deal.', ['Sign the standard terms', 'Negotiate a bigger cut', 'Hold out for top billing'], '333'],
    ['The lights are too harsh.', ['Dim them a little', 'Rework the lighting with the crew', 'Shoot by candlelight'], '121'],
    ['Subscribers ask for a theme.', ['Keep your usual style', 'Pick the top fan vote', 'Launch a whole themed series'], '032'],
    ['A co-star cancels last minute.', ['Reschedule', 'Shoot a solo set', 'Bring in a surprise guest'], '302'],
    ['Your schedule is packed.', ['Post a preview', 'Batch-film the week', 'Go live tonight'], '120'],
    ['A brand wants a classy collab.', ['Keep it tasteful', 'Tease with style', 'Go bold and leave them breathless'], '100'],
    ['Fans ask for behind the scenes.', ['Share a photo', 'Post a short clip', 'Do a full live Q&A'], '123'],
    ['The edit needs a final call.', ['Keep it short and sweet', 'Balance the pacing', 'Go for the extended cut'], '222'],
    ['A rival creator calls you out.', ['Ignore it', 'Reply with class', 'Challenge them to a collab'], '330'],
    ['Your contract is up for renewal.', ['Renew as is', 'Ask for better terms', 'Go fully independent'], '333'],
  ],
  founder: [
    ['Customers want a feature you did not plan.', ['Add it to the roadmap', 'Build a quick version', 'Pivot the product around it'], '010'],
    ['An investor wants a meeting tomorrow.', ['Send the deck', 'Prepare a live demo', 'Pitch over dinner tonight'], '302'],
    ['Your best engineer wants to quit.', ['Offer a raise', 'Give them a big project', 'Make them co-founder'], '311'],
    ['A competitor copies your idea.', ['Ignore them', 'Ship faster', 'Launch a cheeky comparison ad'], '012'],
    ['Cash is running low.', ['Cut costs', 'Raise a small bridge round', 'Bet everything on a big launch'], '332'],
    ['The app crashes on launch day.', ['Roll back', 'Hotfix with the team', 'Go live and fix it on stream'], '012'],
    ['A big company wants to partner.', ['Ask for a pilot', 'Negotiate a fair deal', 'Ask them to acquire you'], '023'],
    ['Your team is burning out.', ['Give a day off', 'Plan a team trip', 'Move to a four-day week'], '131'],
    ['A journalist asks for an interview.', ['Send a statement', 'Do a short call', 'Invite them to the office for a day'], '221'],
    ['Board meeting: growth is slow.', ['Explain the plan', 'Show a new metric', 'Announce a bold new market'], '132'],
  ],
  developer: [
    ['A client reports the site is down.', ['Restart the server', 'Read the logs', 'Rebuild the deployment'], '112'],
    ['The page loads slowly on phones.', ['Compress the images', 'Lazy-load the content', 'Rewrite it as a single-page app'], '002'],
    ['The form will not submit.', ['Check the console', 'Write a failing test', 'Refactor the whole form'], '112'],
    ['The client changes the design again.', ['Tweak the CSS', 'Build reusable components', 'Redesign it with a new framework'], '022'],
    ['A security warning appears.', ['Update the package', 'Audit the dependencies', 'Rewrite the risky module'], '012'],
    ['The deadline moves up a week.', ['Cut a feature', 'Ship in stages', 'Code through the weekend'], '320'],
    ['Your code review gets twenty comments.', ['Fix the small ones', 'Discuss the design', 'Rewrite it from scratch'], '032'],
    ['The database is getting full.', ['Delete old data', 'Add an index', 'Migrate to a new database'], '022'],
    ['A junior developer asks for help.', ['Send a link', 'Pair for an hour', 'Run a team workshop'], '313'],
    ['Launch day for the client project.', ['Deploy quietly', 'Deploy with monitoring', 'Deploy on a Friday evening'], '010'],
  ],
  web3: [
    ['The community asks for a roadmap.', ['Share a short update', 'Host a live AMA', 'Publish a full whitepaper'], '112'],
    ['A bug is found in your contract.', ['Pause the contract', 'Patch and audit', 'Launch a bug bounty'], '331'],
    ['Gas fees are high today.', ['Wait for a quiet hour', 'Batch the transactions', 'Move to a cheaper chain'], '230'],
    ['A big wallet starts selling.', ['Stay calm', 'Explain the plan', 'Launch a buy-back'], '122'],
    ['Partners want a collab.', ['Start small', 'Co-host an event', 'Merge the communities'], '011'],
    ['Your Discord is flooded with questions.', ['Pin an FAQ', 'Add moderators', 'Do a voice chat marathon'], '111'],
    ['The launch date is close.', ['Test on the testnet', 'Get an external audit', 'Launch early with a surprise drop'], '301'],
    ['A rumour spreads on social media.', ['Ignore it', 'Post the facts', 'Go live and answer everything'], '121'],
    ['Designers deliver new artwork.', ['Use it as is', 'Ask for small changes', 'Turn it into a collectible series'], '002'],
    ['Tokenomics need a final decision.', ['Keep supply small', 'Balance rewards and supply', 'Try a bold new model'], '222'],
  ],
};

// What you learn, one line per skill gain: ten for every skill of every career.
export const LEARN_LINES = {
  football: {
    passing: ['You learnt to play a perfect through ball', 'You can now switch play across the whole pitch', 'You learnt to pass with the outside of your boot', 'You can now find a teammate under pressure', 'You learnt to weight a pass just right', 'You can now play a one-two in tight spaces', 'You learnt to spot the runner early', 'You can now hit a long diagonal on the money', 'You learnt to pass first time', 'You can now thread a pass through three defenders'],
    dribbling: ['You learnt a slick step-over', 'You can now beat a defender with a drop of the shoulder', 'You learnt to keep the ball glued to your feet', 'You can now pull off a rainbow flick', 'You learnt to change pace like a pro', 'You can now nutmeg the tightest defender', 'You learnt to shield the ball with your body', 'You can now dribble out of a crowded box', 'You learnt the Cruyff turn', 'You can now glide past two players at once'],
    shooting: ['You learnt to shoot farther', 'You can now curl it into the top corner', 'You learnt to strike the ball cleanly on the volley', 'You can now place it past the keeper calmly', 'You learnt to shoot with your weaker foot', 'You can now hit a knuckleball free kick', 'You learnt to chip the keeper', 'You can now finish first time from a cross', 'You learnt to keep your shots low and hard', 'You can now score from outside the box'],
    defending: ['You learnt to time a sliding tackle', 'You can now read the passing lane', 'You learnt to stay on your feet in one-on-ones', 'You can now win headers in the box', 'You learnt to track back without fouling', 'You can now block a shot without flinching', 'You learnt to organise your back line', 'You can now intercept a lofted pass', 'You learnt to jockey the winger wide', 'You can now clear the ball under pressure'],
  },
  musician: {
    technique: ['You learnt to hold a long note', 'You can now hit that high note without straining', 'You learnt a new chord progression', 'You can now play a riff by ear', 'You learnt to control your vibrato', 'You can now sing harmonies on the spot', 'You learnt to breathe from your diaphragm', 'You can now play a full scale at speed', 'You learnt to sing a clean falsetto', 'You can now improvise a solo over any beat'],
    songwriting: ['You learnt to write a hook that sticks', 'You can now rhyme in three syllables', 'You learnt to tell a story in one verse', 'You can now write a bridge that lifts the song', 'You learnt to write in Pidgin and English together', 'You can now finish a song in one session', 'You learnt to turn a feeling into a chorus', 'You can now write lyrics people sing back', 'You learnt to cut a line that does not serve the song', 'You can now write a love song that is not cheesy'],
    production: ['You learnt to make a log drum hit harder', 'You can now mix vocals so they sit just right', 'You learnt to sample an old highlife record', 'You can now build a beat from scratch in an hour', 'You learnt to sidechain the bass to the kick', 'You can now master a track for streaming', 'You learnt to layer synths without mud', 'You can now program amapiano shakers', 'You learnt to use silence as an instrument', 'You can now produce for other artists'],
    'stage presence': ['You learnt to work a crowd', 'You can now get a whole stadium to sing along', 'You learnt to dance and sing without losing breath', 'You can now handle a broken mic like a pro', 'You learnt to make eye contact with the back row', 'You can now hype a sleepy crowd', 'You learnt the art of a dramatic pause', 'You can now crowd-surf safely', 'You learnt to own the stage in silence', 'You can now perform through the rain'],
  },
  basketball: {
    shooting: ['You learnt to shoot farther from deep', 'You can now hit a step-back three', 'You learnt a smoother release', 'You can now sink free throws under pressure', 'You learnt to shoot off the dribble', 'You can now fade away over a taller defender', 'You learnt to hit the bank shot', 'You can now make the corner three', 'You learnt to keep your elbow in', 'You can now score with a floater'],
    passing: ['You learnt a no-look pass', 'You can now throw a perfect alley-oop', 'You learnt to read the pick and roll', 'You can now hit the open shooter instantly', 'You learnt a bounce pass through traffic', 'You can now push the fast break', 'You learnt to pass out of a double team', 'You can now spot cutters before they cut', 'You learnt a full-court outlet pass', 'You can now run the offence like a point guard'],
    handling: ['You learnt a killer crossover', 'You can now dribble between your legs at speed', 'You learnt a hesitation move', 'You can now break the full-court press', 'You learnt to protect the ball in traffic', 'You can now spin past a defender', 'You learnt the Euro step', 'You can now dribble with either hand', 'You learnt to change speed on a dime', 'You can now keep your dribble alive under pressure'],
    defending: ['You learnt to time a block', 'You can now steal the ball cleanly', 'You learnt to slide your feet on defence', 'You can now box out for rebounds', 'You learnt to fight through screens', 'You can now take a charge', 'You learnt to contest without fouling', 'You can now guard a bigger player', 'You learnt to anticipate the pass', 'You can now lock down the best scorer'],
  },
  wrestling: {
    technique: ['You learnt a slick arm drag', 'You can now reverse any headlock', 'You learnt a picture-perfect suplex', 'You can now chain three holds together', 'You learnt to land safely from any move', 'You can now escape a submission hold', 'You learnt the springboard dropkick', 'You can now counter a clothesline', 'You learnt to work the ropes', 'You can now pin with a roll-up'],
    strength: ['You learnt to lift heavier opponents', 'You can now hit a thundering powerbomb', 'You learnt to thrust harder off the mat', 'You can now press an opponent overhead', 'You learnt a crushing bear hug', 'You can now slam a giant', 'You learnt to brace through big hits', 'You can now carry an opponent across the ring', 'You learnt to drive with your legs', 'You can now break out of any hold'],
    stamina: ['You learnt to last a full twenty-minute match', 'You can now keep your breathing calm', 'You learnt to recover between big moves', 'You can now go to a second wind', 'You learnt to pace a long match', 'You can now wrestle back-to-back nights', 'You learnt to fight through fatigue', 'You can now kick out at two', 'You learnt to save energy for the finish', 'You can now outlast the toughest opponent'],
    charisma: ['You learnt to cut a fiery promo', 'You can now get the crowd chanting your name', 'You learnt a signature entrance', 'You can now trash talk without a script', 'You learnt to play the villain', 'You can now make fans cry with a speech', 'You learnt to sell a hit dramatically', 'You can now hype a pay-per-view', 'You learnt a catchphrase that sticks', 'You can now win the crowd in any city'],
  },
  tennis: {
    serve: ['You learnt to serve faster', 'You can now hit an ace down the T', 'You learnt a nasty kick serve', 'You can now slice a serve out wide', 'You learnt to toss the ball consistently', 'You can now serve under match point pressure', 'You learnt to disguise your serve', 'You can now hit second serves with confidence', 'You learnt to serve and volley', 'You can now win quick points on serve'],
    forehand: ['You learnt to hit with heavy topspin', 'You can now hit an inside-out forehand winner', 'You learnt to drive through the ball', 'You can now hit a running forehand', 'You learnt to change direction on the forehand', 'You can now hit deep, heavy rallies', 'You learnt a short-angle forehand', 'You can now attack a short ball', 'You learnt to hit on the rise', 'You can now finish points with your forehand'],
    backhand: ['You learnt a low, skidding slice', 'You can now hit a backhand down the line', 'You learnt to defend with your backhand', 'You can now hit a two-handed winner', 'You learnt a drop shot off the backhand', 'You can now return serves with your backhand', 'You learnt to hit high backhands', 'You can now pass at the net', 'You learnt to stay low on the backhand', 'You can now trade backhands all day'],
    footwork: ['You learnt to split-step on time', 'You can now slide on hard courts', 'You learnt to recover to the centre', 'You can now chase down drop shots', 'You learnt quick crossover steps', 'You can now defend corner to corner', 'You learnt to set your feet early', 'You can now move like a pro at the net', 'You learnt to stay balanced on the run', 'You can now reach balls others cannot'],
  },
  vlogger: {
    storytelling: ['You learnt to start with a hook', 'You can now turn a boring day into a story', 'You learnt to build a mini cliffhanger', 'You can now end every vlog with a twist', 'You learnt to show, not just tell', 'You can now make viewers care in 10 seconds', 'You learnt to plan a three-act vlog', 'You can now tell a story with just clips', 'You learnt to make your city a character', 'You can now turn a mistake into the best moment'],
    filming: ['You learnt to shoot smooth b-roll', 'You can now film steady while walking', 'You learnt to use natural light', 'You can now nail a cinematic slow-mo', 'You learnt the rule of thirds', 'You can now film in a crowded market', 'You learnt to shoot a drone-style reveal', 'You can now frame a perfect talking head', 'You learnt to film the golden hour', 'You can now shoot a whole vlog on your phone'],
    editing: ['You learnt to jump-cut on the beat', 'You can now colour grade like a film', 'You learnt to add subtitles fast', 'You can now cut a 20-minute vlog in an hour', 'You learnt to sync clips to music', 'You can now use sound effects for comedy', 'You learnt to make smooth transitions', 'You can now edit vertical and horizontal versions', 'You learnt to cut the boring parts ruthlessly', 'You can now make a thumbnail that pops'],
    charisma: ['You learnt to talk to the camera like a friend', 'You can now make strangers comfortable on camera', 'You learnt to laugh at yourself', 'You can now keep energy up all day', 'You learnt a signature greeting', 'You can now handle trolls with charm', 'You learnt to light up a dull moment', 'You can now make a whole room smile', 'You learnt to be yourself on camera', 'You can now host a meet-up with confidence'],
  },
  video: {
    research: ['You learnt to fact-check like a journalist', 'You can now find sources others miss', 'You learnt to read a study quickly', 'You can now turn data into a story', 'You learnt to interview an expert', 'You can now spot a fake statistic', 'You learnt to dig through old archives', 'You can now explain any topic simply', 'You learnt to compare sources fairly', 'You can now find the surprising angle'],
    scripting: ['You learnt to write a killer hook', 'You can now script a 10-minute video in an hour', 'You learnt to cut filler words', 'You can now write for the ear, not the eye', 'You learnt to structure a countdown', 'You can now plant a payoff early', 'You learnt to write punchy narration', 'You can now script a documentary', 'You learnt to end with a call to action', 'You can now write a script that sounds natural'],
    editing: ['You learnt to animate text on screen', 'You can now cut motion graphics to the beat', 'You learnt to use B-roll to explain', 'You can now edit a documentary pace', 'You learnt to mix voiceover and music', 'You can now add maps and diagrams', 'You learnt to keep viewers past the first minute', 'You can now colour grade a whole series', 'You learnt to use zooms with purpose', 'You can now edit a viral short'],
    presentation: ['You learnt to speak clearly on camera', 'You can now present without a script', 'You learnt to use your hands to explain', 'You can now present outdoors in a crowd', 'You learnt to control your pace', 'You can now deliver a serious topic with warmth', 'You learnt to pause for effect', 'You can now host a live Q&A', 'You learnt to look natural on a teleprompter', 'You can now present to a million viewers'],
  },
  skitmaker: {
    comedy: ['You learnt to land a punchline', 'You can now make a whole room laugh', 'You learnt to find humour in daily life', 'You can now roast without being mean', 'You learnt the rule of three', 'You can now turn any complaint into a joke', 'You learnt to play the straight man', 'You can now write a running gag', 'You learnt to make physical comedy work', 'You can now make Mummy laugh at your skit'],
    acting: ['You learnt to play an angry landlord', 'You can now switch characters in one take', 'You learnt to play a dramatic Mummy', 'You can now do five different voices', 'You learnt to cry on cue for comedy', 'You can now play a convincing old man', 'You learnt to stay in character while laughing', 'You can now act with just your eyebrows', 'You learnt to play twins in one skit', 'You can now make a cameo unforgettable'],
    writing: ['You learnt to write a 60-second skit', 'You can now write a series with recurring characters', 'You learnt to write a twist ending', 'You can now write relatable Lagos moments', 'You learnt to cut a joke that is not working', 'You can now write a skit for a brand', 'You learnt to write dialogue that pops', 'You can now plan a whole week of skits', 'You learnt to build up to a punchline', 'You can now write a skit in ten minutes'],
    timing: ['You learnt to pause before the punchline', 'You can now cut on the laugh', 'You learnt to speed up for chaos', 'You can now time a reaction shot', 'You learnt to wait for the awkward silence', 'You can now land a callback perfectly', 'You learnt to hold a stare for comedy', 'You can now deliver a one-liner fast', 'You learnt comic rhythm', 'You can now time a slapstick fall'],
  },
  streamer: {
    commentary: ['You learnt to narrate every move', 'You can now commentate like a sports caster', 'You learnt to fill quiet moments', 'You can now react without losing focus', 'You learnt to explain strategy live', 'You can now hype a clutch play', 'You learnt to laugh through a loss', 'You can now tell stories while gaming', 'You learnt to keep commentary family friendly', 'You can now commentate in two languages'],
    engagement: ['You learnt to greet every new follower', 'You can now run a chat poll', 'You learnt to turn lurkers into chatters', 'You can now host a giveaway', 'You learnt to remember regulars by name', 'You can now manage a raid of thousands', 'You learnt to handle trolls calmly', 'You can now run community game nights', 'You learnt to read chat at speed', 'You can now make chat feel like family'],
    production: ['You learnt to set up overlays', 'You can now stream in 1080p without lag', 'You learnt to balance mic and game audio', 'You can now switch scenes smoothly', 'You learnt to add alerts and sound effects', 'You can now stream from your phone', 'You learnt to light your face properly', 'You can now clip highlights live', 'You learnt to set up a green screen', 'You can now run a two-camera stream'],
    'format skill': ['You learnt a new speedrun route', 'You can now clutch a 1v3', 'You learnt to aim faster', 'You can now beat the hardest boss', 'You learnt the new meta', 'You can now play with a controller and keyboard', 'You learnt to win at FIFA on legendary', 'You can now carry a team', 'You learnt a secret glitch', 'You can now win a tournament'],
  },
  actor: {
    acting: ['You learnt to stay in character for hours', 'You can now play a villain convincingly', 'You learnt to cry on cue', 'You can now play a role decades older', 'You learnt to listen in a scene', 'You can now carry a lead role', 'You learnt to play comedy and drama', 'You can now make a small role memorable', 'You learnt method acting', 'You can now act opposite a green screen'],
    expression: ['You learnt to show fear with just your eyes', 'You can now smile in ten different ways', 'You learnt to hold a close-up', 'You can now show heartbreak without words', 'You learnt to control your face in silence', 'You can now raise one eyebrow on cue', 'You learnt to play subtle emotion', 'You can now steal a scene with a look', 'You learnt to show joy that feels real', 'You can now cry with one tear'],
    improvisation: ['You learnt to say yes, and', 'You can now save a scene when a prop breaks', 'You learnt to improvise a monologue', 'You can now keep going when lines are forgotten', 'You learnt to play off the crowd', 'You can now improvise an accent', 'You learnt to turn mistakes into gold', 'You can now improvise a whole scene', 'You learnt quick-fire reactions', 'You can now make the director laugh mid-take'],
    charisma: ['You learnt to own a red carpet', 'You can now charm any interviewer', 'You learnt to work a premiere crowd', 'You can now give a moving award speech', 'You learnt to pose for the cameras', 'You can now light up a talk show', 'You learnt to sign autographs with flair', 'You can now win over a casting director', 'You learnt to command a room', 'You can now make headlines just by arriving'],
  },
  adult: {
    performance: ['You learnt to read the mood', 'You can now set the tone with confidence', 'You learnt to work with any co-star', 'You can now deliver a polished take first time', 'You learnt to keep energy high', 'You can now improvise with style', 'You learnt to stay professional on set', 'You can now carry a whole series', 'You learnt to build chemistry fast', 'You can now headline a premium release'],
    presentation: ['You learnt to find your best angles', 'You can now light a set beautifully', 'You learnt to style a scene', 'You can now shoot glamour photos', 'You learnt to dress a set for the theme', 'You can now pose with confidence', 'You learnt soft, flattering lighting', 'You can now frame a tasteful teaser', 'You learnt to work with a stylist', 'You can now make any room look luxurious'],
    production: ['You learnt to plan a shoot schedule', 'You can now edit a release in a day', 'You learnt to direct a small crew', 'You can now shoot with two cameras', 'You learnt to manage a budget', 'You can now produce a whole series', 'You learnt to colour grade a scene', 'You can now handle releases and consent forms properly', 'You learnt to keep sets safe and respectful', 'You can now run your own studio'],
    business: ['You learnt to price your content', 'You can now negotiate a better split', 'You learnt to grow your subscribers', 'You can now run a fan loyalty program', 'You learnt to protect your brand', 'You can now sign brand partnerships', 'You learnt to read your analytics', 'You can now plan a launch week', 'You learnt to keep loyal fans happy', 'You can now run your business independently'],
  },
  founder: {
    'product judgement': ['You learnt to say no to the wrong features', 'You can now spot what customers really need', 'You learnt to build an MVP in a week', 'You can now read user feedback calmly', 'You learnt to measure what matters', 'You can now plan a product roadmap', 'You learnt to kill a feature nobody uses', 'You can now design a simple onboarding', 'You learnt to test ideas cheaply', 'You can now launch products people love'],
    leadership: ['You learnt to run a great stand-up', 'You can now hire the right people', 'You learnt to give tough feedback kindly', 'You can now keep a team motivated', 'You learnt to share credit', 'You can now handle a crisis calmly', 'You learnt to set clear goals', 'You can now lead a team of fifty', 'You learnt to listen first', 'You can now build a great company culture'],
    sales: ['You learnt to pitch in sixty seconds', 'You can now close a big client', 'You learnt to handle objections', 'You can now sell at a trade fair', 'You learnt to tell a founder story', 'You can now negotiate a partnership', 'You learnt to follow up without being pushy', 'You can now win over a sceptical customer', 'You learnt to run a product demo', 'You can now sell to a global brand'],
    finance: ['You learnt to read a balance sheet', 'You can now plan a runway', 'You learnt to raise a seed round', 'You can now value your startup', 'You learnt to cut costs wisely', 'You can now pitch to big investors', 'You learnt to manage cash flow', 'You can now negotiate a term sheet', 'You learnt to forecast growth', 'You can now raise a Series A'],
  },
  developer: {
    coding: ['You can now build a website with HTML', 'You learnt to style pages with CSS', 'You can now make buttons work with JavaScript', 'You learnt to build a responsive layout', 'You can now fetch data from an API', 'You learnt to write clean functions', 'You can now build a login page', 'You learnt to use Git like a pro', 'You can now build a mobile app', 'You learnt to write code others can read'],
    debugging: ['You learnt to read error messages calmly', 'You can now find a bug with breakpoints', 'You learnt to write a failing test first', 'You can now fix a memory leak', 'You learnt to rubber-duck a problem', 'You can now debug a slow page', 'You learnt to read server logs', 'You can now fix a bug in production safely', 'You learnt to trace a network request', 'You can now squash bugs others gave up on'],
    architecture: ['You learnt to design a database', 'You can now split an app into services', 'You learnt to cache for speed', 'You can now plan for a million users', 'You learnt to design clean APIs', 'You can now choose the right framework', 'You learnt to keep systems simple', 'You can now design for failure', 'You learnt to scale a website', 'You can now draw the whole system on a whiteboard'],
    communication: ['You learnt to explain tech to non-techies', 'You can now write clear documentation', 'You learnt to estimate honestly', 'You can now run a client demo', 'You learnt to say no politely', 'You can now write a great pull request', 'You learnt to run a code review kindly', 'You can now give a tech talk', 'You learnt to manage client expectations', 'You can now lead a team meeting'],
  },
  web3: {
    product: ['You learnt to deploy a smart contract', 'You can now build a wallet connect button', 'You learnt to design a fair mint', 'You can now launch an NFT collection', 'You learnt to build a simple dApp', 'You can now design a staking feature', 'You learnt to make onboarding easy for newbies', 'You can now run a testnet launch', 'You learnt to design a DAO vote', 'You can now ship a product people actually use'],
    community: ['You learnt to run a great Discord', 'You can now host a Twitter Space', 'You learnt to reward early supporters', 'You can now handle FUD calmly', 'You learnt to onboard new members', 'You can now run a community vote', 'You learnt to turn holders into fans', 'You can now organise a meet-up', 'You learnt to moderate fairly', 'You can now grow a community to thousands'],
    research: ['You learnt to read a whitepaper fast', 'You can now design fair tokenomics', 'You learnt to spot a rug pull', 'You can now analyse on-chain data', 'You learnt to compare blockchains', 'You can now model token supply', 'You learnt to read audit reports', 'You can now explain DeFi simply', 'You learnt to track market trends', 'You can now predict gas spikes'],
    'technical skill': ['You learnt to write Solidity', 'You can now write a secure contract', 'You learnt to test contracts thoroughly', 'You can now save on gas with clever code', 'You learnt to use a block explorer', 'You can now build on a layer two', 'You learnt to integrate an oracle', 'You can now upgrade a contract safely', 'You learnt to sign transactions in code', 'You can now audit someone else’s contract'],
  },
};
export function learnLine(career, skill, seed = Math.random()) { const list = LEARN_LINES[career]?.[skill]; return list ? list[Math.floor(seed * list.length) % list.length] : `You got better at ${skillName(career, skill).toLowerCase()}`; }
// Sport plays: what you can do on each beat of a game, bout or match. [label, skill index, risk, action, points]
// Skill indexes follow CAREERS[career].skills. `defence` beats are the opponent's possession.
export const SPORT_PLAYS = {
  basketball: [
    {plays: [['Pull up for three', 0, 'risky', 'shot', 3], ['Step in for a mid-range jumper', 0, 'balanced', 'shot', 2], ['Swing it to the open corner', 1, 'safe', 'pass', 2]]},
    {plays: [['Bounce pass to the cutter', 1, 'safe', 'pass', 2], ['Lob it up for the alley-oop', 1, 'risky', 'pass', 2], ['Fake the pass and drive', 2, 'balanced', 'drive', 2]]},
    {defence: true, plays: [['Poke the ball loose for a steal', 3, 'risky', 'steal'], ['Slide your feet and stay in front', 3, 'balanced', 'contain'], ['Force them to the sideline', 3, 'safe', 'funnel']]},
    {defence: true, plays: [['Jump to block the shot', 3, 'risky', 'block'], ['Plant your feet and take the charge', 3, 'balanced', 'charge'], ['Box out for the rebound', 3, 'safe', 'boxout']]},
    {plays: [['Step-back three', 0, 'risky', 'shot', 3], ['Crossover and drive baseline', 2, 'balanced', 'drive', 2], ['Hit the open big in the post', 1, 'safe', 'pass', 2]]},
    {plays: [['Take the last shot yourself', 0, 'risky', 'shot', 3], ['Spin to the rim', 2, 'balanced', 'drive', 2], ['Kick it out to the open shooter', 1, 'safe', 'pass', 2]]},
  ],
  wrestling: [
    {plays: [['Circle and wear them down', 2, 'safe', 'circle'], ['Lock up and take them down', 0, 'balanced', 'grapple'], ['Snap suplex', 1, 'risky', 'slam']]},
    {plays: [['Brace and absorb it', 2, 'safe', 'brace'], ['Counter into a hold', 0, 'balanced', 'counter'], ['Reverse it in mid-air', 0, 'risky', 'reversal']]},
    {plays: [['Play to the crowd', 3, 'safe', 'crowd'], ['Spinebuster', 1, 'balanced', 'slam'], ['Climb the top rope and fly', 2, 'risky', 'dive']]},
    {plays: [['Catch your breath', 2, 'safe', 'rest'], ['Lock in a submission', 0, 'balanced', 'submission'], ['Powerbomb', 1, 'risky', 'slam']]},
    {plays: [['Chain-wrestle for control', 0, 'safe', 'grapple'], ['Taunt, then strike', 3, 'balanced', 'crowd'], ['Signature move', 0, 'risky', 'signature']]},
    {plays: [['Keep the pressure on', 1, 'safe', 'grapple'], ['Go for the pin', 0, 'balanced', 'pin'], ['Signature finisher', 0, 'risky', 'signature']]},
  ],
  tennis: [
    {plays: [['Kick serve and hold the baseline', 0, 'safe', 'serve'], ['Serve wide, hit into the open court', 1, 'balanced', 'serve'], ['Serve and volley', 3, 'risky', 'volley']]},
    {plays: [['Loop it back cross-court', 1, 'safe', 'forehand'], ['Run around it for an inside-out forehand', 3, 'balanced', 'forehand'], ['Rip it down the line', 1, 'risky', 'forehand']]},
    {plays: [['Slice it back deep', 2, 'safe', 'backhand'], ['Sprint and throw up a lob', 3, 'balanced', 'lob'], ['Backhand pass down the line', 2, 'risky', 'backhand']]},
    {plays: [['Stay back and grind', 2, 'safe', 'backhand'], ['Approach and volley', 3, 'balanced', 'volley'], ['Feather a drop shot', 1, 'risky', 'drop']]},
    {plays: [['Block the return back deep', 2, 'safe', 'backhand'], ['Chip and charge the net', 3, 'balanced', 'volley'], ['Attack the second serve', 1, 'risky', 'forehand']]},
    {plays: [['Make them play one more ball', 3, 'safe', 'forehand'], ['Backhand down the line', 2, 'balanced', 'backhand'], ['Go for the forehand winner', 1, 'risky', 'forehand']]},
  ],
};

// Things that go wrong (or right) mid-activity, Sims "Get to Work" style. Each has its own decision.
// [what happens, [safe, balanced, risky], skill indexes, effects]. Effects: on a miss (`miss`) or a hit (`hit`):
// energy, stability, engagement, quality, reputation and fame changes, plus a short news line.
export const WORK_EVENTS = {
  // Football extras: `goal`/`concede` are the chance of a goal for you or for them; `booked` makes your next defending harder; `kind` picks the replay.
  football: [
    ['🤕 You take a knock on the ankle after a late tackle.', ['Signal for the physio', 'Strap it and play on', 'Run it off'], '301', {kind: 'knock', miss: {energy: -20, quality: -8, news: 'limped through the second half'}, hit: {engagement: 10}}],
    ['🟨 The referee reaches for a card after your sliding tackle.', ['Apologise and back off', 'Explain you got the ball', 'Argue with the referee'], '333', {kind: 'card', miss: {booked: true, reputation: -2, engagement: -8, news: 'was booked for a reckless tackle'}, hit: {engagement: 6}}],
    ['⚽ Penalty! You are brought down in the box.', ['Side-foot it into the corner', 'Smash it down the middle', 'Chip it Panenka-style'], '222', {kind: 'penalty', miss: {engagement: -10}, hit: {goal: 1, engagement: 20}}],
    ['📺 VAR checks your challenge in the box for a penalty.', ['Hands behind your back', 'Calmly show the replay angle', 'Protest to the referee'], '333', {kind: 'var', miss: {concede: .75, engagement: -10}, hit: {engagement: 12}}],
    ['🚩 Injury time: a corner to Blue!', ['Play it short and keep the ball', 'Whip it to the near post', 'Go up for the header yourself'], '012', {kind: 'corner', miss: {engagement: -6}, hit: {goal: .5, engagement: 12}}],
    ['🧤 Their keeper fumbles a cross at your feet!', ['Tap it into the empty net', 'Square it to Bayo', 'Chip the stranded keeper'], '202', {kind: 'fumble', miss: {engagement: -6}, hit: {goal: .85, engagement: 15}}],
  ],
  basketball: [
    ['🤕 You land awkwardly on your ankle.', ['Sub out and ice it', 'Tape it and play on', 'Shake it off and attack'], '322', {miss: {energy: -20, quality: -8, news: 'rolled an ankle mid-game'}, hit: {engagement: 12}}],
    ['🟨 The ref calls your fourth foul.', ['Play soft defence', 'Stay disciplined', 'Keep attacking the rim'], '332', {miss: {opponent: 2, reputation: -2}, hit: {engagement: 10}}],
  ],
  wrestling: [
    ['💥 Your opponent botches a move and you land badly.', ['Roll out of the ring and recover', 'Call an audible to the finish', 'Fight through it'], '202', {miss: {energy: -15, stamina: -20, news: 'was hurt by a botched move'}, hit: {engagement: 15}}],
    ['📣 The crowd turns on your opponent: the heat is huge!', ['Soak it in', 'Lead a chant', 'Grab the mic mid-match'], '333', {miss: {engagement: -10}, hit: {engagement: 25, quality: 5}}],
  ],
  tennis: [
    ['🤕 Your calf tightens up on a long rally.', ['Call the trainer', 'Shorten the points', 'Ignore it and chase everything'], '313', {miss: {energy: -15, games: -1, news: 'needed the trainer on court'}, hit: {engagement: 10}}],
    ['😤 A line call goes against you on a big point.', ['Let it go', 'Challenge the call', 'Argue with the umpire'], '320', {miss: {reputation: -2, games: -1}, hit: {engagement: 12}}],
  ],
  musician: [
    ['🎤 The mic cuts out mid-take!', ['Switch to the backup mic', 'Sing it unplugged to the room', 'Beatbox until it is fixed'], '203', {miss: {stability: -25}, hit: {engagement: 12}}],
    ['📈 A clip from the session is going viral online.', ['Stay focused on the song', 'Post a teaser to ride the wave', 'Go live from the booth'], '123', {miss: {engagement: -8}, hit: {engagement: 22, fame: 15, news: 'teased a studio session that went viral'}}],
  ],
  vlogger: [
    ['📵 Your phone storage is full mid-shoot.', ['Delete old clips quickly', 'Switch to a friend’s phone', 'Keep filming in low quality'], '211', {miss: {stability: -25}, hit: {engagement: 8}}],
    ['🤝 A brand rep spots you filming and offers a deal on the spot.', ['Take their card', 'Film a quick promo', 'Make them the star of the vlog'], '303', {miss: {reputation: -2, engagement: -8}, hit: {engagement: 18, fame: 15, news: 'landed a brand deal on camera'}}],
  ],
  video: [
    ['⚖️ A commenter accuses your video of a factual error.', ['Pin a correction', 'Double-check and reply', 'Make a response video'], '103', {miss: {reputation: -3, quality: -6, news: 'faced a fact-check storm'}, hit: {engagement: 12}}],
    ['📈 The algorithm starts pushing your last upload.', ['Keep to the schedule', 'Add an end-screen link', 'Rush out a follow-up'], '121', {miss: {stability: -15}, hit: {engagement: 20, fame: 15}}],
  ],
  skitmaker: [
    ['😬 Your co-star cracks up in every take.', ['Take a break', 'Keep the corpsing in', 'Improvise around it'], '301', {miss: {stability: -20}, hit: {engagement: 15}}],
    ['📈 A celebrity duets your last skit.', ['Say thank you', 'Reply with a skit', 'Invite them into this one'], '021', {miss: {engagement: -8}, hit: {engagement: 22, fame: 20, news: 'got a celebrity duet'}}],
  ],
  streamer: [
    ['🔌 NEPA takes the light mid-stream!', ['End the stream politely', 'Switch to the generator', 'Stream from your phone in the dark'], '121', {miss: {stability: -30, engagement: -10}, hit: {engagement: 10}}],
    ['🎉 A huge raid arrives: 2,000 new viewers!', ['Say welcome', 'Run a raid-only challenge', 'Shout every name'], '131', {miss: {engagement: -10}, hit: {engagement: 25, fame: 20, news: 'got raided by 2,000 viewers'}}],
  ],
  actor: [
    ['📰 Someone leaked your script pages to a blog.', ['Stay quiet', 'Tell the director', 'Joke about it on social'], '303', {miss: {reputation: -3, engagement: -10, news: 'had script pages leaked'}, hit: {engagement: 12}}],
    ['🪢 The stunt rig fails a safety check.', ['Wait for a new rig', 'Rework the scene with the director', 'Do it without the rig'], '320', {miss: {energy: -20, stability: -15}, hit: {engagement: 15}}],
  ],
  adult: [
    ['🔒 A preview leaks before release.', ['Issue a takedown', 'Release it early on your terms', 'Turn it into a teaser campaign'], '331', {miss: {reputation: -3, engagement: -12, news: 'had a preview leak'}, hit: {engagement: 15}}],
    ['📝 The studio tries to change your contract terms.', ['Sign it to keep the peace', 'Push back politely', 'Walk off set'], '333', {miss: {reputation: -2, quality: -6}, hit: {quality: 6}}],
  ],
  founder: [
    ['💸 Payroll is due and the bank transfer bounces.', ['Delay your own salary', 'Call an investor', 'Run a flash sale'], '332', {miss: {stability: -25, reputation: -2}, hit: {stability: 10}}],
    ['🔥 The servers crash during a demo.', ['Switch to the recorded demo', 'Talk through it with the team', 'Live-debug in front of them'], '210', {miss: {stability: -20, quality: -6}, hit: {engagement: 15}}],
  ],
  developer: [
    ['📞 The client escalates to your manager: the site is broken!', ['Apologise and roll back', 'Call the client and explain', 'Hotfix in production'], '031', {miss: {reputation: -3, quality: -6, news: 'got an angry client call'}, hit: {engagement: 12}}],
    ['🚨 A production outage at 5pm on a Friday.', ['Roll back the release', 'Read the logs with the team', 'Patch it live'], '110', {miss: {stability: -30, energy: -10}, hit: {stability: 15}}],
  ],
  web3: [
    ['🛡️ A white-hat reports an exploit in your contract.', ['Pause everything', 'Patch with the reporter', 'Patch it live on-chain'], '333', {miss: {stability: -30, reputation: -3, news: 'had an exploit scare'}, hit: {stability: 15}}],
    ['🗣️ A rug-pull rumour spreads on social media.', ['Post the audit', 'Host a voice chat', 'Lock the liquidity live'], '213', {miss: {engagement: -15}, hit: {engagement: 18}}],
  ],
};

// The two live meters on the activity card, named for each career: [engagement, stability].
export const METERS = {
  football: ['Crowd', 'Legs'], basketball: ['Crowd', 'Legs'], wrestling: ['Crowd heat', 'Stamina'], tennis: ['Crowd', 'Legs'],
  musician: ['Vibe', 'Mix'], vlogger: ['Hype', 'Footage'], video: ['Retention', 'Accuracy'], skitmaker: ['Laughs', 'Takes'],
  streamer: ['Chat', 'Stream'], actor: ['Director', 'Takes'], adult: ['Fans', 'Set'], founder: ['Investors', 'Runway'],
  developer: ['Client', 'Tests'], web3: ['Community', 'Security'],
};

// A title ladder for each career, one per tier (Newcomer → Icon).
export const CAREER_TITLES = {
  football: ['Academy player', 'Reserve', 'Starter', 'Captain', 'Legend'],
  basketball: ['Walk-on', 'Bench player', 'Starter', 'All-Star', 'Hall of Famer'],
  wrestling: ['Trainee', 'Undercard', 'Mid-carder', 'Main eventer', 'Hall of Famer'],
  tennis: ['Club player', 'Qualifier', 'Tour pro', 'Seeded star', 'Grand Slam champion'],
  musician: ['Bedroom artist', 'Opening act', 'Headliner', 'Chart-topper', 'Legend'],
  vlogger: ['New vlogger', 'Rising vlogger', 'Partner creator', 'Top vlogger', 'Icon'],
  video: ['New channel', 'Growing channel', 'Silver Play', 'Gold Play', 'Diamond Play'],
  skitmaker: ['Open-mic comic', 'Skit regular', 'Fan favourite', 'Comedy star', 'Comedy icon'],
  streamer: ['Lurker', 'Affiliate', 'Partner', 'Top streamer', 'Streaming icon'],
  actor: ['Extra', 'Bit part', 'Supporting role', 'Lead', 'Screen legend'],
  adult: ['Newcomer', 'Featured creator', 'Studio regular', 'Headliner', 'Icon'],
  founder: ['Idea stage', 'Pre-seed', 'Seed', 'Series A', 'Unicorn'],
  developer: ['Intern', 'Junior', 'Mid-level', 'Senior', 'CTO'],
  web3: ['Lurker', 'Contributor', 'Core dev', 'Protocol lead', 'Visionary'],
};
export const tierTitle = (career, tier) => CAREER_TITLES[career]?.[tier] || ['Newcomer', 'Emerging', 'Established', 'Star', 'Icon'][tier] || 'Newcomer';

// Reach in the units each career counts.
export const UNITS = {football: 'fans', basketball: 'fans', wrestling: 'fans', tennis: 'fans', musician: 'streams', vlogger: 'views', video: 'views', skitmaker: 'views', streamer: 'viewers', actor: 'tickets', adult: 'subscribers', founder: 'users', developer: 'users', web3: 'holders'};

// A one-line review after work, from whoever judges this career.
const JUDGES = {sport: 'Pundits', music: 'Critics', creator: 'Comments', acting: 'Critics', tech: 'Users'};
export function reviewLine(family, quality, story = [], win = null) {
  const stars = quality >= 85 ? 5 : quality >= 70 ? 4 : quality >= 55 ? 3 : quality >= 40 ? 2 : 1, hits = story.filter(s => s.success).length, bold = story.filter(s => s.risk === 'risky').length, last = story.at(-1);
  const note = win === 'Win' && last?.success ? 'clutch at the death' : win === 'Loss' ? 'beaten on the day, but there was fight' : hits === story.length && story.length ? 'flawless from start to finish' : bold >= 2 && hits >= story.length / 2 ? 'bold choices that paid off' : bold >= 2 ? 'bold choices, shaky execution' : last && !last.success ? 'strong start, shaky finish' : hits >= story.length / 2 ? 'solid and dependable' : 'a rough day at the office';
  return `${JUDGES[family] || 'Critics'}: ${'★'.repeat(stars)}${'☆'.repeat(5 - stars)} — ${note}`;
}
