import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import {
  Children,
  cloneElement,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { RecipeGridPage } from "../../frontend/src/features/recipes/recipe-grid-page";
import { ServerGrid } from "../../frontend/src/features/grid/server-grid";
import { GridTable } from "../../frontend/src/features/grid/grid-table";
import type { GridView } from "../../frontend/src/features/grid/grid-contract";

const providerModules = import.meta.glob<{
  RecipeCatalogProvider: (props: { children: ReactNode }) => ReactElement;
}>("../../frontend/src/features/recipes/recipe-catalog-state.tsx", {
  eager: true,
});
const CatalogProvider =
  Object.values(providerModules)[0]?.RecipeCatalogProvider ?? Fragment;

const session = vi.hoisted(() => ({
  state: [] as unknown[],
  gridState: [] as unknown[],
  slot: 0,
  captureState: null as "state" | "gridState" | null,
  captureEffects: false,
  effects: [] as Array<() => void | (() => void)>,
  query: undefined as unknown,
  total: 31,
  placeholder: false,
  control: undefined as unknown,
  sort: undefined as unknown,
  next: undefined as unknown,
}));

vi.mock("react", async (importOriginal) => {
  const real = await importOriginal<typeof import("react")>();
  return {
    ...real,
    useState(initial: unknown) {
      if (!session.captureState) return real.useState(initial);
      const cache = session[session.captureState];
      const slot = session.slot++;
      if (!(slot in cache)) cache[slot] = initial;
      return [
        cache[slot],
        (next: unknown) => {
          cache[slot] = typeof next === "function" ? next(cache[slot]) : next;
        },
      ];
    },
    useEffect(effect: () => void | (() => void), deps?: readonly unknown[]) {
      if (session.captureEffects) session.effects.push(effect);
      else real.useEffect(effect, deps);
    },
  };
});

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const real = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...real,
    useQuery(options: { queryKey: unknown[] }) {
      const view = options.queryKey[2] as GridView<string>;
      session.query = view;
      return {
        isFetching: session.placeholder,
        isPlaceholderData: session.placeholder,
        data: {
          page: view.page,
          pageSize: 10,
          totalItems: session.total,
          rows: [],
          columns: [],
        },
      };
    },
  };
});

type Capturable = {
  children?: ReactNode;
  type?: string;
  onChange?: (event: { currentTarget: { value: string } }) => void;
  onClick?: () => void;
  onSortingChange?: (value: Array<{ id: string; desc: boolean }>) => void;
};

function visit(tree: ReactNode, fn: (child: ReactElement<Capturable>) => void) {
  Children.forEach(tree, (child) => {
    if (!isValidElement<Capturable>(child)) return;
    fn(child);
    visit(child.props.children, fn);
  });
}

function renderGrid(tree: ReactNode): ReactNode {
  return Children.map(tree, (child) => {
    if (!isValidElement<Capturable>(child)) return child;
    if (child.type !== ServerGrid) {
      return child.props.children === undefined
        ? child
        : cloneElement(child, {}, renderGrid(child.props.children));
    }

    session.captureEffects = true;
    session.captureState = "gridState";
    session.slot = 0;
    try {
      const grid = ServerGrid(child.props as Parameters<typeof ServerGrid>[0]);
      visit(grid, (item) => {
        if (item.type === "input" && item.props.type === "search")
          session.control = item.props.onChange;
        if (item.type === GridTable) session.sort = item.props.onSortingChange;
        if (item.type === "button" && item.props.onClick)
          session.next = item.props.onClick;
      });
      return grid;
    } finally {
      session.captureEffects = false;
      session.captureState = null;
    }
  });
}

function RecipeCatalogHarness() {
  return renderGrid(RecipeGridPage());
}

function Shell() {
  // Retain only the provider's hook slots across separate SSR route mounts.
  // Child components still see a genuine React context and actual router.
  if (typeof CatalogProvider !== "function") return <Outlet />;
  session.captureState = "state";
  session.slot = 0;
  try {
    return CatalogProvider({ children: <Outlet /> });
  } finally {
    session.captureState = null;
  }
}

