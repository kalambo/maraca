import * as moo from 'moo';
import * as dedent from 'dedent';

const toData = s => (s ? { type: 'value', value: s } : { type: 'nil' });

export default moo.compile({
  multi: ['=>>', '=>', '<=', '>=', '==', ':=?', ':=', '::', '##', '@@'],
  brackets: ['[', ']', '(', ')', '{', '}'],
  comparison: ['<', '>', '='],
  arithmetic: ['+', '-', '*', '/', '%', '^'],
  misc: [',', '?', ':', '~', '&', '!', '#', '@', '.'],
  value: {
    match: /(?:\d*\.\d+)|(?:[a-zA-Z0-9]+)|(?:\d+)/,
    value: s => toData(s),
  },
  string: {
    match: /"(?:\\["\\]|[^"\\])*"/,
    value: s =>
      toData(
        dedent(
          s
            .slice(1, -1)
            .replace(/\\\\/g, '\\')
            .replace(/\\"/g, '"'),
        ),
      ),
  },
  _: { match: /\s+/, lineBreaks: true },
});