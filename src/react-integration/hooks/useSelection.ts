import { useContext, useMemo } from 'react';

import { StateContext } from '~/react-integration/context';
import { State } from '~/types';

/** Use selector to access part of state */
export default function useSelectionUnstable<
  Params extends Readonly<object> | Readonly<object>[],
  F extends (state: State<unknown>, params: Params) => any
>(
  select: F,
  params: Params | null,
  paramSerializer: (p: Params) => string,
): ReturnType<F> | null {
  const state = useContext(StateContext);
  // TODO: if this is identical to before and render was triggered by state update,
  // we should short-circuit entire rest of render

  // params must be serialized in check
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resource = useMemo(() => params && select(state, params), [
    params && paramSerializer(params),
    select,
    state,
  ]);
  return resource;
}
