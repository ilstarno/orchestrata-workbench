import {
  MutationObserver,
  type UseMutationOptions,
} from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { Children, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { RecipeDetailPage } from "../../frontend/src/features/recipes/recipe-detail-page";
import {
  createRecipeDetailApi,
  recipeDetailApi,
} from "../../frontend/src/features/recipes/detail/recipe-detail-api";
import type { SolveResult } from "../../frontend/src/shared/api/solve";

const harness = vi.hoisted(() => ({
  capturing: false,
  mounted: "",
  slot: 0,
  ref: 0,
  effect: 0,
  state: [] as unknown[],
  refs: [] as Array<{ current: unknown }>,
  mountedEffect: false,
  unmount: undefined as (() => void) | undefined,
  mutation: undefined as unknown,
  fire: undefined as (() => void) | undefined,
  resultWrites: 0,
}));

vi.mock("react", async (importOriginal) => {
  const real = await importOriginal<typeof import("react")>();
  return {
    ...real,
    useState(initial: unknown) {
      if (!harness.capturing) return real.useState(initial);
      const index = harness.slot++;
      if (index >= 1) return real.useState(initial);
      if (!(index in harness.state)) harness.state[index] = initial;
      const cache = harness.state;
      return [
        cache[index],
        (next: unknown) => {
          if (index === 0) harness.resultWrites++;
          cache[index] = next;
        },
      ];
    },
    useRef(initial: unknown) {
      if (!harness.capturing) return real.useRef(initial);
      const index = harness.ref++;
      if (index >= 2) return real.useRef(initial);
      return (harness.refs[index] ??= { current: initial });
    },
    useEffect(effect: () => void | (() => void), deps?: readonly unknown[]) {
      if (!harness.capturing || harness.effect++ !== 0)
        return real.useEffect(effect, deps);
      if (!harness.mountedEffect) {
        const unmount = effect();
        harness.mountedEffect = true;
        if (typeof unmount === "function") harness.unmount = unmount;
      }
    },
  };
});

type Observer = MutationObserver<SolveResult, Error, AbortSignal>;
vi.mock("@tanstack/react-query", async (importOriginal) => {
  const real = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...real,
    useQuery: () => ({
      isSuccess: true,
      data: {
        metadata: {
          title: harness.mounted,
          scenario: "Synthetic case",
          inputs: [],
        },
        exactExampleJson: "{}",
      },
    }),
    useMutation(options: UseMutationOptions<SolveResult, Error, AbortSignal>) {
      let observer = harness.mutation as Observer | undefined;
      if (!observer) {
        observer = new real.MutationObserver(new real.QueryClient(), options);
        observer.subscribe(() => {});
        harness.mutation = observer;
      }
      return {
        ...observer.getCurrentResult(),
        mutateAsync: observer.mutate.bind(observer),
      };
    },
  };
});

function captureRun(node: ReactNode) {
  Children.forEach(node, (child) => {
    if (
      !isValidElement<{
        children?: ReactNode;
        className?: string;
        disabled?: boolean;
        onClick?: () => void;
      }>(child)
    )
      return;
    if (child.props.className === "primary-button" && !child.props.disabled)
      harness.fire = child.props.onClick;
    captureRun(child.props.children);
  });
}

// Uses the actual route element and explicitly applies its React component key
// to the hook harness. This exercises production cleanup without claiming DOM coverage.
function RouteHarness() {
  const child = RecipeDetailPage();
  if (harness.mounted !== child.key) {
    harness.unmount?.();
    harness.mounted = String(child.key);
    harness.state = [];
    harness.refs = [];
    harness.mutation = undefined;
    harness.mountedEffect = false;
    harness.unmount = undefined;
  }
  harness.slot = harness.ref = harness.effect = 0;
  harness.capturing = true;
  try {
    const page = child.type(child.props);
    captureRun(page);
    return page;
  } finally {
    harness.capturing = false;
  }
}

function routeAt(id: string) {
  const rootRoute = createRootRoute();
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/recipes/$recipeId",
    component: RouteHarness,
  });
  return createRouter({
    routeTree: rootRoute.addChildren([detailRoute]),
    history: createMemoryHistory({ initialEntries: ["/recipes/" + id] }),
  });
}
let router = routeAt("field-service");

function render() {
  harness.fire = undefined;
  return renderToStaticMarkup(<RouterProvider router={router} />);
}

function submit() {
  render();
  if (!harness.fire) throw new Error("expected enabled Run button");
  harness.fire();
}

afterEach(() => {
  harness.unmount?.();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function solution(value: number, status = 200) {
  return Response.json(
    {
      solution: { values: [value], score: { hard: 0, soft: 0 }, evaluated: 1 },
    },
    { status },
  );
}

it("keeps last result through retry failures, replaces only with checked 200, and aborts/ignores stale navigation result", async () => {
  vi.spyOn(recipeDetailApi, "run").mockImplementation(
    createRecipeDetailApi("https://example.test").run,
  );
  const pending: Array<{
    request: Request;
    finish: (response: Response) => void;
  }> = [];
  vi.stubGlobal(
    "fetch",
    (request: Request) =>
      new Promise<Response>((finish) => pending.push({ request, finish })),
  );
  const next = async (id: string) => {
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    const attempt = pending.shift()!;
    expect(new URL(attempt.request.url).pathname).toBe(
      "/api/v1/recipes/" + id + "/run-example",
    );
    return attempt;
  };
  const settle = async (observer: Observer, status: "success" | "error") => {
    await vi.waitFor(() =>
      expect(observer.getCurrentResult().status).toBe(status),
    );
    return render();
  };

  await router.load();
  submit();
  const observer = harness.mutation as Observer;
  (await next("field-service")).finish(solution(11));
  expect(await settle(observer, "success")).toContain("<dd>11</dd>");

  for (const response of [
    new Response("Solver execution failed", { status: 500 }),
    new Response("{}"),
    solution(99, 201),
  ]) {
    submit();
    const waiting = render();
    expect(waiting).toContain('class="result-status">Checking');
    expect(waiting).toContain("Last successful plan");
    expect(waiting).toContain("<dd>11</dd>");
    (await next("field-service")).finish(response);
    const failed = await settle(observer, "error");
    expect(failed).toContain('role="alert"');
    expect(failed).toContain("Last successful plan");
    expect(failed).toContain("<dd>11</dd>");
    expect(failed).not.toContain("<dd>99</dd>");
  }

  submit();
  (await next("field-service")).finish(solution(22));
  const retried = await settle(observer, "success");
  expect(retried).toContain("<dd>22</dd>");
  expect(retried).not.toContain("<dd>11</dd>");
  expect(retried).not.toContain('role="alert"');
  expect(harness.resultWrites).toBe(2);

  submit();
  const late = await next("field-service");
  router = routeAt("another-recipe");
  await router.load();
  expect(render()).not.toContain("<dd>22</dd>");
  expect(late.request.signal.aborted).toBe(true);
  late.finish(solution(99)); // Deliberately emulate a transport that responds after abort.
  expect(await settle(observer, "success")).not.toContain("<dd>99</dd>");
  expect(harness.resultWrites).toBe(2);

  submit();
  const nextObserver = harness.mutation as Observer;
  (await next("another-recipe")).finish(Response.json({ solution: null }));
  const infeasible = await settle(nextObserver, "success");
  expect(infeasible).toContain('class="result-status">No plan');
  expect(infeasible).not.toContain("Last successful plan");
  expect(infeasible).not.toContain('role="alert"');
});
