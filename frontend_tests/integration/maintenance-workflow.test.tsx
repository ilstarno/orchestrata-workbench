import { webcrypto } from "node:crypto";
import { createEngine } from "../../frontend/src/features/maintenance/local/engine";
import { executeLocal } from "../../frontend/src/features/maintenance/local/execute-local";
import type { LocalRequest } from "../../frontend/src/features/maintenance/local/local-request";
// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Blob as NodeBlob } from "node:buffer";
import { MaintenanceWorkbench } from "../../frontend/src/features/maintenance/maintenance-workbench";
import { LocaleProvider } from "../../frontend/src/shared/i18n/locale-context";
let host: HTMLDivElement, root: Root;
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("Blob", NodeBlob);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<MaintenanceWorkbench />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
async function click(node: HTMLElement) {
  await act(async () => {
    node.click();
    await tick();
  });
}
async function change(node: HTMLSelectElement, value: string) {
  await act(async () => {
    node.value = value;
    node.dispatchEvent(new Event("change", { bubbles: true }));
    await tick();
  });
}
const button = (text: string) =>
  [...host.querySelectorAll<HTMLButtonElement>("button")].find(
    (node) => node.textContent === text,
  )!;
async function upload(
  index: number,
  name: string,
  data = readFileSync(resolve("../frontend_tests/fixtures/maintenance", name)),
) {
  const bytes = new Uint8Array(data),
    file = new File([bytes], name);
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => bytes.slice().buffer,
  });
  const node =
    host.querySelectorAll<HTMLInputElement>("input[type=file]")[index];
  Object.defineProperty(node, "files", { configurable: true, value: [file] });
  await act(async () =>
    node.dispatchEvent(new Event("change", { bubbles: true })),
  );
}
async function review() {
  await click(button("Open and preview"));
  await vi.waitFor(async () => {
    await act(tick);
    expect(host.querySelector(".import-review")).not.toBeNull();
  });
}
const confirmation = () =>
  [...host.querySelectorAll<HTMLInputElement>("input[type=checkbox]")].find(
    (input) => input.parentElement?.textContent?.includes("I confirm"),
  )!;
