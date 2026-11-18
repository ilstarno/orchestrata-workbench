import {
  MutationObserver,
  type MutationObserverResult,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { Children, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "../../frontend/src/app";
import type { SolveResult } from "../../frontend/src/shared/api/solve";

interface Attempt {
  definition: string;
  useExampleLabels: boolean;
}

const harness = vi.hoisted(() => ({
  slot: 0,
  state: [] as unknown[],
  initialized: new Set<number>(),
  fire: undefined as (() => void) | undefined,
  mutation: undefined as unknown,
}));

// Run the actual App callbacks and render the actual review panel without
// adding a DOM dependency. The first five hooks are App's local state.
vi.mock("react", async (importOriginal) => {
  const real = await importOriginal<typeof import("react")>();
  return {
    ...real,
    useState(initial: unknown) {
      const slot = harness.slot++;
      if (slot >= 5) return real.useState(initial);
      if (!harness.initialized.has(slot)) {
        harness.state[slot] =
          typeof initial === "function" ? initial() : initial;
        harness.initialized.add(slot);
      }
      return [
        harness.state[slot],
        (next: unknown) => {
          harness.state[slot] =
            typeof next === "function" ? next(harness.state[slot]) : next;
        },
      ];
    },
  };
});

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const real = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...real,
    useMutation(options: UseMutationOptions<SolveResult, Error, Attempt>) {
      let observer = harness.mutation as
        MutationObserver<SolveResult, Error, Attempt> | undefined;
      if (!observer) {
        observer = new real.MutationObserver(new real.QueryClient(), options);
        observer.subscribe(() => {});
        harness.mutation = observer;
      }
      const snapshot = observer.getCurrentResult();
      return {
        ...snapshot,
        mutate: (...args: Parameters<typeof observer.mutate>) => {
          void observer.mutate(...args).catch(() => {});
        },
      };
    },
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
  harness.mutation = undefined;
  harness.initialized.clear();
  harness.state = [];
});

function captureRunButton(node: ReactNode) {
  Children.forEach(node, (child) => {
    if (
      !isValidElement<{
        children?: ReactNode;
        className?: string;
        isDisabled?: boolean;
        onPress?: () => void;
      }>(child)
    )
      return;
    if (child.props.className === "primary-button" && !child.props.isDisabled)
      harness.fire = child.props.onPress;
    captureRunButton(child.props.children);
  });
}

function InstrumentedApp() {
  const tree = App({});
  captureRunButton(tree);
  return tree;
}

function render() {
  harness.slot = 0;
  harness.fire = undefined;
  return renderToStaticMarkup(<InstrumentedApp />).split(
    '<section class="panel result-panel"',
  )[1]!;
}

function submit() {
  render();
  if (!harness.fire) throw new Error("expected enabled Run button");
  harness.fire();
}

function solution(values: number[]) {
  return new Response(
    JSON.stringify({
      solution: { values, score: { hard: 0, soft: 0 }, evaluated: 8 },
    }),
  );
}

function status() {
  return (
    harness.mutation as MutationObserver<SolveResult, Error, Attempt>
  ).getCurrentResult();
}

async function settle(
  expected: MutationObserverResult<SolveResult, Error, Attempt>["status"],
) {
  await vi.waitFor(() => expect(status().status).toBe(expected));
  return render();
}

it("retains the last named plan through a deferred rejection, replaces it on retry, then shows verified infeasibility separately", async () => {
  const pending: Array<(response: Response) => void> = [];
  const fetchMock = vi.fn(
    () => new Promise<Response>((resolve) => pending.push(resolve)),
  );
  vi.stubGlobal("fetch", fetchMock);
  const reply = async (response: Response) => {
    await vi.waitFor(() => expect(pending.length).toBe(1));
    pending.shift()!(response);
  };

  submit();
  await reply(solution([8, 2, 3]));
  expect(await settle("success")).toContain("Lift repair</dt><dd>Alex");

  submit();
  let page = render();
  expect(page).toContain('class="result-status">Checking');
  expect(page).toContain("<h3>Last successful plan</h3>");
  expect(page).toContain("Lift repair</dt><dd>Alex");
  expect(harness.fire).toBeUndefined();
  await reply(new Response("Solver execution failed", { status: 500 }));
  page = await settle("error");
  expect(page).toContain('class="result-status">Not completed');
  expect(page).toContain('role="alert"');
  expect(page).toContain("Lift repair</dt><dd>Alex");

  submit();
  await reply(solution([3, 8, 2]));
  page = await settle("success");
  expect(page.match(/Lift repair<\/dt><dd>/g)).toHaveLength(1);
  expect(page).toContain("Lift repair</dt><dd>Noor");
  expect(page).not.toContain("Lift repair</dt><dd>Alex");
  expect(page).not.toContain("<h3>Last successful plan</h3>");
  expect(page).not.toContain('role="alert"');

  submit();
  await reply(new Response('{"solution":null}'));
  page = await settle("success");
  expect(page).toContain('class="result-status">No plan');
  expect(page).not.toContain("Lift repair</dt><dd>");
  expect(page).not.toContain('role="alert"');
  expect(fetchMock).toHaveBeenCalledTimes(4);
});
