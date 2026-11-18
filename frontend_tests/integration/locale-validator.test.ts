import { describe, expect, it } from "vitest";
import {
  defaultLocale,
  supportedLocales,
} from "../../frontend/src/shared/i18n/supported-locales";

type Catalog = Record<string, unknown>;
const marker = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;
const catalogs = import.meta.glob("../../frontend/src/locales/*/*", {
  eager: true,
  import: "default",
});

function equalSet(
  actual: string[],
  expected: readonly string[],
  location: string,
): void {
  const missing = expected.filter((value) => !actual.includes(value));
  const extra = actual.filter((value) => !expected.includes(value));
  if (missing.length || extra.length) {
    throw new Error(
      `${location}: missing [${missing.join(", ")}]; unexpected [${extra.join(", ")}]`,
    );
  }
}

function placeholders(text: string, location: string): string[] {
  if (/[{}]/.test(text.replace(marker, "")))
    throw new Error(`${location}: malformed placeholder`);
  return [...new Set(Array.from(text.matchAll(marker), (match) => match[1]))];
}

function dictionary(value: unknown, location: string): Record<string, string> {
  if (
    !value ||
    Array.isArray(value) ||
    typeof value !== "object" ||
    !Object.keys(value).length
  ) {
    throw new Error(`${location}: expected a nonempty object`);
  }
  for (const [key, text] of Object.entries(value)) {
    if (typeof text !== "string" || !text.trim())
      throw new Error(`${location}:${key}: expected nonempty text`);
    placeholders(text, `${location}:${key}`);
  }
  return value as Record<string, string>;
}

function validate(catalog: Catalog): void {
  const paths = Object.keys(catalog);
  const locales = [...new Set(paths.map((path) => path.split("/")[0]))];
  equalSet(locales, supportedLocales, "Locale folders");
  const files = paths
    .filter((path) => path.startsWith(`${defaultLocale}/`))
    .map((path) => path.split("/")[1]);
  if (!files.length || files.some((file) => !file.endsWith(".json")))
    throw new Error("Expected component JSON files");
  for (const locale of supportedLocales) {
    equalSet(
      paths
        .filter((path) => path.startsWith(`${locale}/`))
        .map((path) => path.split("/")[1]),
      files,
      locale,
    );
    for (const file of files) {
      const base = dictionary(
        catalog[`${defaultLocale}/${file}`],
        `${defaultLocale}/${file}`,
      );
      const translated = dictionary(
        catalog[`${locale}/${file}`],
        `${locale}/${file}`,
      );
      equalSet(
        Object.keys(translated),
        Object.keys(base),
        `${locale}/${file} keys`,
      );
      for (const key of Object.keys(base)) {
        const location = `${locale}/${file}:${key}`;
        equalSet(
          placeholders(translated[key], location),
          placeholders(base[key], location),
          location,
        );
      }
    }
  }
}

function fixture(): Catalog {
  return Object.fromEntries(
    supportedLocales.map((locale) => [
      `${locale}/test.json`,
      { page: "Page {page} of {lastPage}" },
    ]),
  );
}

describe("locale catalogs", () => {
  it("keeps shipped locales, components, keys and placeholders consistent", () => {
    validate(
      Object.fromEntries(
        Object.entries(catalogs).map(([path, value]) => [
          path.split("/locales/")[1],
          value,
        ]),
      ),
    );
  });
  it("accepts matching dictionaries", () =>
    expect(() => validate(fixture())).not.toThrow());
  it("rejects extra or missing keys", () => {
    expect(() =>
      validate({
        ...fixture(),
        "de-DE/test.json": { wrong: "Seite {page} von {lastPage}" },
      }),
    ).toThrow("de-DE/test.json keys");
  });
  it("rejects altered placeholders", () => {
    expect(() =>
      validate({
        ...fixture(),
        "de-DE/test.json": { page: "Seite {page} von {last}" },
      }),
    ).toThrow("missing [lastPage]; unexpected [last]");
  });
  it.each([null, [], {}, { page: "" }, { page: 42 }, { page: "Page {broken" }])(
    "rejects malformed dictionaries: %j",
    (value) => {
      expect(() =>
        validate({ ...fixture(), "de-DE/test.json": value }),
      ).toThrow();
    },
  );
  it("rejects missing locales and components", () => {
    const missingLocale = fixture();
    delete missingLocale["de-DE/test.json"];
    expect(() => validate(missingLocale)).toThrow("Locale folders");
    expect(() =>
      validate({ ...fixture(), "de-DE/extra.json": { page: "Extra" } }),
    ).toThrow("de-DE");
  });
});
