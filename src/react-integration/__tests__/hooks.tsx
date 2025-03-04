import React, { Suspense, useEffect } from 'react';
import { render, wait } from 'react-testing-library';
import { cleanup, renderHook } from 'react-hooks-testing-library';
import nock from 'nock';
import { normalize } from '../../resource';

import { DispatchContext, StateContext } from '../context';
import {
  CoolerArticleResource,
  UserResource,
  PaginatedArticleResource,
  StaticArticleResource,
  InvalidIfStaleArticleResource,
} from '../../__tests__/common';
import {
  useFetcher,
  useRetrieve,
  useResource,
  useCache,
  useResultCache,
  useInvalidator,
} from '../hooks';
import { initialState } from '../../state/reducer';
import { State, ActionTypes } from '../../types';
import { Resource, Schema } from '../../resource';
import { ReadShape } from '../../resource';
import makeRenderRestHook from '../../test/makeRenderRestHook';
import {
  makeCacheProvider,
} from '../../test/providers';

async function testDispatchFetch(
  Component: React.FunctionComponent<any>,
  payloads: any[],
) {
  const dispatch = jest.fn();
  const tree = (
    <DispatchContext.Provider value={dispatch}>
      <Suspense fallback={null}>
        <Component />
      </Suspense>
    </DispatchContext.Provider>
  );
  render(tree);
  expect(dispatch).toHaveBeenCalled();
  expect(dispatch.mock.calls.length).toBe(payloads.length);
  let i = 0;
  for (const call of dispatch.mock.calls) {
    expect(call[0]).toMatchSnapshot();
    const action = call[0];
    const res = await action.payload();
    expect(res).toEqual(payloads[i]);
    i++;
  }
}

function testRestHook(
  callback: () => void,
  state: State<unknown>,
  dispatch = (v: ActionTypes) => {},
) {
  return renderHook(callback, {
    wrapper: function Wrapper({ children }) {
      return (
        <DispatchContext.Provider value={dispatch}>
          <StateContext.Provider value={state}>
            {children}
          </StateContext.Provider>
        </DispatchContext.Provider>
      );
    },
  });
}

function buildState<S extends Schema>(
  payload: any,
  fetchShape: ReadShape<S, any, any>,
  params: object,
): State<Resource> {
  const { entities, result } = normalize(payload, fetchShape.schema);
  const url = fetchShape.getFetchKey(params);
  return {
    entities,
    results: {
      [url]: result,
    },
    meta: {
      [url]: {
        date: Date.now(),
        expiresAt: Date.now() + 10000,
      },
    },
  };
}

afterEach(() => {
  cleanup();
});

const payload = {
  id: 5,
  title: 'hi ho',
  content: 'whatever',
  tags: ['a', 'best', 'react'],
};

const articlesPages = {
  prevPage: '23asdl',
  nextPage: 's3f3',
  results: [
    {
      id: 23,
      title: 'the first draft',
      content: 'the best things in life com efree',
      tags: ['one', 'two'],
    },
    {
      id: 44,
      title: 'the second book',
      content: 'the best things in life com efree',
      tags: ['hbh', 'wew'],
    },
    {
      id: 2,
      title: 'the third novel',
      content: 'the best things in life com efree',
      tags: ['free', 'honey'],
    },
    {
      id: 643,
      title: 'a long time ago',
      content: 'the best things in life com efree',
    },
  ],
};

const users = [
  {
    id: 23,
    username: 'bob',
    email: 'bob@bob.com',
    isAdmin: false,
  },
  {
    id: 7342,
    username: 'lindsey',
    email: 'lindsey@bob.com',
    isAdmin: true,
  },
];

function ArticleComponentTester({ invalidIfStale = false }) {
  const resource = invalidIfStale
    ? InvalidIfStaleArticleResource
    : CoolerArticleResource;
  const article = useResource(resource.detailShape(), {
    id: payload.id,
  });
  return (
    <div>
      <h3>{article.title}</h3>
      <p>{article.content}</p>
    </div>
  );
}

