import { Box, Flex, Slider, Text } from "@chakra-ui/react";
import type { Rubric } from "../types/index.ts";
import { RUBRIC_META } from "../types/index.ts";

interface WeightSliderProps {
  rubric: Rubric;
  value: number;
  onChange: (value: number) => void;
  colorPalette: string;
}

export function WeightSlider({
  rubric,
  value,
  onChange,
  colorPalette,
}: WeightSliderProps) {
  const meta = RUBRIC_META[rubric];

  return (
    <Box>
      <Flex justify="space-between" mb={1}>
        <Text fontSize="sm" fontWeight="medium">
          {meta.icon} {meta.name}
        </Text>
        <Text fontSize="sm" fontWeight="bold" color={`${colorPalette}.500`}>
          {value}%
        </Text>
      </Flex>
      <Slider.Root
        min={0}
        max={100}
        step={1}
        value={[value]}
        onValueChange={(details) => onChange(details.value[0])}
        colorPalette={colorPalette}
        size="md"
      >
        <Slider.Control>
          <Slider.Track>
            <Slider.Range />
          </Slider.Track>
          <Slider.Thumb index={0}>
            <Slider.HiddenInput />
          </Slider.Thumb>
        </Slider.Control>
      </Slider.Root>
    </Box>
  );
}
