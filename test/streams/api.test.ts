import maraca from '../../src/index';
import { fromJs } from '../../src/data';
import Block from '../../src/block';

const testStream = (code, actions, values, done) => {
  let c = 0;
  const stop = maraca(code, (data) => {
    if (actions[c]) actions[c](data);
    if (values[c]) expect(data).toEqual(values[c]);
    if (!values[++c]) {
      setTimeout(() => stop());
      done();
    }
  });
};

test('basic', (done) => {
  testStream(
    '[x:~ 1]',
    [(data) => data.value.get(fromJs('x')).push(fromJs(2))],
    [
      {
        type: 'block',
        value: Block.fromPairs([
          {
            key: { type: 'value', value: 'x' },
            value: { type: 'value', value: '1', push: expect.any(Function) },
          },
        ] as any),
      },
      {
        type: 'block',
        value: Block.fromPairs([
          {
            key: { type: 'value', value: 'x' },
            value: {
              type: 'value',
              value: '2',
              push: expect.any(Function),
            },
          },
        ] as any),
      },
    ],
    done,
  );
});