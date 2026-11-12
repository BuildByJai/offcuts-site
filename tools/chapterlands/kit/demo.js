// Sample settings for every template, for trying them out without a book:
//   street/?demo=CLIMB | CHASE | COLLECT | SNEAK | PUZZLE | BUILD |
//                ARCADE-rhythm | ARCADE-paddle | ARCADE-catch | ARCADE-golf | ARCADE-dodge | ARCADE-typeset
// Demo runs never save progress or pay coins.
export const DEMO = {
  book: { id: 'demo', title: 'Template demo', quarter: 'fantasy', level: 1, readable: false, contentPath: null },
  kit: { theme: { palette: {}, props: ['tree', 'bush', 'flower', 'rock', 'mushroom'] }, streets: [] },
  streets: {
    CLIMB: { id: 'd-climb', name: 'Demo: CLIMB', template: 'CLIMB', game: 'Climb', how: 'Jump from ledge to ledge to the top. Some ledges fade.',
      params: { height: 16, layout: 'spiral', core: 'tower', fade: true, moving: 1, collect: { item: { name: 'Star', icon: '⭐' }, count: 4 } } },
    'CLIMB-down': { id: 'd-climb2', name: 'Demo: CLIMB (down)', template: 'CLIMB', game: 'Fall', how: 'Drift down the well and grab the jars on the way.',
      params: { height: 18, core: 'shaft', direction: 'down', floaty: true, collect: { item: { name: 'Marmalade', icon: '🍯' }, count: 5, need: 3 } } },
    CHASE: { id: 'd-chase', name: 'Demo: CHASE', template: 'CHASE', game: 'Chase', how: 'Follow the rabbit to the end. Jump the hurdles and gaps.',
      params: { mode: 'follow', length: 110, obstacles: ['hurdle', 'block', 'gap', 'log'], target: { kind: 'rabbit', name: 'the rabbit' }, collect: { item: { name: 'Carrot', icon: '🥕' }, count: 5 } } },
    'CHASE-flee': { id: 'd-chase2', name: 'Demo: CHASE (flee)', template: 'CHASE', game: 'Run!', how: 'Something is after you. Keep going!',
      params: { mode: 'flee', length: 100, obstacles: ['hurdle', 'block', 'low'], chaser: { kind: 'horse', name: 'the horse', look: { coat: 0x6a4a3a } } } },
    'CHASE-loop': { id: 'd-chase3', name: 'Demo: CHASE (loop)', template: 'CHASE', game: 'Race round', how: 'Run two laps.',
      params: { mode: 'loop', laps: 2, racers: [{ kind: 'rabbit', name: 'Rabbit' }, { kind: 'person', name: 'Runner', look: { shirt: 0x2f7fd6 } }] } },
    COLLECT: { id: 'd-collect', name: 'Demo: COLLECT', template: 'COLLECT', game: 'Find them', how: 'Find all the toys, then talk to the horse.',
      params: { area: [40, 40], item: { name: 'Toy', icon: '🧸' }, count: 6, label: 'toys found', finale: { npc: { kind: 'horse', name: 'the Horse', look: { rocker: true } }, say: 'You found them all!' } } },
    'COLLECT-water': { id: 'd-collect2', name: 'Demo: COLLECT (water)', template: 'COLLECT', game: 'Cross the flood', how: 'Hop across the floating things and collect the keys.',
      params: { floor: 'water', area: [30, 60], item: { name: 'Key', icon: '🔑' }, count: 4, label: 'keys' } },
    SNEAK: { id: 'd-sneak', name: 'Demo: SNEAK', template: 'SNEAK', game: 'Sneak', how: 'Get to the door without being seen. Hide in bushes.',
      params: { watchers: 3, hides: 6, goal: { name: 'door', icon: '🚪' }, watcher: { kind: 'person', name: 'the guard', look: { shirt: 0x2b3442 } } } },
    PUZZLE: { id: 'd-puzzle', name: 'Demo: PUZZLE', template: 'PUZZLE', game: 'Puzzle room', how: 'Read the clues, then open the safe.',
      params: { clues: [{ object: 'clock', label: 'Clock', text: 'The clock has stopped at 4.' }, { object: 'picture', label: 'Picture', text: 'Two ducks on a pond.' }, { object: 'book', label: 'Book', text: 'Page 7 is folded down.' }],
        solve: { object: 'safe', label: 'The safe', type: 'code', prompt: 'Clock, picture, book — in that order.', answer: '427', hint: 'Each clue gives one number.' } } },
    'PUZZLE-mirror': { id: 'd-puzzle2', name: 'Demo: PUZZLE (mirror)', template: 'PUZZLE', game: 'Mirror room', how: 'Your controls are back to front!',
      params: { invert: 'x', clues: [{ object: 'mirror', label: 'Mirror', text: 'Everything is reversed here.' }], solve: { type: 'order', prompt: 'Put them back the right way round.', items: ['One', 'Two', 'Three'] } } },
    BUILD: { id: 'd-build', name: 'Demo: BUILD', template: 'BUILD', game: 'Set the table', how: 'Carry each thing to its place.',
      params: { items: [{ id: 'cup', name: 'the cup', icon: '☕' }, { id: 'cake', name: 'the cake', icon: '🎂' }, { id: 'plate', name: 'the plate', icon: '🍽️' }],
        slots: [{ id: 's1', name: 'Cup spot', accepts: ['cup'] }, { id: 's2', name: 'Cake stand', accepts: ['cake'] }, { id: 's3', name: 'Plate spot', accepts: ['plate'] }], hint: 'Read the labels.' } },
    'ARCADE-rhythm': { id: 'd-a1', name: 'Demo: rhythm', template: 'ARCADE', game: 'Rhythm', how: 'Hit the notes in time.', params: { mode: 'rhythm', duration: 25, icons: ['🦞', '🐢', '🎵'] } },
    'ARCADE-paddle': { id: 'd-a2', name: 'Demo: paddle', template: 'ARCADE', game: 'Row', how: 'Steer round the rocks.', params: { mode: 'paddle', duration: 30, good: [{ icon: '🌾', name: 'rushes' }], bad: [{ icon: '🪨', name: 'rock' }] } },
    'ARCADE-catch': { id: 'd-a3', name: 'Demo: catch', template: 'ARCADE', game: 'Catch', how: 'Catch the cake, not the pans.', params: { mode: 'catch', target: 10, good: [{ icon: '🍰', name: 'cake' }], bad: [{ icon: '🍳', name: 'pan' }] } },
    'ARCADE-golf': { id: 'd-a4', name: 'Demo: golf', template: 'ARCADE', game: 'Croquet', how: 'Through the hoop, then to the flag.', params: { mode: 'golf', holes: 2 } },
    'ARCADE-dodge': { id: 'd-a5', name: 'Demo: dodge', template: 'ARCADE', game: 'Dodge', how: 'Dodge the pepper!', params: { mode: 'dodge', duration: 20, bad: [{ icon: '🌶️', name: 'pepper' }, { icon: '🍳', name: 'pan' }] } },
    'ARCADE-typeset': { id: 'd-a6', name: 'Demo: typeset', template: 'ARCADE', game: 'Typeset', how: 'Set the letters in order.', params: { mode: 'typeset', words: ['ORDER', 'THRIFT'] } }
  }
};