async function renderRoute(path: string) {
  const root = createRootRoute({ component: Shell });
  const catalog = createRoute({
    getParentRoute: () => root,
    path: "/recipes",
    component: RecipeCatalogHarness,
  });
  const detail = createRoute({
    getParentRoute: () => root,
    path: "/recipes/$recipeId",
    component: () => <p>Recipe detail</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([catalog, detail]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  await router.load();
  if (path !== "/recipes") session.gridState = [];
  session.query = undefined;
  session.effects = [];
  session.control = session.sort = session.next = undefined;
  return renderToStaticMarkup(<RouterProvider router={router} />);
}

const setSearch = (value: string) =>
  (session.control as NonNullable<Capturable["onChange"]>)({
    currentTarget: { value },
  });
const setSort = (id: string, desc: boolean) =>
  (session.sort as NonNullable<Capturable["onSortingChange"]>)([{ id, desc }]);
const next = () => (session.next as NonNullable<Capturable["onClick"]>)();
const path = "/recipes";
const detailPath = "/recipes/field-service";

function effects() {
  const cleanups = session.effects.splice(0).map((effect) => effect());
  return () => {
    cleanups.forEach((cleanup) => cleanup?.());
  };
}

afterEach(() => vi.useRealTimers());

it("retains draft, applied server query, sort and page on both catalog returns, and only clamps confirmed invalid pages", async () => {
  session.state = [];
  await renderRoute(detailPath);
  expect(session.query).toBeUndefined();

  const first = await renderRoute(path);
  expect(first).toContain('type="search" value=""');
  expect(session.query).toMatchObject({ query: "", page: 1 });
  setSearch("night inspection");
  await renderRoute(path);
  vi.useFakeTimers();
  const cleanup = effects();
  vi.advanceTimersByTime(300);
  cleanup();
  vi.useRealTimers();

  await renderRoute(path);
  expect(session.query).toMatchObject({ query: "night inspection" });
  setSort("title", true);
  await renderRoute(path);
  next();
  await renderRoute(path);
  expect(session.query).toMatchObject({
    query: "night inspection",
    page: 2,
    sort: { id: "title", desc: true },
  });

  setSearch("night inspection revised");
  await renderRoute(path);
  vi.useFakeTimers();
  const abandon = effects();
  abandon();
  vi.advanceTimersByTime(300);
  vi.useRealTimers();

  const history = createMemoryHistory({ initialEntries: [path] });
  history.push(detailPath);
  await renderRoute(history.location.pathname);
  expect(session.query).toBeUndefined();
  history.back();
  let returned = await renderRoute(history.location.pathname);
  expect(returned).toContain('value="night inspection revised"');
  const remembered = {
    query: "night inspection",
    page: 2,
    sort: { id: "title", desc: true },
  };
  expect(session.query).toMatchObject(remembered);

  history.push(detailPath);
  await renderRoute(history.location.pathname);
  history.push(path); // The existing Back to recipes link targets this route.
  returned = await renderRoute(history.location.pathname);
  expect(returned).toContain('value="night inspection revised"');
  expect(session.query).toMatchObject(remembered);
  vi.useFakeTimers();
  const returnedCleanup = effects();
  vi.advanceTimersByTime(300);
  returnedCleanup();
  vi.useRealTimers();
  await renderRoute(path);
  expect(session.query).toMatchObject({
    ...remembered,
    query: "night inspection revised",
    page: 1,
  });

  next();
  await renderRoute(path);
  session.total = 8;
  session.placeholder = true;
  await renderRoute(path);
  effects()();
  expect(session.query).toMatchObject({ page: 2 });
  session.placeholder = false;
  await renderRoute(path);
  effects()();
  await renderRoute(path);
  expect(session.query).toMatchObject({
    page: 1,
    query: "night inspection revised",
    sort: { id: "title", desc: true },
  });
  expect(history.location.search).toBe("");
});
