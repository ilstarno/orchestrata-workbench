const fs = require("node:fs");
const path = require("node:path");
const ts = require("../frontend/node_modules/typescript");

function splitContracts(text) {
  const source = ts.createSourceFile(
    "contracts.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
  );
  if (source.parseDiagnostics.length)
    throw new Error("Generated TypeScript has syntax errors");
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const print = (node) =>
    printer.printNode(ts.EmitHint.Unspecified, node, source);
  const files = new Map(),
    symbols = new Map(),
    exports = [];
  const add = (file, name, body, exported = false) => {
    if (!/^[$A-Za-z_][$A-Za-z0-9_]*$/.test(name))
      throw new Error("Unsupported generated identifier");
    if (files.has(file) || symbols.has(name))
      throw new Error("Duplicate generated symbol: " + name);
    files.set(file, { name, body });
    symbols.set(name, file);
    if (exported)
      exports.push({ name, file, value: body.startsWith("export const ") });
  };
  const alias = (file, name, type, docs = "") => {
    if (
      ts.isUnionTypeNode(type) &&
      type.types.filter(ts.isTypeLiteralNode).length > 1
    ) {
      type = ts.factory.createUnionTypeNode(
        type.types.map((part, index) => {
          if (!ts.isTypeLiteralNode(part)) return part;
          const variant = name + "Variant" + index;
          add(
            path.posix.dirname(file) + "/" + variant + ".ts",
            variant,
            "export type " + variant + " = " + print(part) + ";",
          );
          return ts.factory.createTypeReferenceNode(variant);
        }),
      );
    }
    add(file, name, docs + "export type " + name + " = " + print(type) + ";");
  };
  const docs = (node) =>
    (node.jsDoc ?? []).map((doc) => doc.getText(source) + "\n").join("");
  const map = (node, folder, nameFor) => {
    if (!node.members.every(ts.isPropertySignature))
      throw new Error("Unsupported contract member");
    return node.members
      .map((member) => {
        if (!member.type) throw new Error("Missing contract type");
        const key = member.name.getText(source),
          name = nameFor(member);
        alias(folder + "/" + name + ".ts", name, member.type, docs(member));
        return (
          docs(member) +
          key +
          (member.questionToken ? "?" : "") +
          ": " +
          name +
          ";"
        );
      })
      .join("\n");
  };
  for (const node of source.statements) {
    if (ts.isInterfaceDeclaration(node)) {
      const name = node.name.text;
      if (name === "components") {
        const sections = node.members.map((section) => {
          if (!ts.isPropertySignature(section) || !section.type)
            throw new Error("Unsupported components");
          if (!ts.isTypeLiteralNode(section.type)) return print(section);
          const name =
            "Component" +
            section.name.getText(source).replace(/^./, (s) => s.toUpperCase());
          const body = map(
            section.type,
            "schemas",
            (member) => member.name.text,
          );
          add(
            name + ".ts",
            name,
            "export interface " + name + " {\n" + body + "\n}",
          );
          return (
            section.name.getText(source) +
            (section.questionToken ? "?" : "") +
            ": " +
            name +
            ";"
          );
        });
        add(
          "components.ts",
          name,
          "export interface components {\n" + sections.join("\n") + "\n}",
          true,
        );
      } else if (name === "operations" || name === "paths") {
        const body = map(node, name, (member) => {
          if (name === "operations") return member.name.text;
          const method = member.type.members.find(
            (item) => item.type && ts.isIndexedAccessTypeNode(item.type),
          );
          if (!method || !ts.isLiteralTypeNode(method.type.indexType))
            throw new Error("Path has no operation reference");
          return (
            method.type.indexType.literal.text
              .split("_")
              .map((s) => s[0].toUpperCase() + s.slice(1))
              .join("") + "Path"
          );
        });
        add(
          name + ".ts",
          name,
          "export interface " + name + " {\n" + body + "\n}",
          true,
        );
      } else throw new Error("Unsupported generated interface: " + name);
    } else if (ts.isTypeAliasDeclaration(node)) {
      const exported = node.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      );
      add(
        node.name.text + ".ts",
        node.name.text,
        (exported ? "" : "export ") + print(node),
        exported,
      );
    } else if (
      ts.isVariableStatement(node) &&
      node.declarationList.declarations.length === 1
    ) {
      const name = node.declarationList.declarations[0].name;
      if (!ts.isIdentifier(name))
        throw new Error("Unsupported generated value");
      add("values/" + name.text + ".ts", name.text, print(node), true);
    } else throw new Error("Unsupported generated statement");
  }
  for (const required of [
    "paths",
    "operations",
    "components",
    "webhooks",
    "$defs",
  ]) {
    if (!symbols.has(required))
      throw new Error("Missing generated export: " + required);
  }
  const output = new Map();
  for (const [file, { name, body }] of files) {
    const ast = ts.createSourceFile(file, body, ts.ScriptTarget.Latest, true);
    const used = new Set();
    function visit(node) {
      if (ts.isIdentifier(node) && node.text !== name && symbols.has(node.text))
        used.add(node.text);
      ts.forEachChild(node, visit);
    }
    visit(ast);
    const imports = [...used]
      .sort()
      .map((symbol) => {
        let from = path.posix
          .relative(path.posix.dirname(file), symbols.get(symbol))
          .replace(/\.ts$/, "");
        if (!from.startsWith(".")) from = "./" + from;
        return (
          "import type { " + symbol + " } from " + JSON.stringify(from) + ";"
        );
      })
      .join("\n");
    output.set(
      file,
      "// Generated from authoritative TypeScript declarations.\n" +
        imports +
        "\n" +
        body +
        "\n",
    );
  }
  output.set(
    "orchestrata.ts",
    exports
      .map(
        ({ name, file, value }) =>
          "export " +
          (value ? "" : "type ") +
          "{ " +
          name +
          ' } from "./' +
          file.replace(/\.ts$/, "") +
          '";',
      )
      .join("\n") + "\n",
  );
  return output;
}
module.exports = { splitContracts };
if (require.main === module) {
  const [input, destination, inventoryPath] = process.argv.slice(2);
  if (!input || !destination)
    throw new Error(
      "Usage: node tooling/split-generated-contracts.cjs INPUT_GENERATED_TS NEW_OUTPUT_DIRECTORY [INVENTORY_JSON]",
    );
  if (fs.existsSync(destination))
    throw new Error("Output directory must not exist");
  const files = splitContracts(fs.readFileSync(input, "utf8"));
  for (const [name, text] of files) {
    const target = path.join(destination, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  }
  if (inventoryPath)
    fs.writeFileSync(
      inventoryPath,
      JSON.stringify(
        require("./check-contract-boundary.cjs").inventory(files),
        null,
        2,
      ) + "\n",
    );
  console.log("Generated " + files.size + " files");
}
