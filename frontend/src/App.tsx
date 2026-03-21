import { Box, Button, Container, Flex, IconButton, Skeleton, Spinner, Stack, Text, Theme } from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { seedDatabase } from "./api/client.ts";
import { useLeaderboard } from "./hooks/useLeaderboard.ts";
import { useWeights } from "./hooks/useWeights.ts";
import { useColorMode } from "./hooks/useColorMode.ts";
import { TopicHeader } from "./components/TopicHeader.tsx";
import { WeightSliderPanel } from "./components/WeightSliderPanel.tsx";
import { Leaderboard } from "./components/Leaderboard.tsx";
import { ArgumentDetailDrawer } from "./components/ArgumentDetailDrawer.tsx";
import { SubmitArgumentModal } from "./components/SubmitArgumentModal.tsx";
import { ColorModeButton } from "./components/ColorModeButton.tsx";
import { toaster } from "./components/toaster.ts";

function App() {
  const {
    topic,
    arguments: args,
    loading,
    error,
    refetch,
  } = useLeaderboard();
  const { weights, setWeight, resetWeights } = useWeights();
  const { appearance, toggleColorMode } = useColorMode();
  const [selectedArgumentId, setSelectedArgumentId] = useState<string | null>(
    null,
  );
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [highlightedArgumentId, setHighlightedArgumentId] = useState<
    string | null
  >(null);
  const [seeding, setSeeding] = useState(false);

  // Transition: seeding → done once data arrives (render-time, not effect)
  if (seeding && topic && args.length > 0) {
    setSeeding(false);
  }

  // Poll for new data while seeding is in progress
  useEffect(() => {
    if (!seeding) return;
    const interval = setInterval(() => void refetch(), 5000);
    return () => clearInterval(interval);
  }, [seeding, refetch]);

  const handleSeed = useCallback(async () => {
    try {
      setSeeding(true);
      await seedDatabase();
      toaster.success({
        title: "Seeding started",
        description: "Arguments will appear as judges finish evaluating (~2-3 min).",
      });
    } catch {
      setSeeding(false);
    }
  }, []);

  const handleSubmitComplete = useCallback(
    (argumentId: string) => {
      setHighlightedArgumentId(argumentId);
      void refetch();
      // Clear highlight after 2 seconds
      setTimeout(() => setHighlightedArgumentId(null), 2000);
    },
    [refetch],
  );

  return (
    <Theme appearance={appearance} minH="100vh">
      <Box minH="100vh" bg="bg" py={{ base: 4, md: 8 }}>
        <Container maxW="900px" px={{ base: 4, md: 6 }}>
          {/* App header with title and color mode toggle */}
          <Flex justify="space-between" align="center" mb={6}>
            <Text fontSize="xs" fontWeight="bold" letterSpacing="wide" color="fg.muted" textTransform="uppercase">
              DebateRank
            </Text>
            <Flex gap={1} align="center">
              <IconButton
                aria-label="Seed database with sample arguments"
                variant="ghost"
                size="sm"
                fontSize="lg"
                onClick={() => void handleSeed()}
                disabled={seeding}
              >
                {seeding ? <Spinner size="sm" /> : "🌱"}
              </IconButton>
              <ColorModeButton
                appearance={appearance}
                onToggle={toggleColorMode}
              />
            </Flex>
          </Flex>

          {error && (
            <Box
              p={4}
              mb={4}
              borderWidth="1px"
              borderRadius="md"
              borderColor="red.500"
              bg={{ base: "red.50", _dark: "red.950" }}
            >
              <Text color={{ base: "red.700", _dark: "red.200" }}>{error}</Text>
            </Box>
          )}

          {loading && !topic && (
            <Stack gap={2} mb={6}>
              <Skeleton height="32px" width="60%" borderRadius="md" />
              <Skeleton height="20px" width="80%" borderRadius="md" />
              <Skeleton height="20px" width="100px" borderRadius="md" />
            </Stack>
          )}

          {!loading && !topic && !error && (
            <Box
              textAlign="center"
              py={16}
              px={6}
              borderWidth="1px"
              borderRadius="lg"
              borderStyle="dashed"
              borderColor="border"
            >
              <Text fontSize="4xl" mb={4}>⚖️</Text>
              <Text fontWeight="semibold" fontSize="xl" mb={2}>
                Welcome to DebateRank
              </Text>
              <Text color="fg.muted" fontSize="sm" maxW="450px" mx="auto" mb={4}>
                No debate topic has been set up yet. Click the seed button above
                to add a topic and 12 sample arguments evaluated by 4 AI judges.
              </Text>
              <Button
                colorPalette="blue"
                size="sm"
                onClick={() => void handleSeed()}
                disabled={seeding}
              >
                {seeding ? <><Spinner size="xs" mr={2} /> Seeding...</> : "🌱 Seed Database"}
              </Button>
            </Box>
          )}

          {topic && <TopicHeader topic={topic} />}

          {topic && (
            <>
              <WeightSliderPanel
                weights={weights}
                onSetWeight={setWeight}
                onReset={resetWeights}
              />

              <Leaderboard
                arguments={args}
                weights={weights}
                onSelectArgument={(id) => setSelectedArgumentId(id)}
                loading={loading}
                highlightedArgumentId={highlightedArgumentId}
              />

              <Flex justify="center" mt={6}>
                <Button
                  colorPalette="blue"
                  size="lg"
                  onClick={() => setIsSubmitModalOpen(true)}
                >
                  Submit an Argument
                </Button>
              </Flex>
            </>
          )}
        </Container>
      </Box>

      <ArgumentDetailDrawer
        argumentId={selectedArgumentId}
        isOpen={!!selectedArgumentId}
        onClose={() => setSelectedArgumentId(null)}
      />

      <SubmitArgumentModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onComplete={handleSubmitComplete}
      />
    </Theme>
  );
}

export default App;
