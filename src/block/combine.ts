import {
  fromPairs,
  mergeMap,
  printValue,
  resolveType,
  toIndex,
  wrapStream,
} from '../utils';

import blockGet from './get';
import { staticSet, toPairs } from './set';

const getValueType = (v) => {
  if (v.type === 'value') return 'value';
  if (!v.value.func) return 'block';
  return v.value.func.isMap ? 'map' : 'func';
};
const getType = (s, get) => {
  const v = resolveType(s, get);
  return { type: getValueType(v), value: v, stream: s };
};
const sortTypes = (s1, s2, get) => {
  const [t1, t2] = [getType(s1, get), getType(s2, get)];
  for (const t of ['map', 'func', 'block']) {
    if (t1.type === t) return [t1, t2];
    if (t2.type === t) return [t2, t1];
  }
  return [t1, t2];
};

const combineConfig = ([s1, s2]: any[], get) => {
  const [big, small] = sortTypes(s1, s2, get);
  if (big.type === 'value') return ['nil'];
  if (big.type === 'map') {
    if (small.type !== 'block') return ['nil'];
    return ['map', big.value, small.value];
  }
  if (big.type === 'func') {
    if (['func', 'map'].includes(small.type)) return ['nil'];
    const func = big.value.value.func;
    const res = blockGet(big.value.value, small.value, get);
    if (res === func && typeof func !== 'function') return ['value', func];
    if (res === func || !resolveType(res, get).value) {
      return ['func', func, small.stream];
    }
    return ['value', res];
  }
  if (small.type !== 'value') return ['nil'];
  return ['value', blockGet(big.value.value, small.value, get)];
};

const combineRun = ([type, ...config]: any[], get, create) => {
  if (type === 'nil') return { type: 'value', value: '' };
  if (type === 'value') return config[0];
  if (type === 'func') {
    const [func, arg] = config;
    return func(create, arg);
  }
  const [big, small] = config;
  const func = big.value.func;
  if (func.isUnpack) {
    const result = { ...big.value };
    delete result.func;
    return {
      type: 'block',
      value: toPairs(small.value, get)
        .map(({ key, value }) => func(key)(create, value))
        .reduce((res, v) => staticSet(res, v, null), result),
    };
  }
  return {
    type: 'block',
    value: fromPairs(
      [
        ...toPairs(big.value, get),
        ...toPairs(small.value, get).map(({ key, value }) =>
          func(key)(create, value),
        ),
      ],
      get,
    ),
  };
};

export default (create, args) => {
  if (args.every((a) => ['value', 'block'].includes(a.type))) {
    const [big, small] = sortTypes(args[0], args[1], (x) => x);
    if (big.type === 'value') return { type: 'value', value: '' };
    if (big.type === 'block' && small.type === 'value') {
      const block = big.value.value;
      const i = toIndex(small.value.value);
      if (i) {
        const v1 = i === 1 && block.indices[0];
        if (v1) return v1;
      } else {
        const k = printValue(small.value.value);
        const v2 = block.values[k] && block.values[k].value;
        if (v2) return v2;
      }
    }
  }

  return mergeMap(
    args,
    (args, get) => combineRun(combineConfig(args, get), get, null),
    create &&
      (() =>
        create((set, get) => {
          let result;
          let prev = [] as any[];
          return () => {
            const next = combineConfig(args, get);
            if (
              prev.length !== next.length ||
              prev.some((x, i) => x !== next[i])
            ) {
              if (result && result.type === 'stream') result.value.cancel();
              result = wrapStream(create, combineRun(next, get, create));
              set(result);
              prev = next;
            }
          };
        })),
  );
};
