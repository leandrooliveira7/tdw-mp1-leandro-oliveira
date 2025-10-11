function sum(a: number, b: number) {
  return a + b;
}

test('sum adds numbers correctly', () => {
  expect(sum(3, 4)).toBe(7);
});
