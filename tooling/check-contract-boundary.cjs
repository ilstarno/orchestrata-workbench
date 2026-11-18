const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const ts = require("../frontend/node_modules/typescript");

function schemaObject(value) {
  if (Array.isArray(value)) return value.some(schemaObject);
  if (!value || typeof value !== "object") return false;
  const entries = Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key.toLowerCase(), item]),
  );
  if (typeof entries.openapi === "string" && /^3\./.test(entries.openapi))
    return true;
  if (typeof entries.swagger === "string" && /^2\./.test(entries.swagger))
    return true;
  if (
    typeof entries.$schema === "string" &&
    /json-schema\.org/i.test(entries.$schema)
  )
    return true;
  if (
    typeof entries.$ref === "string" &&
    /^#\/(?:components\/schemas|definitions)\//i.test(entries.$ref)
  )
    return true;
  if (
    entries.schemas &&
    typeof entries.schemas === "object" &&
    Object.values(entries.schemas).some(
      (item) =>
        item &&
        typeof item === "object" &&
        ("properties" in item || "type" in item || "$ref" in item),
    )
  )
    return true;
  return Object.values(value).some(schemaObject);
}
function inspectText(filename, text) {
  const issues = [];
  if (/(?:openapi|swagger)(?:\/|[^/]*\.(?:json|ya?ml)$)/i.test(filename))
    issues.push("raw specification path");
  function serialized(value) {
    try {
      if (schemaObject(JSON.parse(value))) return true;
    } catch {}
    if (
      /^(?:data:[^,]*;base64,)?[A-Za-z0-9+/\r\n]+={0,2}$/.test(value) &&
      value.length >= 40 &&
      value.length < 4_000_000
    ) {
      try {
        return schemaObject(
          JSON.parse(
            Buffer.from(
              value.replace(/^data:[^,]*;base64,/, ""),
              "base64",
            ).toString("utf8"),
          ),
        );
      } catch {}
    }
    return false;
  }
  if (
    serialized(text) ||
    /(?:^|[\n,{;])\s*["']?(?:openapi|swagger)["']?\s*:\s*["']?[23]\.\d/i.test(
      text,
    )
  )
    issues.push("raw specification or schema content");
  if (/\.(?:[cm]?[jt]sx?|html)$/i.test(filename)) {
    const source = ts.createSourceFile(
      filename,
      text,
      ts.ScriptTarget.Latest,
      true,
      filename.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    function read(node) {
      if (ts.isStringLiteralLike(node)) return node.text;
      if (ts.isObjectLiteralExpression(node)) {
        const object = Object.create(null);
        for (const property of node.properties) {
          if (
            ts.isPropertyAssignment(property) &&
            (ts.isIdentifier(property.name) ||
              ts.isStringLiteralLike(property.name))
          )
            object[property.name.text] = read(property.initializer);
        }
        return object;
      }
      return undefined;
    }
    function visit(node) {
      if (
        (ts.isStringLiteralLike(node) && serialized(node.text)) ||
        (ts.isObjectLiteralExpression(node) && schemaObject(read(node)))
      )
        issues.push("embedded specification or schema");
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  return [...new Set(issues)].map((issue) => filename + ": " + issue);
}
function inspectGenerated(files) {
  const issues = [];
  for (const [name, text] of files) {
    if (!name.endsWith(".ts")) {
      issues.push(name + ": generated files must be TypeScript");
      continue;
    }
    const source = ts.createSourceFile(
      name,
      text,
      ts.ScriptTarget.Latest,
      true,
    );
    if (source.parseDiagnostics.length)
      issues.push(name + ": invalid generated syntax");
    const declarations = source.statements.filter(
      (node) => !ts.isImportDeclaration(node) && !ts.isExportDeclaration(node),
    );
    if (["index.ts", "orchestrata.ts"].includes(path.basename(name))) {
      if (!source.statements.every(ts.isExportDeclaration))
        issues.push(name + ": barrels must only re-export");
      continue;
    }
    if (declarations.length !== 1) {
      issues.push(name + ": expected one generated declaration");
      continue;
    }
    const node = declarations[0];
    if (
      !ts.isTypeAliasDeclaration(node) &&
      !ts.isInterfaceDeclaration(node) &&
      !(
        ts.isVariableStatement(node) &&
        node.declarationList.declarations.length === 1
      )
    )
      issues.push(name + ": unsupported generated declaration");
    if (
      ts.isInterfaceDeclaration(node) &&
      ["components", "operations", "paths", "ComponentSchemas"].includes(
        node.name.text,
      )
    ) {
      if (
        node.members.some(
          (member) => member.type && ts.isTypeLiteralNode(member.type),
        )
      )
        issues.push(name + ": contract indexes must reference separate types");
    }
  }
  return issues;
}
const excludedDirectories = new Set([
  ".git",
  "node_modules",
  ".cache",
  ".vite",
  ".turbo",
  "coverage",
  "test-results",
  "playwright-report",
]);
function walk(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .flatMap((entry) => {
      if (entry.isDirectory() && excludedDirectories.has(entry.name)) return [];
      const file = path.join(directory, entry.name);
      if (entry.isSymbolicLink())
        throw new Error("Unexpected artifact symlink: " + file);
      return entry.isDirectory() ? walk(file) : [file];
    });
}
function inventory(files) {
  return Object.fromEntries(
    [...files]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([name, text]) => [
        name.split(path.sep).join("/"),
        crypto.createHash("sha256").update(text).digest("hex"),
      ]),
  );
}
function inspectInventory(files, expected) {
  const actual = inventory(files);
  const issues = [];
  for (const name of new Set([
    ...Object.keys(actual),
    ...Object.keys(expected),
  ])) {
    if (!(name in actual)) issues.push(name + ": missing generated contract");
    else if (!(name in expected))
      issues.push(name + ": unexpected generated contract");
    else if (actual[name] !== expected[name])
      issues.push(name + ": stale generated contract or export");
  }
  if (!Object.keys(expected).length)
    issues.push("Generated inventory must not be empty");
  return issues;
}
function check(root) {
  const generated = path.join(root, "frontend/src/shared/api/generated");
  const issues = [];
  // Walk owned source and build files identically in checkouts and source archives.
  const files = walk(root);
  for (const file of files) {
    const bytes = fs.readFileSync(file),
      name = path.relative(root, file).split(path.sep).join("/");
    if (bytes.includes(0)) {
      if (/(?:openapi|swagger).*\.(?:json|ya?ml)$/i.test(name))
        issues.push(name + ": raw specification path");
      continue;
    }
    issues.push(...inspectText(name, bytes.toString("utf8")));
  }
  const declarations = walk(generated).map((file) => [
    path.relative(generated, file),
    fs.readFileSync(file, "utf8"),
  ]);
  issues.push(...inspectGenerated(declarations));
  const inventoryPath = path.join(root, "tooling/contract-inventory.json");
  if (!fs.existsSync(inventoryPath))
    issues.push("Missing generated contract inventory");
  else
    issues.push(
      ...inspectInventory(
        declarations,
        JSON.parse(fs.readFileSync(inventoryPath, "utf8")),
      ),
    );
  return { issues, inspected: files.length };
}
module.exports = {
  inspectText,
  inspectGenerated,
  inventory,
  inspectInventory,
  check,
};
if (require.main === module) {
  const result = check(path.resolve(__dirname, ".."));
  if (result.issues.length) {
    console.error(result.issues.join("\n"));
    process.exitCode = 1;
  } else
    console.log(
      "Contract boundary passed for " +
        result.inspected +
        " source/build files",
    );
}