function exported() {
  return JSON.parse(
    decodeURIComponent(
      host
        .querySelector<HTMLAnchorElement>(".maintenance-export")!
        .href.split(",")
        .slice(1)
        .join(","),
    ),
  );
}
it.each(["xlsx", "csv", "records"])(
  "reviews genuine %s source data, confirms and exports equivalent package inputs without a fake run",
  async (source) => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await change(host.querySelectorAll("select")[1], source);
    if (source === "csv")
      for (const [index, name] of [
        "work_orders.csv",
        "technicians.csv",
        "eligibility.csv",
      ].entries())
        await upload(index, name);
    else
      await upload(
        0,
        source === "xlsx" ? "maintenance.xlsx" : "connector-records.json",
      );
    await review();
    expect(host.querySelectorAll(".import-issue")).toHaveLength(0);
    expect(host.querySelector(".maintenance-export")).toBeNull();
    await click(confirmation());
    expect(exported()).toEqual(
      JSON.parse(
        readFileSync(
          resolve("../frontend_tests/fixtures/maintenance/inputs.json"),
          "utf8",
        ),
      ),
    );
    await change(host.querySelector("select")!, "delay");
    expect(host.textContent).toContain("not elapsed shift time");
    expect(button("Run locally").disabled).toBe(false);
    expect(host.textContent).toContain("Files are not sent to a server");
    expect(fetcher).not.toHaveBeenCalled();
  },
);
it("corrects only flagged normalized fields and retains confirmed input after a malformed replacement", async () => {
  await change(host.querySelectorAll("select")[1], "records");
  const data = JSON.parse(
    readFileSync(
      resolve("../frontend_tests/fixtures/maintenance/inputs.json"),
      "utf8",
    ),
  );
  data.technicians[0].available = "unknown";
  await upload(0, "review.json", Buffer.from(JSON.stringify(data)));
  await review();
  expect(host.querySelectorAll(".import-issue input")).toHaveLength(1);
  expect(confirmation().disabled).toBe(true);
  const correction = host.querySelector<HTMLInputElement>(
    ".import-issue input",
  )!;
  expect(correction.getAttribute("aria-invalid")).toBe("true");
  await act(async () => {
    correction.value = "false";
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(host.querySelectorAll(".import-issue")).toHaveLength(0);
  expect(document.activeElement).toBe(confirmation());
  await click(confirmation());
  data.technicians[0].available = false;
  expect(exported()).toEqual(data);
  const previous = host.querySelector<HTMLAnchorElement>(
    ".maintenance-export",
  )!.href;
  await upload(0, "bad.json", Buffer.from('{"broken":'));
  await click(button("Open and preview"));
  await vi.waitFor(async () => {
    await act(tick);
    expect(host.querySelector("[role=alert]")).not.toBeNull();
  });
  expect(
    host.querySelector<HTMLAnchorElement>(".maintenance-export")!.href,
  ).toBe(previous);
});
it("translates controls and local execution while preserving contract field names", async () => {
  await act(async () =>
    root.render(
      <LocaleProvider initialLocale="fr-FR">
        <MaintenanceWorkbench />
      </LocaleProvider>,
    ),
  );
  expect(host.textContent).toContain("Point d’entrée");
  expect(host.textContent).toContain("Aucun fichier envoyé au serveur");
});

it.each(["xlsx", "csv", "records"])(
  "runs user-selected %s through the real Engine for both objectives and exports retained results",
  async (source) => {
    vi.stubGlobal("crypto", webcrypto);
    const solve = await createEngine(
      new Uint8Array(
        readFileSync(
          resolve("src/features/maintenance/local/assets/package-runtime.wasm"),
        ),
      ),
      new Uint8Array(
        readFileSync(
          resolve(
            "src/features/maintenance/local/assets/maintenance-shift.orcpkg",
          ),
        ),
      ),
    );
    const sent: LocalRequest[] = [];
    let fail = false;
    class EngineWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      onmessageerror = null;
      stopped = false;
      terminate() {
        this.stopped = true;
      }
      postMessage(request: LocalRequest) {
        sent.push(request);
        if (fail) {
          queueMicrotask(() => this.onerror?.());
          return;
        }
        void executeLocal(request, solve).then((plan) => {
          if (!this.stopped)
            this.onmessage?.({ data: { plan } } as MessageEvent);
        });
      }
    }
    vi.stubGlobal("Worker", EngineWorker);
    await change(host.querySelectorAll("select")[1], source);
    if (source === "csv")
      for (const [i, name] of [
        "work_orders.csv",
        "technicians.csv",
        "eligibility.csv",
      ].entries())
        await upload(i, name);
    else
      await upload(
        0,
        source === "xlsx" ? "maintenance.xlsx" : "connector-records.json",
      );
    await review();
    await click(confirmation());
    const csv = () =>
      [...host.querySelectorAll<HTMLAnchorElement>("a")].find((a) =>
        a.download.endsWith("-plan.csv"),
      )!;
    for (const [objective, total] of [
      ["cost", "14600"],
      ["delay", "292"],
    ]) {
      await change(host.querySelector("select")!, objective);
      await click(button("Run locally"));
      await vi.waitFor(async () => {
        await act(tick);
        expect(host.textContent).toContain("Local plan result");
        expect(csv()).toBeDefined();
      });
      expect(host.textContent).toContain(total);
      expect(decodeURIComponent(csv().href)).toContain("hv-isolator");
      expect(decodeURIComponent(csv().href)).toContain("unassigned");
    }
    expect(sent.map((r) => r.objective)).toEqual(["cost", "delay"]);
    expect(sent[0].records).toEqual(exported());
    const previous = csv().href;
    fail = true;
    await click(button("Run locally"));
    await vi.waitFor(async () => {
      await act(tick);
      expect(host.textContent).toContain("The local run failed");
    });
    expect(host.textContent).toContain("Previous successful plan");
    expect(csv().href).toBe(previous);
    // A caller's own replacement IDs must flow through the mapper and Engine.
    await change(host.querySelectorAll("select")[1], "records");
    const own = {
      work_orders: [{ id: "my-pump" }],
      technicians: [{ id: "my-tech", capacity_slots: 1, available: true }],
      eligibility: [
        {
          work_order_id: "my-pump",
          technician_id: "my-tech",
          cost_cents: 17,
          delay_minutes: 4,
        },
      ],
    };
    await upload(0, "my-export.json", Buffer.from(JSON.stringify(own)));
    await review();
    await click(confirmation());
    fail = false;
    await click(button("Run locally"));
    await vi.waitFor(async () => {
      await act(tick);
      expect(decodeURIComponent(csv().href)).toContain("my-pump");
    });
    expect(decodeURIComponent(csv().href)).toContain("my-tech");
    expect(sent.at(-1)!.records).toEqual(own);
  },
);
