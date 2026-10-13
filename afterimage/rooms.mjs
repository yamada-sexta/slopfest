// Solutions use R/L/U/D for walking, . for waiting, and | for sealing an echo.
// These are checked by the engine tests; they also serve as optional hints.
export const rooms = [
  {
    name: 'A favor for yourself', subtitle: 'Your first conversation with the past.',
    rows: ['#########', '#S..A..E#', '#..a#####', '#########'],
    story: 'The door is closed. The little ring below it is a pressure plate. You cannot be in two places at once. But you can be in two times.',
    hint: 'Walk right twice and down onto a. Rewind. Walk right toward the exit; your ghost will arrive at the plate just in time.',
    solution: 'RRD|RRRRRR'
  },
  {
    name: 'The long way home', subtitle: 'Distance is just another kind of time.',
    rows: ['###########', '#S...#...E#', '#.##.#.####', '#a...A....#', '###########'],
    story: 'The shortest walk is the one you leave behind. Your echo keeps its final position after its recording ends.',
    hint: 'Record a short walk down twice to a. In your next life, follow the upper corridor right three times, down twice, then cross A. Beyond it, go right, up twice, and right three times.',
    solution: 'DD|RRRDDRRUURRR'
  },
  {
    name: 'Two promises', subtitle: 'An echo can help you make another echo.',
    rows: ['#############', '#S..A..B...E#', '#..a##b######', '#############'],
    story: 'One promise opens the first door. A second opens the next. Rewinding preserves every echo you have already recorded.',
    hint: 'First record R R D onto a. Use that echo to walk right five times, then down onto b. Rewind again. Now walk right all the way home.',
    solution: 'RRD|RRRRRD|RRRRRRRRRR'
  },
  {
    name: 'All together', subtitle: 'Some doors ask for more than one hand.',
    rows: ['############', '#S....A...E#', '#.#.#.######', '#a...a######', '############'],
    story: 'Two rings, one letter. Every plate with the same letter must be occupied. Sometimes the kindest thing to do is wait.',
    hint: 'Record D D to the left plate. Record R R R R D D to the right plate. Then go right four times, wait once, and cross the door when both echoes are ready.',
    solution: 'DD|RRRRDD|RRRR.RRRRR'
  },
  {
    name: 'A small orchestra', subtitle: 'Three pasts. One possible future.',
    rows: ['#################', '#S..A..B..C....E#', '#..a##b##c#######', '#################'],
    story: 'Leave a self at a. Leave a self at b. Leave a self at c. Walk through the future they made for you. A machine built out of favors.',
    hint: 'Record R R D. Record five rights and down. Record eight rights and down. With three echoes, take fourteen steps right.',
    solution: 'RRD|RRRRRD|RRRRRRRRD|RRRRRRRRRRRRRR'
  }
];
