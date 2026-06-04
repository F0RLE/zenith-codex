import { spawnSync } from "node:child_process";
import { tauriInvocation, withZenithRustEnv } from "./tauri-env.mjs";

const invocation = tauriInvocation(["dev"]);
const result = spawnSync(invocation.command, invocation.args, {
  env: withZenithRustEnv(),
  shell: invocation.shell,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
