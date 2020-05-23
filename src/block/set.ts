import { resolve } from '../index';
import {
  cloneBlock,
  createBlock,
  isResolved,
  print,
  toIndex,
  toPairs,
} from '../utils';

export const staticAppend = (block, value) => {
  if (!value.value) return block;
  return {
    ...block,
    indices: [...block.indices, value],
    ...(block.unresolved || !isResolved(value) ? { unresolved: true } : {}),
  };
};

export const staticSet = (block, value, key) => {
  const result = cloneBlock(block);
  if (!key) {
    if (isResolved(value)) {
      if (value.type === 'value') {
        result.values = {
          ...result.values,
          ['']: { key: { type: 'value', value: '' }, value },
        };
        return result;
      }
      result.values = { ...result.values, ...value.value.values };
      result.indices = [...result.indices, ...value.value.indices];
      return result;
    }
    result.streams = [...block.streams, { value }];
    result.indices = [...block.indices, { type: 'unpack', value }];
    result.unresolved = true;
    return result;
  }
  if (key.type === 'value') {
    result.values = { ...block.values, [print(key)]: { key, value } };
    if (!isResolved(value)) result.unresolved = true;
    return result;
  }
  result.streams = [...block.streams, { key, value }];
  result.unresolved = true;
  return result;
};

const extract = (block, keys, get) => {
  const rest = createBlock();
  rest.values = { ...block.values };
  rest.indices = block.indices
    .map((x) => resolve(x, get, false))
    .filter((x) => x.value);
  let maxIndex = 0;
  const values = keys.map((key) => {
    const k = print(key);
    const i = toIndex(k);
    if (i) {
      maxIndex = i;
      return rest.indices[i - 1] || { type: 'value', value: '' };
    }
    const v = (rest.values[k] && rest.values[k].value) || {
      type: 'value',
      value: '',
    };
    delete rest.values[k];
    return v;
  });
  rest.indices = rest.indices.slice(maxIndex);
  return { values, rest };
};

export const resolveSets = (pairs, get) =>
  pairs.reduce((res, { key: k, value: v }) => {
    if (!k) {
      const value = resolve(v, get, false);
      if (value.type === 'value') {
        return { ...res, ['']: { key: { type: 'value', value: '' }, value } };
      }
      return {
        ...res,
        ...value.value.values,
        ...resolveSets(value.value.streams, get),
      };
    }
    const key = resolve(k, get, true);
    if (key.type === 'block') {
      const value = resolve(v, get, false);
      if (value.type === 'block') {
        const keyPairs = toPairs(key.value);
        const func = key.value.func;
        const funcDefault = typeof func === 'object' && func;
        const { values, rest } = extract(
          value.value,
          keyPairs.map((d) => d.key),
          get,
        );
        const result = {
          ...res,
          ...resolveSets(
            values.map((v, i) => ({ key: keyPairs[i].value, value: v })),
            get,
          ),
        };
        if (!funcDefault) return result;
        return {
          ...result,
          [print(funcDefault)]: {
            key: funcDefault,
            value: { type: 'block', value: rest },
          },
        };
      }
    }
    return { ...res, [print(key)]: { key, value: v } };
  }, {});

export const resolveIndices = (indices, get) =>
  indices.reduce((res, x) => {
    if (x.type !== 'unpack') return [...res, x];
    const value = resolve(x.value, get, false);
    return value.type === 'block'
      ? [...res, ...resolveIndices(value.value.indices, get)]
      : res;
  }, []);

export const resolveBlock = (block, get) => {
  let result = createBlock();
  result.values = { ...block.values, ...resolveSets(block.streams, get) };
  result.indices = resolveIndices(block.indices, get);
  result.func = block.func;
  return result;
};

export const resolveDeep = (block, get) => {
  let result = createBlock();
  const values = { ...block.values, ...resolveSets(block.streams, get) };
  result.values = Object.keys(values).reduce(
    (res, k) => ({
      ...res,
      [k]: { key: values[k].key, value: resolve(values[k].value, get, true) },
    }),
    {},
  );
  result.indices = resolveIndices(block.indices, get)
    .map((x) => resolve(x, get, true))
    .filter((x) => x.value);
  result.func = block.func;
  return result;
};
