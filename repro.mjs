// On macOS, an edit saved right after the first compile is never reported by
// rspack's watcher when ts-checker-rspack-plugin 1.7.x is installed.
//
//   node repro.mjs [plugin] [runs]
//
// plugin: ts-checker-rspack-plugin (1.7.1, default), ts-checker-rspack-plugin-1.6.2, or none
// DELAY:   ms between the first compile's callback and the save (default 5)
// MODULES: modules in their own directories under src/ (default 30)
import fs from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const [, , pluginName = "ts-checker-rspack-plugin", runs = "20"] = process.argv;
const delay = Number(process.env.DELAY ?? 5);
const modules = Number(process.env.MODULES ?? 30);

const { rspack } = require("@rspack/core");
const { TsCheckerRspackPlugin } = pluginName === "none" ? {} : require(pluginName);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let rebuilt = 0;
for (let run = 0; run < Number(runs); run++) {
  const root = fs.realpathSync(fs.mkdtempSync(join(tmpdir(), "lost-edit-")));
  const files = {
    "tsconfig.json": JSON.stringify({
      compilerOptions: { strict: true, noEmit: true, module: "esnext", moduleResolution: "bundler", target: "esnext" },
      include: ["src"],
    }),
    "src/a.ts": "export const a: number = 1;\n",
  };
  let index = 'import { a } from "./a";\nconsole.log(a);\n';
  for (let i = 0; i < modules; i++) {
    files[`src/m${i}/index.ts`] = `export const m${i}: number = ${i};\n`;
    index += `import { m${i} } from "./m${i}/index";\nconsole.log(m${i});\n`;
  }
  files["src/index.ts"] = index;
  // Written in the past, so that rspack's watcher does not count the setup as a change.
  const past = new Date(Date.now() - 60_000);
  for (const [path, content] of Object.entries(files)) {
    fs.mkdirSync(join(root, path, ".."), { recursive: true });
    fs.writeFileSync(join(root, path), content);
    fs.utimesSync(join(root, path), past, past);
  }

  const compiler = rspack({
    mode: "development",
    context: root,
    entry: "./src/index.ts",
    devtool: false,
    output: { path: join(root, "dist") },
    resolve: { extensions: [".ts", ".js"] },
    module: {
      rules: [{ test: /\.ts$/, loader: "builtin:swc-loader", options: { jsc: { parser: { syntax: "typescript" } } } }],
    },
    plugins: TsCheckerRspackPlugin
      ? [
          new TsCheckerRspackPlugin({
            async: false,
            typescript: {
              configFile: join(root, "tsconfig.json"),
              context: root,
              typescriptPath: require.resolve("typescript/package.json"),
              tsgo: true,
            },
          }),
        ]
      : [],
  });

  let compiles = 0;
  const secondCompile = new Promise((resolve) => {
    compiler.watch({}, () => {
      compiles += 1;
      if (compiles === 1) {
        setTimeout(() => {
          // An atomic save, as editors do.
          fs.writeFileSync(join(root, "src/a.ts.tmp"), "export const a: number = 2;\n");
          fs.renameSync(join(root, "src/a.ts.tmp"), join(root, "src/a.ts"));
        }, delay);
      }
      if (compiles === 2) resolve(true);
    });
  });
  if (await Promise.race([secondCompile, sleep(5000).then(() => false)])) rebuilt += 1;
  await new Promise((resolve) => compiler.close(resolve));
  fs.rmSync(root, { recursive: true, force: true });
}
console.log(`${pluginName}, DELAY=${delay}, MODULES=${modules}: rebuilt after the save in ${rebuilt}/${runs}`);
process.exit(0);
