import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "langchain-tools": "src/langchain-tools.ts",
    "langgraph-node": "src/langgraph-node.ts",
    "openai-agents": "src/openai-agents.ts",
    "workflow-wrapper": "src/workflow-wrapper.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
});
