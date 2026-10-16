export const examples = [
  { id: 'marbles', name: 'The missing marble', note: 'Each worker adds one marble. Can you finish with only one in the jar?',
    source: '# A pocket is private. The jar is shared.\nshared jar = 0\n\nthread amber\n  load jar\n  add 1\n  store jar\nend\n\nthread blue\n  load jar\n  add 1\n  store jar\nend' },
  { id: 'key', name: 'One jar, one key', note: 'Each worker holds the same key while updating the jar. Explore the endings to see what changes.',
    source: '# A worker waits while another holds the key.\nshared jar = 0\nmutex brass\n\nthread amber\n  lock brass\n  load jar\n  add 1\n  store jar\n  unlock brass\nend\n\nthread blue\n  lock brass\n  load jar\n  add 1\n  store jar\n  unlock brass\nend' },
  { id: 'knot', name: 'Two keys, one knot', note: 'The workers take the keys in opposite orders. Can you leave both waiting forever?',
    source: '# Keys are taken in opposite orders.\nshared jar = 0\nmutex north\nmutex south\n\nthread amber\n  lock north\n  lock south\n  load jar\n  add 1\n  store jar\n  unlock south\n  unlock north\nend\n\nthread blue\n  lock south\n  lock north\n  load jar\n  add 1\n  store jar\n  unlock north\n  unlock south\nend' }
];