describe('useFetcher', () => {
  const payload = { id: 1, content: 'hi' };

  it('should dispatch an action that fetches a create', async () => {
    nock('http://test.com')
      .post(`/article-cooler/`)
      .reply(201, payload);

    function DispatchTester() {
      const a = useFetcher(CoolerArticleResource.createShape());
      a({ content: 'hi' }, {});
      return null;
    }
    await testDispatchFetch(DispatchTester, [payload]);
  });
  it('should dispatch an action that fetches a partial update', async () => {
    nock('http://test.com')
      .patch(`/article-cooler/1`)
      .reply(200, payload);

    function DispatchTester() {
      const a = useFetcher(CoolerArticleResource.partialUpdateShape());
      a({ content: 'changed' }, { id: payload.id });
      return null;
    }
    await testDispatchFetch(DispatchTester, [payload]);
  });
  it('should dispatch an action that fetches a full update', async () => {
    nock('http://test.com')
      .put(`/article-cooler/1`)
      .reply(200, payload);

    function DispatchTester() {
      const a = useFetcher(CoolerArticleResource.updateShape());
      a({ content: 'changed' }, { id: payload.id });
      return null;
    }
    await testDispatchFetch(DispatchTester, [payload]);
  });
});

describe('useInvalidate', () => {
  it('should not invalidate anything if params is null', () => {
    const state = buildState(
      articlesPages,
      PaginatedArticleResource.listShape(),
      {},
    );
    const dispatch = jest.fn();
    let invalidate: any;
    testRestHook(
      () => {
        invalidate = useInvalidator(PaginatedArticleResource.listShape());
      },
      state,
      dispatch,
    );
    invalidate(null);
    expect(dispatch).not.toHaveBeenCalled();
  });
  it('should return a function that dispatches an action to invalidate a resource', () => {
    const state = buildState(
      articlesPages,
      PaginatedArticleResource.listShape(),
      {},
    );
    const dispatch = jest.fn();
    let invalidate: any;
    testRestHook(
      () => {
        invalidate = useInvalidator(PaginatedArticleResource.listShape());
      },
      state,
      dispatch,
    );
    invalidate({});
    expect(dispatch).toHaveBeenCalledWith({
      type: 'rest-hooks/invalidate',
      meta: {
        url: 'GET http://test.com/article-paginated/',
      },
    });
  });
  it('should return the same === function each time', async () => {
    const track = jest.fn();

    const { rerender } = renderHook(() => {
      const invalidate = useInvalidator(PaginatedArticleResource.listShape());
      useEffect(track, [invalidate]);
    });
    expect(track.mock.calls.length).toBe(1);
    for (let i = 0; i < 4; ++i) {
      rerender();
    }
    expect(track.mock.calls.length).toBe(1);
  });
});

describe('useCache', () => {
  it('should select singles', async () => {
    let article: any;
    let state = { ...initialState };
    const { rerender } = renderHook(
      () =>
        (article = useCache(CoolerArticleResource.detailShape(), payload)),
      {
        wrapper: function Wrapper({ children }) {
          return (
            <StateContext.Provider value={state}>
              {children}
            </StateContext.Provider>
          );
        },
      },
    );
    expect(article).toBe(null);
    state = buildState(payload, CoolerArticleResource.detailShape(), payload);
    rerender();
    expect(article).toBeTruthy();
    expect(article.title).toBe(payload.title);
  });

  it('should select paginated results', async () => {
    const state = buildState(
      articlesPages,
      PaginatedArticleResource.listShape(),
      {},
    );
    let articles: any;
    testRestHook(() => {
      articles = useCache(PaginatedArticleResource.listShape(), {});
    }, state);
    expect(articles).toBeDefined();
    expect(articles.length).toBe(articlesPages.results.length);
    expect(articles[0]).toBeInstanceOf(PaginatedArticleResource);
    expect(articles).toMatchSnapshot();
  });

  it('should return identical value no matter how many re-renders', async () => {
    const track = jest.fn();

    const { rerender } = renderHook(() => {
      const article = useCache(PaginatedArticleResource.listShape(), {});
      useEffect(track, [article]);
    });

    expect(track.mock.calls.length).toBe(1);
    for (let i = 0; i < 2; ++i) {
      rerender();
    }
    expect(track.mock.calls.length).toBe(1);
  });
});

