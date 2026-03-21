import {
  Badge,
  Box,
  Drawer,
  Flex,
  Heading,
  Portal,
  Skeleton,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { fetchArgumentDetail } from "../api/client.ts";
import type { ArgumentDetail } from "../types/index.ts";
import { RUBRICS } from "../types/index.ts";
import { JudgeCard } from "./JudgeCard.tsx";
import { ScoreRadarChart } from "./ScoreRadarChart.tsx";

interface ArgumentDetailDrawerProps {
  argumentId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ArgumentDetailDrawer({
  argumentId,
  isOpen,
  onClose,
}: ArgumentDetailDrawerProps) {
  const [detail, setDetail] = useState<ArgumentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchArgumentDetail(id);
      setDetail(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load argument detail";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (argumentId && isOpen) {
      void loadDetail(argumentId);
    }
    if (!isOpen) {
      // Reset state when drawer closes
      setDetail(null);
      setError(null);
    }
  }, [argumentId, isOpen, loadDetail]);

  const scoredRubrics = detail
    ? RUBRICS.filter((r) => detail.scores.some((s) => s.rubric === r))
    : [];
  const pendingRubrics = detail
    ? RUBRICS.filter((r) => !detail.scores.some((s) => s.rubric === r))
    : [];

  return (
    <Drawer.Root
      open={isOpen}
      placement="end"
      size={{ base: "full", md: "md" }}
      onOpenChange={(e) => {
        if (!e.open) onClose();
      }}
    >
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content>
            <Drawer.CloseTrigger />
            <Drawer.Header>
              <Drawer.Title>Argument Detail</Drawer.Title>
            </Drawer.Header>

            <Drawer.Body>
              {loading && (
                <Stack gap={4}>
                  <Skeleton height="100px" borderRadius="md" />
                  <Skeleton height="250px" borderRadius="md" />
                  <Skeleton height="80px" borderRadius="md" />
                  <Skeleton height="80px" borderRadius="md" />
                  <Skeleton height="80px" borderRadius="md" />
                  <Skeleton height="80px" borderRadius="md" />
                </Stack>
              )}

              {error && (
                <Box
                  p={4}
                  borderWidth="1px"
                  borderRadius="md"
                  borderColor="red.500"
                  bg={{ base: "red.50", _dark: "red.950" }}
                >
                  <Text color={{ base: "red.700", _dark: "red.200" }}>{error}</Text>
                </Box>
              )}

              {detail && !loading && (
                <Stack gap={6}>
                  {/* Full argument text */}
                  <Box>
                    <Text fontSize="sm" lineHeight="tall">
                      {detail.body}
                    </Text>
                    {detail.author_name && (
                      <Text fontSize="xs" color="fg.muted" mt={2}>
                        — {detail.author_name}
                      </Text>
                    )}
                    <Flex mt={2} gap={2} align="center">
                      <Badge
                        size="sm"
                        colorPalette={
                          detail.status === "scored"
                            ? "green"
                            : detail.status === "partial"
                              ? "yellow"
                              : detail.status === "failed"
                                ? "red"
                                : "gray"
                        }
                      >
                        {detail.status}
                      </Badge>
                      {detail.composite_score != null && (
                        <Text fontSize="sm" fontWeight="bold">
                          Composite: {detail.composite_score.toFixed(1)}
                        </Text>
                      )}
                    </Flex>
                  </Box>

                  {/* Radar chart */}
                  {detail.scores.length > 0 && (
                    <Box>
                      <Heading size="sm" mb={2}>
                        Score Profile
                      </Heading>
                      <ScoreRadarChart scores={detail.scores} />
                    </Box>
                  )}

                  {/* Judge cards */}
                  <Box>
                    <Heading size="sm" mb={3}>
                      Judge Evaluations
                    </Heading>
                    <Stack gap={3}>
                      {scoredRubrics.map((rubric) => {
                        const scoreData = detail.scores.find(
                          (s) => s.rubric === rubric,
                        )!;
                        return (
                          <JudgeCard key={rubric} score={scoreData} />
                        );
                      })}
                      {pendingRubrics.map((rubric) => (
                        <Box
                          key={rubric}
                          borderWidth="1px"
                          borderRadius="md"
                          p={3}
                          opacity={0.5}
                        >
                          <Text fontSize="sm" color="fg.muted">
                            ⏳ {rubric.charAt(0).toUpperCase() + rubric.slice(1)}{" "}
                            — Evaluation pending
                          </Text>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                </Stack>
              )}
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  );
}
