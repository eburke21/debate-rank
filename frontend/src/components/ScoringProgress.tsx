import { Box, Flex, Spinner, Text } from "@chakra-ui/react";
import { AnimatePresence, motion } from "framer-motion";
import type { Rubric, ScoreResponse } from "../types/index.ts";
import { RUBRIC_META, RUBRICS } from "../types/index.ts";

const RUBRIC_COLORS: Record<Rubric, string> = {
  logic: "blue",
  evidence: "green",
  persuasion: "purple",
  originality: "orange",
};

interface ScoringProgressProps {
  scores: ScoreResponse[];
  status: string;
}

export function ScoringProgress({ scores, status }: ScoringProgressProps) {
  const scoreMap = new Map(scores.map((s) => [s.rubric, s.score]));
  const isFailed = status === "failed";

  return (
    <Flex gap={3} wrap="wrap" justify="center">
      {RUBRICS.map((rubric) => {
        const score = scoreMap.get(rubric);
        const meta = RUBRIC_META[rubric];
        const color = RUBRIC_COLORS[rubric];
        const isScored = score != null;

        return (
          <Box
            key={rubric}
            borderWidth="1px"
            borderRadius="md"
            p={3}
            minW="100px"
            textAlign="center"
          >
            <Text fontSize="lg" mb={1}>
              {meta.icon}
            </Text>
            <Text fontSize="xs" fontWeight="medium" mb={2}>
              {meta.name}
            </Text>

            <AnimatePresence mode="wait">
              {isScored ? (
                <motion.div
                  key="score"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", duration: 0.4 }}
                >
                  <Text
                    fontSize="2xl"
                    fontWeight="bold"
                    color={`${color}.500`}
                  >
                    {score}
                  </Text>
                  <Text fontSize="xs" color="green.500">
                    ✓
                  </Text>
                </motion.div>
              ) : isFailed ? (
                <motion.div
                  key="failed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <Text fontSize="2xl" color="red.500">
                    ✗
                  </Text>
                  <Text fontSize="xs" color="red.500">
                    Failed
                  </Text>
                </motion.div>
              ) : (
                <motion.div
                  key="pending"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Spinner size="sm" color={`${color}.500`} />
                  <Text fontSize="xs" color="fg.muted" mt={1}>
                    Judging...
                  </Text>
                </motion.div>
              )}
            </AnimatePresence>
          </Box>
        );
      })}
    </Flex>
  );
}