describe('useResultCache', () => {
  it('should be null with nothing in state', () => {
    let results: any;
    let state = { ...initialState };
    const { rerender } = testRestHook(() => {
      results = useResultCache(PaginatedArticleResource.listShape(), {});
    }, state);
    expect(results).toBe(null);
  });

  it('should send defaults with nothing in state', () => {
    let results: any;
    let state = { ...initialState };
    const defaults = { prevPage: '', nextPage: '' };
    testRestHook(() => {
      results = useResultCache(
        PaginatedArticleResource.listShape(),
        {},
        defaults,
      );
    }, state);
    expect(results).toEqual(defaults);
  });

  it('should find results', async () => {
    const state = buildState(
      articlesPages,
      PaginatedArticleResource.listShape(),
      {},
    );
    let results: any;
    testRestHook(() => {
      results = useResultCache(PaginatedArticleResource.listShape(), {});
    }, state);
    expect(results).toBeTruthy();
    expect(results.nextPage).toBe(articlesPages.nextPage);
    expect(results.prevPage).toBe(articlesPages.prevPage);
    expect(results.results).toEqual(['23', '44', '2', '643']);
  });

  it('should return identical value no matter how many re-renders', async () => {
    const track = jest.fn();

    const { rerender } = renderHook(() => {
      const results = useResultCache(
        PaginatedArticleResource.listShape(),
        {},
      );
      useEffect(track, [results]);
    });

    expect(track.mock.calls.length).toBe(1);
    for (let i = 0; i < 2; ++i) {
      rerender();
    }
    expect(track.mock.calls.length).toBe(1);
  });
});

describe('useRetrieve', () => {
  beforeEach(() => {
    nock('http://test.com')
      .get(`/article-cooler/${payload.id}`)
      .reply(200, payload);
    nock('http://test.com')
      .get(`/article-static/${payload.id}`)
      .reply(200, payload);
    nock('http://test.com')
      .get(`/user/`)
      .reply(200, users);
  });

  it('should dispatch singles', async () => {
    function FetchTester() {
      useRetrieve(CoolerArticleResource.detailShape(), payload);
      return null;
    }
    await testDispatchFetch(FetchTester, [payload]);
  });

  it('should not dispatch will null params', async () => {
    const dispatch = jest.fn();
    let params: any = null;
    const { rerender } = testRestHook(
      () => {
        useRetrieve(CoolerArticleResource.detailShape(), params);
      },
      initialState,
      dispatch,
    );
    expect(dispatch).toBeCalledTimes(0);
    params = payload;
    rerender();
    expect(dispatch).toBeCalled();
  });

  it('should dispatch with resource defined dataExpiryLength', async () => {
    function FetchTester() {
      useRetrieve(StaticArticleResource.detailShape(), payload);
      return null;
    }
    await testDispatchFetch(FetchTester, [payload]);
  });

  it('should dispatch with fetch shape defined dataExpiryLength', async () => {
    function FetchTester() {
      useRetrieve(StaticArticleResource.longLivingRequest(), payload);
      return null;
    }
    await testDispatchFetch(FetchTester, [payload]);
  });

  it('should dispatch with fetch shape defined errorExpiryLength', async () => {
    function FetchTester() {
      useRetrieve(StaticArticleResource.neverRetryOnErrorRequest(), payload);
      return null;
    }
    await testDispatchFetch(FetchTester, [payload]);
  });
});

