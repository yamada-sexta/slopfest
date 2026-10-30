export const specimens = Object.freeze([
  { name: 'The scenic countdown', file: 'countdown', source: '   /:-\\\n\n@3:>  ?\n      #\n', input: '', note: 'Follow the pocket from 3 down to 0. A question turns left until zero gives it a reason to turn right.' },
  { name: 'A small greeting', file: 'hello', source: '@9***.+.4***+.#\n', input: '', note: 'Three doublings turn 9 into 72: the byte for H. The whole greeting takes fifteen tiles.' },
  { name: 'An echo takes a walk', file: 'echo', source: ' /.\\\n\n@>,?\n   #\n', input: 'scenic route', note: 'Every nonzero input byte takes a lap through the dot. End of input puts zero in the pocket and turns toward the exit.' },
  { name: 'One little forever', file: 'forever', source: '@>:v\n ^ <\n', input: '', note: 'Two steps lead into a six-step loop. The full cursor and pocket repeat, and so does the output.' },
]);
