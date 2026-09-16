import { assignYAxes } from './yAxes';

describe('assignYAxes', () => {
  it('puts everything on the primary axis while there is one quantity', () => {
    expect(assignYAxes(['ct', 'ct'])).toEqual({ index: [0, 0], overflow: [], hasSecondary: false });
  });

  it('gives the second quantity the secondary axis, in first-seen order', () => {
    expect(assignYAxes(['ct', 'm/s', 'ct', 'm/s'])).toEqual({
      index: [0, 1, 0, 1],
      overflow: [],
      hasSecondary: true,
    });
  });

  it('a third quantity shares the primary axis and is reported', () => {
    expect(assignYAxes(['ct', 'm/s', 'mag', 'ct', 'deg'])).toEqual({
      index: [0, 1, 0, 0, 0],
      overflow: [2, 4],
      hasSecondary: true,
    });
  });

  it('handles no series', () => {
    expect(assignYAxes([])).toEqual({ index: [], overflow: [], hasSecondary: false });
  });
});
