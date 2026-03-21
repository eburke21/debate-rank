import { Badge, Box, Flex, Text } from "@chakra-ui/react";
import { motion } from "framer-motion";
import type { ArgumentSummary, Rubric } from "../types/index.ts";
import { RUBRICS } from "../types/index.ts";

const RUBRIC_COLORS: Record<Rubric, string> = {
  logic: "blue",
  evidence: "green",
  persuasion: "purple",
  originality: "orange",
};

interface LeaderboardRowProps {
  argument: ArgumentSummary;
  rank: number;
  weightedScore: number;
  onClick: () => void;
}

function MiniScoreBar({ scores }: { scores: ArgumentSummary["scores"] }) {
  return (
    <Flex gap={1} align="center" minW="120px">
      {RUBRICS.map((rubric) => {
        const score = scores[rubric] ?? 0;
        return (
          <Box key={rubric} flex={1}>
            <Box
              bg={`${RUBRIC_COLORS[rubric]}.500`}
              h="6px"
              borderRadius="full"
              w={`${score * 10}%`}
              transition="width 0.3s ease"
            />
          </Box>
        );
      })}
    </Flex>
  );
}

export function LeaderboardRow({
  argument,
  rank,
  weightedScore,
  onClick,
}: LeaderboardRowProps) {
  const bodyPreview =
    argument.body.length > 120
      ? argument.body.slice(0, 120) + "..."
      : argument.body;

  return (
    <motion.div layout transition={{ type: "spring", duration: 0.3 }}>
      <Flex
        p={3}
        borderWidth="1px"
        borderRadius="md"
        cursor="pointer"
        _hover={{ bg: "bg.subtle" }}
        onClick={onClick}
        align="center"
        gap={3}
        transition="background 0.15s ease"
      >
        {/* Rank badge */}
        <Badge
          variant="solid"
          colorPalette={rank <= 3 ? "yellow" : "gray"}
          fontSize="sm"
          minW="32px"
          textAlign="center"
        >
          #{rank}
        </Badge>

        {/* Body + author */}
        <Box flex={1} minW={0}>
          <Text fontSize="sm" lineClamp={2}>
            {bodyPreview}
          </Text>
          {argument.author_name && (
            <Text fontSize="xs" color="fg.muted" mt={0.5}>
              — {argument.author_name}
            </Text>
          )}
        </Box>

        {/* Mini score bars */}
        <Box display={{ base: "none", md: "block" }}>
          <MiniScoreBar scores={argument.scores} />
        </Box>

        {/* Weighted score */}
        <Text fontWeight="bold" fontSize="lg" minW="48px" textAlign="right">
          {weightedScore.toFixed(1)}
        </Text>
      </Flex>
    </motion.div>
  );
}
