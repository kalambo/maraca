import maraca from '../../src/index';
import { fromObj } from '../../src/utils/block';

test('arithmetic', () => {
  expect(maraca('1 + 2')).toEqual({
    type: 'value',
    value: '3',
  });
  expect(maraca('5 - 1')).toEqual({
    type: 'value',
    value: '4',
  });
  expect(maraca('3 * 4')).toEqual({
    type: 'value',
    value: '12',
  });
  expect(maraca('5 / 2')).toEqual({
    type: 'value',
    value: '2.5',
  });
  expect(maraca('8 % 3')).toEqual({
    type: 'value',
    value: '2',
  });
  expect(maraca('5 % 5')).toEqual({
    type: 'value',
    value: '5',
  });
  expect(maraca('1 + hi')).toEqual({
    type: 'value',
    value: '',
  });
  expect(maraca('1 + [a, b, c]')).toEqual({
    type: 'value',
    value: '',
  });
});

test('negative', () => {
  expect(maraca('-20')).toEqual({
    type: 'value',
    value: '-20',
  });
  expect(maraca('-hello')).toEqual({
    type: 'value',
    value: '-hello',
  });
});

test('comparison', () => {
  expect(maraca('2 = 6')).toEqual({
    type: 'value',
    value: '',
  });
  expect(maraca('3 = 3')).toEqual({
    type: 'value',
    value: 'true',
  });
  expect(maraca('5 < 3')).toEqual({
    type: 'value',
    value: '',
  });
  expect(maraca('0 < 1')).toEqual({
    type: 'value',
    value: 'true',
  });
  expect(maraca('5 <= 5')).toEqual({
    type: 'value',
    value: 'true',
  });
  expect(maraca('8 > 2')).toEqual({
    type: 'value',
    value: 'true',
  });
  expect(maraca('1 >= 3')).toEqual({
    type: 'value',
    value: '',
  });

  expect(maraca('a < b')).toEqual({
    type: 'value',
    value: 'true',
  });
  expect(maraca('b < a')).toEqual({
    type: 'value',
    value: '',
  });
  expect(maraca('-b < -a')).toEqual({
    type: 'value',
    value: 'true',
  });
});

test('not', () => {
  expect(maraca('8 ! 2')).toEqual({
    type: 'value',
    value: 'true',
  });
  expect(maraca('! 3 < 5')).toEqual({
    type: 'value',
    value: '',
  });
});

test('size', () => {
  expect(maraca('#[a, b, c]')).toEqual({
    type: 'value',
    value: '3',
  });
  expect(maraca('#[a, , c, x: 1, y: ]')).toEqual({
    type: 'value',
    value: '3',
  });
  expect(maraca('#3')).toEqual({
    type: 'block',
    value: fromObj({
      1: { type: 'value', value: '1' },
      2: { type: 'value', value: '2' },
      3: { type: 'value', value: '3' },
    }),
  });
});
