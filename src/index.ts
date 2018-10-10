import build from './build';
import parse from './parse';
import process from './process';

import { sortStrings, stringToValue } from './data';

const numericIfIndex = k => {
  const v = stringToValue(k);
  if (typeof v === 'number' && Math.floor(v) === v) return v;
  return k;
};

const diff = (prev, next) => {
  if (
    prev.type !== 'nil' &&
    (prev.type === 'table') !== (next.type === 'table')
  ) {
    return diff({ type: 'nil' }, next);
  }
  if (next.type !== 'table') {
    if (next.value === prev.value && next.set === prev.set) return undefined;
    return next.set
      ? { value: next.value || null, set: next.set }
      : next.value || null;
  }
  const p = prev.type === 'table' ? prev.value.values : {};
  const n = next.value.values;
  const pKeys = Object.keys(p).map(numericIfIndex);
  const nKeys = Object.keys(n).map(numericIfIndex);
  const result = Array.from(new Set([...pKeys, ...nKeys]))
    .sort((a, b) => sortStrings(`${a}`, `${b}`))
    .map(key => {
      if (n[key] === undefined) return { key };
      const prevKey = pKeys.find(k => (p[k].id || k) === (n[key].id || key));
      const prevValue = (p && prevKey && p[prevKey]) || { type: 'nil' };
      const d = diff(prevValue, n[key]);
      if (prevValue.type === 'nil' || key === prevKey) {
        return d === undefined ? undefined : { key, value: d };
      }
      return { key, value: d, ...(prevKey ? { prev: prevKey } : {}) };
    })
    .filter(x => x) as any[];
  return result.length === 0 ? undefined : result;
};

export default (script, output) => {
  let prev = process(
    {
      initial: [{ type: 'nil' }],
      output: (_, next) => {
        output(diff(prev, next));
        prev = next;
      },
    },
    queue => [build(queue, { scope: [0], current: [0] }, parse(script))],
  ).initial[0];
  output(diff({ type: 'nil' }, prev));
};