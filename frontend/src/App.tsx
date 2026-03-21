import { Box, Button, Container, Flex, Text } from "@chakra-ui/react";
import { useCallback, useState } from "react";
import { useLeaderboard } from "./hooks/useLeaderboard.ts";
import { useWeights } from "./hooks/useWeights.ts";
import { TopicHeader } from "./components/TopicHeader.tsx";
import { WeightSliderPanel } from "./components/WeightSliderPanel.tsx";
import { Leaderboard } from "./components/Leaderboard.tsx";
import { ArgumentDetailDrawer } from "./components/ArgumentDetailDrawer.tsx";
import { SubmitArgumentModal } from "./components/SubmitArgumentModal.tsx";

function App() {
  const {
    topic,
    arguments: args,
    loading,
    error,
    refetch,
  } = useLeaderboard();
  const { weights, setWeight, resetWeights } = useWeights();
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
    <Box minH="100vh" bg="bg" py={8}>
      <Container maxW="900px">
        {error && (
          <Box
            p={4}
            mb={4}
            borderWidth="1px"
            borderRadius="md"
            borderColor="red.500"
            bg="red.50"
          >
            <Text color="red.700">{error}</Text>
          </Box>
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
    </Box>
  );
}

export default App;
