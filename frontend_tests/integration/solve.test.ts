import { afterEach, describe, expect, it, vi } from "vitest";
import { solveProblem } from "../../frontend/src/shared/api/solve";
import { serializeEligibility } from "../../frontend/src/shared/examples/assignment";

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockResponse(body: string, status = 200, headers?: HeadersInit) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(body, { status, headers }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("solve API client", () => {
  it("returns a checked assignment and sends the original definition", async () => {
    const assignment = {
      values: [1, 0],
      score: { hard: 0, soft: 0 },
      evaluated: 4,
    };
    const fetchMock = mockResponse(JSON.stringify({ solution: assignment }));

    await expect(solveProblem("{}")).resolves.toEqual({
      kind: "solved",
      assignment,
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/solve", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
  });

  it("recognizes proven infeasibility without treating it as an error", async () => {
    mockResponse('{"solution":null}');
    await expect(solveProblem("{}")).resolves.toEqual({ kind: "infeasible" });
  });

  it("preserves the exact response if displaying it as numbers would lose precision", async () => {
    const json =
      '{"solution":{"values":[9223372036854775807],"score":{"hard":0,"soft":0},"evaluated":1}}';
    mockResponse(json);
    await expect(solveProblem("{}")).resolves.toEqual({
      kind: "exact-json",
      json,
    });
  });

  it.each([
    [422, "Search space exceeds the evaluation limit", "search-limit"],
    [422, "Invalid problem", "invalid-input"],
    [422, "Invalid problem or search space too large", "ambiguous-request"],
    [422, "unknown proxy response", "ambiguous-request"],
    [500, "Solver execution failed", "execution"],
    [503, "Service unavailable", "busy"],
  ])(
    "classifies legacy HTTP %i with diagnostic %s",
    async (status, body, kind) => {
      mockResponse(body, status);
      await expect(solveProblem("{}")).rejects.toMatchObject({ kind });
    },
  );

  it.each([
    [400, "invalid_request_body", "invalid-input"],
    [422, "invalid_problem", "invalid-input"],
    [422, "search_limit_exceeded", "search-limit"],
    [500, "solve_execution_failed", "execution"],
    [503, "solver_busy", "busy"],
    [404, "not_found", "unexpected-response"],
    [405, "method_not_allowed", "unexpected-response"],
    [429, "request_rejected", "unexpected-response"],
    [500, "internal_error", "execution"],
  ])(
    "uses the stable code for indexed HTTP %i: %s",
    async (status, code, kind) => {
      mockResponse("Invalid problem or search space too large", status, {
        "X-Orchestrata-Error-Code": code,
      });
      await expect(solveProblem("{}")).rejects.toMatchObject({ kind, code });
    },
  );

  it("does not guess from the body when a newer indexed code is unknown", async () => {
    mockResponse("Search space exceeds the evaluation limit", 422, {
      "x-orchestrata-error-code": "future_code",
    });
    await expect(solveProblem("{}")).rejects.toMatchObject({
      kind: "unexpected-response",
    });
  });

  it("does not read diagnostic bodies to decode indexed failures", async () => {
    const response = new Response("", {
      status: 422,
      headers: { "x-orchestrata-error-code": "search_limit_exceeded" },
    });
    const read = vi
      .spyOn(response, "text")
      .mockRejectedValue(new Error("response text was unavailable"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    await expect(solveProblem("{}")).rejects.toMatchObject({
      kind: "search-limit",
      code: "search_limit_exceeded",
    });
    expect(read).not.toHaveBeenCalled();
  });

  it("does not present a hard-invalid result as an assignment", async () => {
    mockResponse(
      '{"solution":{"values":[1,1],"score":{"hard":-1,"soft":0},"evaluated":4}}',
    );
    await expect(solveProblem("{}")).rejects.toMatchObject({
      kind: "unexpected-response",
    });
  });

  it("sends an empty eligibility selection and reports the service rejection", async () => {
    const definition = serializeEligibility([[], [8, 2], [3, 2]]);
    const fetchMock = mockResponse("Invalid problem", 422);

    await expect(solveProblem(definition)).rejects.toMatchObject({
      kind: "invalid-input",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/solve",
      expect.objectContaining({ body: definition }),
    );
  });

  it.each([201, 202])(
    "does not treat HTTP %i as a completed plan",
    async (status) => {
      mockResponse(
        '{"solution":{"values":[8,2,3],"score":{"hard":0,"soft":0},"evaluated":8}}',
        status,
      );
      await expect(solveProblem("{}")).rejects.toMatchObject({
        kind: "unexpected-response",
      });
    },
  );

  it("rejects malformed JSON before sending a request", async () => {
    const fetchMock = mockResponse("{}");
    await expect(solveProblem("{")).rejects.toMatchObject({
      kind: "invalid-input",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports network failures without claiming infeasibility", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("connection closed")),
    );
    await expect(solveProblem("{}")).rejects.toMatchObject({ kind: "offline" });
  });
});
