import build from './build';
import parse from './parse';
import process, { createIndexer } from './process';
import { streamMap } from './core';

export { toData, toTypedValue } from './data';
export { default as parse } from './parse';

export const createMethod = (create, map, deep = false) => ({
  type: 'list',
  value: {
    indices: [],
    values: {},
    other: (index, value) => [
      create(createIndexer(index)(), ({ get, output }) => {
        const { initial, update } = map({
          initial: get(value, deep),
          output: value => output(value),
        });
        return { initial, update: () => update(get(value, deep)) };
      }),
    ],
  },
});

export default (config, code, output) => {
  const create = process();
  const indexer = createIndexer();
  const createdConfig = config(create, indexer);
  const modules = typeof code === 'string' ? { start: code } : code;
  const parsed = Object.keys(modules).reduce(
    (res, k) => ({ ...res, [k]: parse(modules[k]) }),
    {} as any,
  );
  const scope = {
    type: 'list',
    value: {
      indices: [],
      values: {},
      other: (index, value) => [
        streamMap(value => {
          const subIndexer = createIndexer(index);
          if (value.type !== 'value' || !parsed[value.value]) {
            return { type: 'nil' };
          }
          return build(
            createdConfig,
            create,
            subIndexer,
            {
              scope: [scope],
              current: [{ type: 'list', value: { indices: [], values: {} } }],
            },
            parsed[value.value],
          );
        })(create, index, [value]),
      ],
    },
  };
  const stream = build(
    createdConfig,
    create,
    indexer,
    {
      scope: [scope],
      current: [{ type: 'list', value: { indices: [], values: {} } }],
    },
    parsed.start,
  );
  const result = create(
    indexer(),
    ({ get, output }) => {
      const run = () => get(stream, true);
      return { initial: run(), update: () => output(run()) };
    },
    data => output(data),
  );
  const obj = {};
  result.value.observe(obj);
  const initial = result.value.value;
  const stop = () => result.value.unobserve(obj);
  if (!output) {
    stop();
    return initial;
  }
  output(initial);
  return stop;
};
