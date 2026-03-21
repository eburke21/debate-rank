import { Box, Collapsible, Flex, Text } from "@chakra-ui/react";
import type { Rubric, ScoreResponse } from "../types/index.ts";
import { RUBRIC_META } from "../types/index.ts";

const RUBRIC_COLORS: Record<Rubric, string> = {
  logic: "blue",
  evidence: "green",
  persuasion: "purple",
  originality: "orange",
};

interface JudgeCardProps {
  score: ScoreResponse;
}

export function JudgeCard({ score }: JudgeCardProps) {
  const meta = RUBRIC_META[score.rubric];
  const color = RUBRIC_COLORS[score.rubric];

  return (
    <Box borderWidth="1px" borderRadius="md" p={3}>
      <Flex justify="space-between" align="center" mb={1}>
        <Flex align="center" gap={2}>
          <Text fontSize="lg">{meta.icon}</Text>
          <Text fontWeight="semibold" fontSize="sm">
            {meta.name}
          </Text>
        </Flex>
        <Text fontWeight="bold" fontSize="xl" color={`${color}.500`}>
          {score.score}
        </Text>
      </Flex>

      <Collapsible.Root unmountOnExit>
        <Collapsible.Trigger asChild>
          <Text
            fontSize="xs"
            color="fg.muted"
            cursor="pointer"
            _hover={{ textDecoration: "underline" }}
          >
            Read rationale...
          </Text>
        </Collapsible.Trigger>
        <Collapsible.Content>
          <Text fontSize="sm" color="fg.muted" mt={2} lineHeight="tall">
            {score.rationale}
          </Text>
        </Collapsible.Content>
      </Collapsible.Root>
    </Box>
  );
}
