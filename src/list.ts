import { fromJs } from './data';
import { Data } from './typings';
import { sortMultiple, toIndex } from './utils';

const toKey = ({ type, value }) => {
  if (type !== 'list') return value;
  return JSON.stringify({
    indices: value.indices.map(toKey),
    values: Object.keys(value.values).reduce(
      (res, k) => ({ ...res, [k]: toKey(value.values[k].value) }),
      {},
    ),
  });
};

const tryNumber = s => {
  const n = parseFloat(s);
  return !isNaN(s) && !isNaN(n) ? n : s;
};
const getMinus = v => {
  if (!v) return { minus: false, v };
  const minus = typeof v === 'number' ? v < 0 : v[0] === '-';
  if (!minus) return { minus, value: v };
  return { minus, value: typeof v === 'number' ? -v : v.slice(1) };
};
const sortStrings = (s1, s2): -1 | 0 | 1 => {
  if (s1 === s2) return 0;
  if (!s1) return -1;
  if (!s2) return 1;
  const n1 = tryNumber(s1);
  const n2 = tryNumber(s2);
  const m1 = getMinus(n1);
  const m2 = getMinus(n2);
  if (m1.minus !== m2.minus) return m1.minus ? -1 : 1;
  const dir = m1.minus ? -1 : 1;
  const t1 = typeof m1.value;
  const t2 = typeof m2.value;
  if (t1 === t2) {
    if (t1 === 'string') {
      return (dir * m1.value.localeCompare(m2.value)) as -1 | 0 | 1;
    }
    return (dir * (m1.value < m2.value ? -1 : 1)) as -1 | 0 | 1;
  }
  return (dir * (t1 === 'number' ? -1 : 1)) as -1 | 0 | 1;
};
const compare = (v1, v2): -1 | 0 | 1 => {
  if (v1.type !== v2.type) {
    return v1.type === 'value' || v2.type === 'list' ? -1 : 1;
  }
  if (v1.type === 'nil') return 0;
  if (v1.type === 'value') return sortStrings(v1.value, v2.value);
  const keys = Array.from(
    new Set([...Object.keys(v1.value.values), ...Object.keys(v2.value.values)]),
  ).sort((a, b) =>
    compare(
      (v1.value.values[a] || (v2 as any).value.values[a]).key,
      (v1.value.values[b] || (v2 as any).value.values[b]).key,
    ),
  );
  return sortMultiple(
    keys.map(
      k => (v1.value.values[k] && v1.value.values[k].value) || { type: 'nil' },
    ),
    keys.map(
      k => (v2.value.values[k] && v2.value.values[k].value) || { type: 'nil' },
    ),
    compare,
  );
};

const listUtils = {
  empty: () => ({ type: 'list', value: { values: {}, indices: [] } } as Data),
  fromPairs: pairs => {
    const result = { values: {}, indices: [] as number[] };
    pairs.forEach(({ key, value }) => {
      const i = toIndex(key);
      if (!i || value.type !== 'nil') {
        result.values[toKey(key)] = { key, value };
        if (i) result.indices.push(i);
      }
    });
    result.indices.sort((a, b) => a - b);
    return { type: 'list', value: result } as Data;
  },
  fromFunc: (func, isMap?) =>
    ({
      type: 'list',
      value: { values: {}, indices: [], func: Object.assign(func, { isMap }) },
    } as Data),
  fromArray: items =>
    ({
      type: 'list',
      value: {
        values: items.reduce(
          (res, v, i) => ({
            ...res,
            [i + 1]: { key: fromJs(i + 1), value: v },
          }),
          {},
        ),
        indices: items.map((_, i) => i + 1),
      },
    } as Data),

  toPairs: list =>
    Object.keys(list.value.values)
      .map(k => list.value.values[k])
      .sort((a, b) => compare(a.key, b.key)),
  cloneValues: list => ({
    type: 'list',
    value: {
      values: { ...list.value.values },
      indices: [...list.value.indices],
    },
  }),

  toData: list => ({ ...list, value: listUtils.toPairs(list) }),
  fromData: list => ({ ...list, value: listUtils.fromPairs(list.value) }),

  get: (list, key) => {
    const k = toKey(key);
    const v = list.value.values[k] && list.value.values[k].value;
    return v || list.value.func || { type: 'nil' };
  },
  extract: (list, keys) => {
    const rest = {
      values: { ...list.value.values },
      indices: [...list.value.indices],
    };
    const values = keys.map(key => {
      const k = toKey(key);
      const i = toIndex(k);
      const v = (rest.values[k] && rest.values[k].value) || { type: 'nil' };
      delete rest.values[k];
      if (i) rest.indices = rest.indices.filter(x => x !== i);
      return v;
    });
    const first = rest.indices[0] - 1;
    rest.indices.forEach((i, j) => {
      rest.values[i - first] = rest.values[i];
      delete rest.values[i];
      rest.indices[j] = i - first;
    });
    return { values, rest };
  },
  getFunc: list => list.value.func,

  map: (list, map) => {
    const result = listUtils.fromPairs(
      Object.keys(list.value.values).map(k => ({
        key: list.value.values[k].key,
        value: map(list.value.values[k].value, list.value.values[k].key),
      })),
    ) as any;
    result.set = list.set;
    result.value.func = list.value.func;
    return result;
  },

  clearIndices: list => {
    const values = { ...list.value.values };
    list.value.indices.forEach(i => {
      delete values[i];
    });
    return { ...list, value: { values, indices: [], func: list.value.func } };
  },
  append: (list, value) => {
    const i = (list.value.indices[list.value.indices.length - 1] || 0) + 1;
    return {
      ...list,
      value: {
        values: { ...list.value.values, [i]: { key: fromJs(i), value } },
        indices: [...list.value.indices, i],
        func: list.value.func,
      },
    };
  },
  set: (list, key, value) => {
    const k = toKey(key);
    const i = toIndex(k);
    return {
      ...list,
      value: {
        values: { ...list.value.values, [k]: { key, value } },
        indices:
          i && !list.value.indices.includes(i)
            ? [...list.value.indices, i].sort((a, b) => a - b)
            : list.value.indices,
        func: list.value.func,
      },
    };
  },
  merge: (list1, list2) =>
    listUtils.fromPairs([
      ...listUtils.toPairs(list1),
      ...listUtils.toPairs(list2),
    ]),
  setFunc: (list, func, isMap?) => ({
    ...list,
    value: { ...list.value, func: Object.assign(func, { isMap }) },
  }),
};

export default listUtils;

// const listValue = list.value || { indices: [], values: {} };
// const res = { ...listValue };
// const objKey = toKey(key);
// if (typeof objKey === 'number') {
//   res.indices = [...res.indices];
//   res.indices[objKey] = v;
// } else {
//   res.values = { ...res.values };
//   res.values[objKey] = { key, value: v };
// }
// return { type: 'list', value: res };