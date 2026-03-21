import { Box, Button, Container, Flex, Skeleton, Stack, Text, Theme } from "@chakra-ui/react";
import { useCallback, useState } from "react";
import { useLeaderboard } from "./hooks/useLeaderboard.ts";
import { useWeights } from "./hooks/useWeights.ts";
import { useColorMode } from "./hooks/useColorMode.ts";
import { TopicHeader } from "./components/TopicHeader.tsx";
import { WeightSliderPanel } from "./components/WeightSliderPanel.tsx";
import { Leaderboard } from "./components/Leaderboard.tsx";
import { ArgumentDetailDrawer } from "./components/ArgumentDetailDrawer.tsx";
import { SubmitArgumentModal } from "./components/SubmitArgumentModal.tsx";
import { ColorModeButton } from "./components/ColorModeButton.tsx";

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
            <ColorModeButton
              appearance={appearance}
              onToggle={toggleColorMode}
            />
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

          {topic && <TopicHeader topic={topic} />}

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
