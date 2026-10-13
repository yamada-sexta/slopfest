export const specimens = [
  { name: 'The patient fern', note: 'A word that grows a little more like a plant with every telling.',
    source: '# A recursive fern\nseed X\nangle 25\ndepth 6\nstep 5\n\nrule X -> F[+X][-X]FX.\nrule F -> FF' },
  { name: 'A coral conversation', note: 'Two branches disagree about which way is up. Both are right.',
    source: '# Branches end in warm little buds\nseed F\nangle 22\ndepth 5\nstep 8\n\nrule F -> F[+F.]F[-F.][F.]' },
  { name: 'Snow in slow motion', note: 'A triangular seed replaces every straight line with a detour.',
    source: '# A Koch snowflake\nseed F--F--F\nangle 60\ndepth 4\nstep 4\n\nrule F -> F+F--F+F' },
  { name: 'A room full of turns', note: 'A Hilbert curve folds a single line into almost every corner of a room.',
    source: '# X and Y are silent: they guide rewriting\nseed X\nangle 90\ndepth 5\nstep 7\n\nrule X -> +YF-XFX-FY+\nrule Y -> -XF+YFY+FX-' },
  { name: 'The dragon remembers', note: 'Two silent symbols trade places. A paper-folding dragon emerges.',
    source: '# The Heighway dragon\nseed FX\nangle 90\ndepth 8\nstep 7\n\nrule X -> X+YF+\nrule Y -> -FX-Y' }
];
