export const specimens = Object.freeze([
  { name: 'Neighbor mixer', initial: [12, 34, 56, 78], source: `# Nothing lost. Not even one bit.
repeat 3
  add a b
  rol a 3
  xor c a
  swap b d
  mul d 13
  sub b c
end` },
  { name: 'Borrowed key', initial: [12, 34, 56, 78], source: `# Borrow b. Return it exactly.
add a b
not b
xor a b
not b
rol a 2` },
  { name: 'Carousel', initial: [12, 34, 56, 78], source: `# Everyone moves one seat.
swap a b
swap b c
swap c d` },
  { name: 'Over the edge', initial: [255, 0, 128, 85], source: `# Watch the edge of each byte.
add a 1
sub b 1
rol c 1
mul d 3
not a
xor b a` },
]);
