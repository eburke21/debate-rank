import { Box, Skeleton, Stack, Text } from "@chakra-ui/react";
import { AnimatePresence, LayoutGroup } from "framer-motion";
import { useMemo } from "react";
import type { ArgumentSummary, Weights } from "../types/index.ts";
import { computeComposite } from "../hooks/useWeights.ts";
import { LeaderboardRow } from "./LeaderboardRow.tsx";

interface LeaderboardProps {
  arguments: ArgumentSummary[];
  weights: Weights;
  onSelectArgument: (id: string) => void;
  loading?: boolean;
}

interface RankedArgument {
  argument: ArgumentSummary;
  weightedScore: number;
  rank: number;
}

export function Leaderboard({
  arguments: args,
  weights,
  onSelectArgument,
  loading,
}: LeaderboardProps) {
  const ranked: RankedArgument[] = useMemo(() => {
    const withScores = args.map((arg) => ({
      argument: arg,
      weightedScore: computeComposite(arg.scores, weights),
    }));

    withScores.sort((a, b) => b.weightedScore - a.weightedScore);

    return withScores.map((item, i) => ({
      ...item,
      rank: i + 1,
    }));
  }, [args, weights]);

  if (loading) {
    return (
      <Stack gap={3}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} height="72px" borderRadius="md" />
        ))}
      </Stack>
    );
  }

  if (args.length === 0) {
    return (
      <Box textAlign="center" py={8}>
        <Text color="fg.muted">No scored arguments yet.</Text>
      </Box>
    );
  }

  return (
    <LayoutGroup>
      <AnimatePresence mode="popLayout">
        <Stack gap={2}>
          {ranked.map((item) => (
            <LeaderboardRow
              key={item.argument.id}
              argument={item.argument}
              rank={item.rank}
              weightedScore={item.weightedScore}
              onClick={() => onSelectArgument(item.argument.id)}
            />
          ))}
        </Stack>
      </AnimatePresence>
    </LayoutGroup>
  );
}
