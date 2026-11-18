import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  extractRecords,
  reviewWorkbook,
  suggestMapping,
  validateRecords,
} from "../../frontend/src/features/maintenance/input-model";
import { parseRecords } from "../../frontend/src/features/maintenance/read-records";
import { makeSheet } from "../../frontend/src/features/assignment/spreadsheet/workbook";
import { readCsv } from "../../frontend/src/features/assignment/spreadsheet/csv-reader";
const fixture = (name: string) =>
  readFileSync(resolve("../frontend_tests/fixtures/maintenance", name), "utf8");
const input = () => extractRecords(JSON.parse(fixture("inputs.json")));

it("normalizes the public maintenance connector export and three CSV tables to identical named records", () => {
  const records = parseRecords(fixture("connector-records.json"));
  const book = {
    sheets: ["work_orders", "technicians", "eligibility"].map((table) =>
      makeSheet(table, readCsv(fixture(`${table}.csv`))),
    ),
  };
  const review = reviewWorkbook(book, suggestMapping(book));
  expect(review.issues).toEqual([]);
  expect(review.records).toEqual(records);
  expect(records).toEqual(input());
  expect(review.rows.work_orders).toEqual(
    Array.from({ length: 12 }, (_, i) => i + 2),
  );
});

it("requires a column choice for ambiguous headings and preserves unmapped records for correction", () => {
  const book = {
    sheets: [
      makeSheet("work_orders", [
        ["id", "id"],
        ["pump-a", "pump-b"],
      ]),
      makeSheet("technicians", [
        ["id", "capacity_slots", "available"],
        ["a", "1", "true"],
      ]),
      makeSheet("eligibility", [
        ["work_order_id", "technician_id", "cost_cents", "delay_minutes"],
      ]),
    ],
  };
  const mapping = suggestMapping(book);
  expect(mapping.work_orders.sheet).toBeNull();
  expect(reviewWorkbook(book, mapping).issues).toContainEqual({
    table: "work_orders",
    code: "mapping",
  });
  mapping.work_orders = { sheet: 0, columns: { id: 0 } };
  book.sheets[0].sourceRows.push(["", "not silently dropped"]);
  expect(reviewWorkbook(book, mapping).issues).toContainEqual({
    table: "work_orders",
    row: 1,
    field: "id",
    code: "type",
  });
});

it.each(["", "spaces here", "é", "a".repeat(65), "a/b"])(
  "rejects identifiers outside the runtime contract: %j",
  (value) => {
    const records = input();
    records.work_orders[0].id = value;
    expect(validateRecords(records)).toContainEqual({
      table: "work_orders",
      row: 0,
      field: "id",
      code: "type",
    });
  },
);
it.each([-1, 1.5, 1000001, "1", null])(
  "rejects invalid normalized numeric values: %j",
  (value) => {
    const records = input();
    records.eligibility[0].cost_cents = value;
    expect(validateRecords(records)).toContainEqual({
      table: "eligibility",
      row: 0,
      field: "cost_cents",
      code: "type",
    });
  },
);
it("rejects unknown availability, duplicates, dangling references and extra fields without inference", () => {
  const records = input();
  records.technicians[0].available = "true";
  records.work_orders[1].id = records.work_orders[0].id;
  records.eligibility.push({ ...records.eligibility[0] });
  records.eligibility[1].technician_id = "missing";
  records.technicians[0].unknown = "value";
  const issues = validateRecords(records);
  expect(issues).toContainEqual({
    table: "technicians",
    row: 0,
    field: "available",
    code: "type",
  });
  expect(issues).toContainEqual({
    table: "work_orders",
    row: 1,
    field: "id",
    code: "duplicate",
  });
  expect(issues).toContainEqual({
    table: "eligibility",
    row: 20,
    field: "technician_id",
    code: "duplicate",
  });
  expect(issues).toContainEqual({
    table: "eligibility",
    row: 1,
    field: "technician_id",
    code: "reference",
  });
  expect(issues).toContainEqual({
    table: "technicians",
    row: 0,
    field: undefined,
    code: "extra",
  });
});
it("enforces record and table bounds and does not infer absence as an error reason", () => {
  expect(validateRecords(input())).toEqual([]);
  const records = input();
  records.work_orders = Array.from({ length: 33 }, (_, index) => ({
    id: `order-${index}`,
  }));
  expect(validateRecords(records)).toEqual([
    { table: "work_orders", code: "limit" },
  ]);
  expect(() =>
    extractRecords({ ...input(), eligibility: Array(129).fill({}) }),
  ).toThrow();
});
describe("strict normalized file parsing", () => {
  it.each([
    '{"work_orders":[],"work_orders":[],"technicians":[],"eligibility":[]}',
    '{"work_orders":[{"id":"a","id":"b"}],"technicians":[],"eligibility":[]}',
    '{"work_orders":[{"id":"a","\\u0069d":"b"}],"technicians":[],"eligibility":[]}',
    '{"tables":{"work_orders":{"records":[],"other":[]}}}',
    '{"work_orders":{},"technicians":[],"eligibility":[]}',
    '{"work_orders":[],"technicians":[],"eligibility":[],"extra":[]}',
    '{"work_orders":[null],"technicians":[],"eligibility":[]}',
    '{"broken":',
    "[".repeat(20) + "0" + "]".repeat(20),
  ])("rejects ambiguous or malformed source: %s", (value) =>
    expect(() => parseRecords(value)).toThrow(),
  );
});
it("accepts a genuine single-column CSV without weakening inconsistent delimiter rejection", () => {
  expect(readCsv("id\na\nb\n")).toEqual([["id"], ["a"], ["b"]]);
  expect(readCsv('id\n"a,b"\n')).toEqual([["id"], ["a,b"]]);
  expect(() => readCsv("id\na,b\n")).toThrow();
  expect(() => readCsv("id;name\na,b\n")).toThrow();
});
