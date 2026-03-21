import { Box, Container, Text } from "@chakra-ui/react";
import { useLeaderboard } from "./hooks/useLeaderboard.ts";
import { useWeights } from "./hooks/useWeights.ts";
import { TopicHeader } from "./components/TopicHeader.tsx";
import { WeightSliderPanel } from "./components/WeightSliderPanel.tsx";
import { Leaderboard } from "./components/Leaderboard.tsx";

function App() {
  const { topic, arguments: args, loading, error } = useLeaderboard();
  const { weights, setWeight, resetWeights } = useWeights();

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
          onSelectArgument={(id) => console.log("Selected argument:", id)}
          loading={loading}
        />
      </Container>
    </Box>
  );
}

export default App;
