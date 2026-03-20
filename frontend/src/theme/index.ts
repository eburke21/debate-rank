import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

const config = defineConfig({
  theme: {
    semanticTokens: {
      colors: {
        "rubric.logic": { value: "{colors.blue.500}" },
        "rubric.evidence": { value: "{colors.green.500}" },
        "rubric.persuasion": { value: "{colors.purple.500}" },
        "rubric.originality": { value: "{colors.orange.500}" },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
