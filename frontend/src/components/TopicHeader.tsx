import { Badge, Box, Heading, Text } from "@chakra-ui/react";
import type { TopicResponse } from "../types/index.ts";

interface TopicHeaderProps {
  topic: TopicResponse;
}

export function TopicHeader({ topic }: TopicHeaderProps) {
  return (
    <Box mb={6}>
      <Heading size="xl" mb={2}>
        {topic.title}
      </Heading>
      {topic.description && (
        <Text color="fg.muted" fontSize="md" mb={2}>
          {topic.description}
        </Text>
      )}
      <Badge variant="subtle" colorPalette="gray" fontSize="xs">
        {topic.argument_count} argument{topic.argument_count !== 1 ? "s" : ""}
      </Badge>
    </Box>
  );
}
