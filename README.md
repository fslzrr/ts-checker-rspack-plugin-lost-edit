# ts-checker-rspack-plugin: a lost edit on macOS

A reproduction for ts-checker-rspack-plugin 1.7.x. On macOS, rspack's watcher can miss an edit that is saved right after a compile. With 1.6.2, or without the plugin, the same edit triggers a rebuild every time.

## Run it

You need macOS and Node 24.

```sh
npm install
node repro.mjs                                  # 1.7.1: most saves are lost
node repro.mjs ts-checker-rspack-plugin-1.6.2   # 1.6.2: every save rebuilds
node repro.mjs none                             # no plugin: every save rebuilds
```

Each run creates an app with 30 modules in their own directories under `src/`. It starts rspack in watch mode, then saves `src/a.ts` 5 ms after the first compile's callback. The script prints in how many runs a second compile followed the save.

To move the save, set `DELAY=<ms>`. To change the number of module directories, set `MODULES=<n>`.

## Results

On macOS 26 (Darwin 25.6.0), Apple Silicon, Node 24.20.0, 20 runs each:

| Plugin | Save after the first compile | Modules in their own directories | Rebuilt after the save |
| --- | --- | --- | --- |
| 1.7.1 | 5 ms | 30 | 3/20 |
| 1.6.2 | 5 ms | 30 | 20/20 |
| none | 5 ms | 30 | 20/20 |
| 1.7.1 | 10 ms | 30 | 14/20 |
| 1.7.1 | 50 ms | 30 | 20/20 |
| 1.7.1 | 5 ms | 0 | 20/20 |
