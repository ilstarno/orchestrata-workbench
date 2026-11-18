// @vitest-environment jsdom
import { Blob as NodeBlob } from "node:buffer";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readWorkbook } from "../../frontend/src/features/assignment/spreadsheet/file-reader";
import {
  suggestMapping,
  checkMapping,
} from "../../frontend/src/features/assignment/spreadsheet/mapping";
import {
  restoreMapping,
  saveMapping,
} from "../../frontend/src/features/assignment/spreadsheet/saved-mapping";
const bytes = () =>
  new Uint8Array(
    readFileSync(
      resolve("../frontend_tests/fixtures/spreadsheet/example.xlsx"),
    ),
  );
function file(data: Uint8Array | string, name = "test.xlsx"): File {
  const content =
    typeof data === "string" ? new TextEncoder().encode(data) : data;
  return {
    name,
    size: content.byteLength,
    arrayBuffer: async () => content.slice().buffer,
  } as File;
}
beforeEach(() => vi.stubGlobal("Blob", NodeBlob));
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});
it("reads a genuine synthetic XLSX and paired export CSV fixtures with original rows", async () => {
  const excel = await readWorkbook(file(bytes()));
  const checked = checkMapping(excel, suggestMapping(excel, false));
  expect(checked.issues).toEqual([]);
  expect(checked.input?.jobs).toHaveLength(3);
  const jobs = await readWorkbook(
    file(
      readFileSync(
        resolve("../frontend_tests/fixtures/spreadsheet/work-orders.csv"),
        "utf8",
      ),
      "jobs.csv",
    ),
  );
  const people = await readWorkbook(
    file(
      readFileSync(
        resolve("../frontend_tests/fixtures/spreadsheet/today-roster.csv"),
        "utf8",
      ),
      "people.csv",
    ),
  );
  const book = { sheets: [...jobs.sheets, ...people.sheets] },
    mapping = suggestMapping(book, true);
  expect(mapping.people.available).toBeNull();
  mapping.people.available = 2;
  expect(checkMapping(book, mapping).input?.people[2].available).toBe(false);
});
it.each(["formula", "external", "oversize", "malformed"])(
  "rejects %s XLSX content before review",
  async (variant) => {
    const entries = unzipSync(bytes());
    if (variant === "formula") {
      const path = Object.keys(entries).find(
        (name) => name.startsWith("xl/worksheets/") && name.endsWith(".xml"),
      )!;
      expect(strFromU8(entries[path])).toMatch(/<\/(?:\w+:)?c>/);
      entries[path] = strToU8(
        strFromU8(entries[path]).replace(/(<\/(?:\w+:)?c>)/, "<f>1+1</f>$1"),
      );
    } else if (variant === "external")
      entries["xl/externalLinks/externalLink1.xml"] = strToU8("<x/>");
    else if (variant === "oversize")
      entries["huge.xml"] = strToU8("x".repeat(2097153));
    else entries["xl/workbook.xml"] = strToU8("<broken>");
    await expect(readWorkbook(file(zipSync(entries)))).rejects.toThrow();
  },
);
it("rejects invalid ZIP, unsupported extension, overlarge file and invalid UTF-8", async () => {
  await expect(readWorkbook(file("not a ZIP"))).rejects.toMatchObject({
    code: "invalid-file",
  });
  await expect(readWorkbook(file("abc", "macro.xlsm"))).rejects.toMatchObject({
    code: "unsupported-file",
  });
  await expect(
    readWorkbook(file(new Uint8Array(2097153))),
  ).rejects.toMatchObject({ code: "file-limit" });
  await expect(
    readWorkbook(file(new Uint8Array([255, 255]), "bad.csv")),
  ).rejects.toMatchObject({ code: "invalid-file" });
});
it("reuses intentionally saved mappings after columns move, without saving workbook values or filenames", async () => {
  const book = await readWorkbook(file(bytes(), "private-filename.xlsx"));
  const mapping = suggestMapping(book, false);
  expect(saveMapping(book, mapping)).toBe(true);
  const saved = localStorage.getItem("orchestrata.assignment-columns.v1")!;
  expect(saved).not.toContain("private-filename");
  expect(saved).not.toContain("Lift repair");
  for (const sheet of book.sheets)
    for (const row of sheet.sourceRows) row.reverse();
  const restored = restoreMapping(book, suggestMapping(book, false));
  expect(checkMapping(book, restored).issues).toEqual([]);
  const people = book.sheets[restored.people.sheet!];
  people.sourceRows[0].push(people.sourceRows[0][restored.people.name!]);
  expect(saveMapping(book, restored)).toBe(false);
});