describe('useResource()', () => {
  let fbmock = jest.fn();

  function Fallback() {
    fbmock();
    return null;
  }

  beforeEach(() => {
    nock('http://test.com')
      .get(`/article-cooler/${payload.id}`)
      .reply(200, payload);
    nock('http://test.com')
      .get(`/user/`)
      .reply(200, users);
  });

  it('should dispatch an action that fetches', async () => {
    await testDispatchFetch(ArticleComponentTester, [payload]);
  });

  it('should dispatch fetch when sent multiple arguments', async () => {
    function MultiResourceTester() {
      const [article, user] = useResource(
        [
          CoolerArticleResource.detailShape(),
          {
            id: payload.id,
          },
        ],
        [UserResource.listShape(), {}],
      );
      return null;
    }
    await testDispatchFetch(MultiResourceTester, [payload, users]);
  });
  it('should throw same promise until both resolve', async () => {
    const renderRestHook = makeRenderRestHook(makeCacheProvider);
    jest.useFakeTimers();
    nock('http://test.com')
      .get(`/article-cooler/${payload.id}`)
      .delay(1000)
      .reply(200, payload);
    nock('http://test.com')
      .get(`/user/`)
      .delay(2000)
      .reply(200, users);

    function MultiResourceTester() {
      try {
        const [article, user] = useResource(
          [
            CoolerArticleResource.detailShape(),
            {
              id: payload.id,
            },
          ],
          [UserResource.listShape(), {}],
        );
        return article;
      } catch (e) {
        if (typeof e.then === 'function') {
          return e;
        } else {
          // TODO: we're not handling suspense properly so react complains
          // When upgrading test util we should be able to fix this as we'll suspense ourselves.
          if (e.name === 'Invariant Violation') {
            return null;
          } else {
            throw e;
          }
        }
      }
    }
    const { rerender, result, waitForNextUpdate } = renderRestHook(
      MultiResourceTester,
    );
    const firstPromise = result.current;
    jest.advanceTimersByTime(50);
    rerender();
    expect(result.current).toBe(firstPromise);
    jest.advanceTimersByTime(1000);
    rerender();
    expect(result.current).toBe(firstPromise);
    jest.advanceTimersByTime(2000);
    rerender();
    expect(result.current).toBe(firstPromise);

    // TODO: we're not handling suspense properly so react complains
    // When upgrading test util we should be able to fix this as we'll suspense ourselves.
    const oldError = console.error;
    console.error = () => {};
    jest.runAllTimers();
    await result.current;
    rerender();
    expect(result.current).toBe(null);
    console.error = oldError;
  });
  it('should NOT suspend if result already in cache and options.invalidIfStale is false', () => {
    const state = buildState(
      payload,
      CoolerArticleResource.detailShape(),
      payload,
    );

    const tree = (
      <StateContext.Provider value={state}>
        <Suspense fallback={<Fallback />}>
          <ArticleComponentTester />
        </Suspense>
      </StateContext.Provider>
    );
    const { getByText } = render(tree);
    expect(fbmock).not.toBeCalled();
    const title = getByText(payload.title);
    expect(title).toBeDefined();
    expect(title.tagName).toBe('H3');
  });
  it('should NOT suspend even when result is stale and options.invalidIfStale is false', () => {
    const { entities, result } = normalize(
      payload,
      CoolerArticleResource.getEntitySchema(),
    );
    const fetchKey = CoolerArticleResource.detailShape().getFetchKey(payload);
    const state = {
      entities,
      results: {
        [fetchKey]: result,
      },
      meta: {
        [fetchKey]: {
          date: 0,
          expiresAt: 0,
        },
      },
    };

    const tree = (
      <StateContext.Provider value={state}>
        <Suspense fallback={<Fallback />}>
          <ArticleComponentTester />
        </Suspense>
      </StateContext.Provider>
    );
    const { getByText } = render(tree);
    expect(fbmock).not.toBeCalled();
    const title = getByText(payload.title);
    expect(title).toBeDefined();
    expect(title.tagName).toBe('H3');
  });
  it('should NOT suspend if result is not stale and options.invalidIfStale is true', () => {
    const { entities, result } = normalize(
      payload,
      InvalidIfStaleArticleResource.getEntitySchema(),
    );
    const fetchKey = InvalidIfStaleArticleResource.detailShape().getFetchKey(payload);
    const state = {
      entities,
      results: {
        [fetchKey]: result,
      },
      meta: {
        [fetchKey]: {
          date: Infinity,
          expiresAt: Infinity,
        },
      },
    };

    const tree = (
      <StateContext.Provider value={state}>
        <Suspense fallback={<Fallback />}>
          <ArticleComponentTester invalidIfStale />
        </Suspense>
      </StateContext.Provider>
    );
    const { getByText } = render(tree);
    expect(fbmock).not.toBeCalled();
    const title = getByText(payload.title);
    expect(title).toBeDefined();
    expect(title.tagName).toBe('H3');
  });
  it('should suspend if result stale in cache and options.invalidIfStale is true', () => {
    const { entities, result } = normalize(
      payload,
      InvalidIfStaleArticleResource.getEntitySchema(),
    );
    const fetchKey = InvalidIfStaleArticleResource.detailShape().getFetchKey(payload);
    const state = {
      entities,
      results: {
        [fetchKey]: result,
      },
      meta: {
        [fetchKey]: {
          date: 0,
          expiresAt: 0,
        },
      },
    };

    const tree = (
      <StateContext.Provider value={state}>
        <Suspense fallback={<Fallback />}>
          <ArticleComponentTester invalidIfStale />
        </Suspense>
      </StateContext.Provider>
    );
    render(tree);
    expect(fbmock).toHaveBeenCalled();
  });
});
