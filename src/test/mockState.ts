import { ReadShape, Schema, reducer, __INTERNAL__ } from '..';
const { initialState } = __INTERNAL__;

export interface Fixture {
  request: ReadShape<Schema, object, any>;
  params: object;
  result: any;
}

export default function mockInitialState<
  S extends Schema,
  Params extends Readonly<object> = Readonly<object>,
  Body extends Readonly<object> | void = Readonly<object> | undefined
>(results: Fixture[]) {
  const now = Date.now();
  const mockState = results.reduce((acc, { request, params, result }) => {
    const { schema, getFetchKey } = request;
    const url = getFetchKey(params);
    return reducer(acc, {
      type: 'rest-hooks/receive',
      payload: result,
      meta: { schema, url, date: now, expiresAt: now * 2 },
    });
  }, initialState);
  return mockState;
}
