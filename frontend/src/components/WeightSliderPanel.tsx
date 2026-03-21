import { Box, Button, Flex, Heading, Stack } from "@chakra-ui/react";
import type { Rubric, Weights } from "../types/index.ts";
import { RUBRICS } from "../types/index.ts";
import { WeightSlider } from "./WeightSlider.tsx";

const RUBRIC_COLORS: Record<Rubric, string> = {
  logic: "blue",
  evidence: "green",
  persuasion: "purple",
  originality: "orange",
};

interface WeightSliderPanelProps {
  weights: Weights;
  onSetWeight: (rubric: Rubric, value: number) => void;
  onReset: () => void;
}

export function WeightSliderPanel({
  weights,
  onSetWeight,
  onReset,
}: WeightSliderPanelProps) {
  const isDefault = RUBRICS.every((r) => weights[r] === 25);

  return (
    <Box
      borderWidth="1px"
      borderRadius="lg"
      p={4}
      mb={6}
      bg="bg.subtle"
    >
      <Flex justify="space-between" align="center" mb={4}>
        <Heading size="sm">Rubric Weights</Heading>
        <Button
          size="xs"
          variant="ghost"
          onClick={onReset}
          disabled={isDefault}
        >
          Reset to Equal
        </Button>
      </Flex>

      <Stack gap={3}>
        {RUBRICS.map((rubric) => (
          <WeightSlider
            key={rubric}
            rubric={rubric}
            value={weights[rubric]}
            onChange={(v) => onSetWeight(rubric, v)}
            colorPalette={RUBRIC_COLORS[rubric]}
          />
        ))}
      </Stack>

      {/* Distribution bar */}
      <Flex mt={4} h="8px" borderRadius="full" overflow="hidden">
        {RUBRICS.map((rubric) => (
          <Box
            key={rubric}
            bg={`${RUBRIC_COLORS[rubric]}.500`}
            flex={weights[rubric]}
            transition="flex 0.3s ease"
          />
        ))}
      </Flex>
    </Box>
  );
}
