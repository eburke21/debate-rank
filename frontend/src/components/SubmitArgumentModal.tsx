import {
  Box,
  Button,
  Dialog,
  Flex,
  Input,
  Portal,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useCallback, useState } from "react";
import { submitArgument } from "../api/client.ts";
import { useArgumentPolling } from "../hooks/useArgumentPolling.ts";
import { RUBRICS } from "../types/index.ts";
import { ScoringProgress } from "./ScoringProgress.tsx";

type Phase = "drafting" | "scoring" | "complete";

interface SubmitArgumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (argumentId: string) => void;
}

function getCharCountColor(len: number): string {
  if (len > 2000) return "red.500";
  if (len >= 1800) return "yellow.500";
  if (len >= 50) return "green.500";
  return "fg.muted";
}

export function SubmitArgumentModal({
  isOpen,
  onClose,
  onComplete,
}: SubmitArgumentModalProps) {
  const [phase, setPhase] = useState<Phase>("drafting");
  const [body, setBody] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { status, scores, compositeScore, isComplete, error: pollError } =
    useArgumentPolling({
      argumentId: submittedId,
      enabled: phase === "scoring",
    });

  // Transition to complete when polling finishes
  if (phase === "scoring" && isComplete) {
    setPhase("complete");
  }

  const charCount = body.length;
  const isValid = charCount >= 50 && charCount <= 2000;

  const handleSubmit = useCallback(async () => {
    try {
      setSubmitError(null);
      const result = await submitArgument(
        body,
        authorName.trim() || undefined,
      );
      setSubmittedId(result.id);
      setPhase("scoring");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to submit argument";
      setSubmitError(message);
    }
  }, [body, authorName]);

  const handleReset = useCallback(() => {
    setPhase("drafting");
    setBody("");
    setAuthorName("");
    setSubmittedId(null);
    setSubmitError(null);
  }, []);

  const handleViewOnLeaderboard = useCallback(() => {
    if (submittedId) {
      onComplete(submittedId);
    }
    handleReset();
    onClose();
  }, [submittedId, onComplete, handleReset, onClose]);

  const handleClose = useCallback(() => {
    // Only allow closing during drafting or complete phases
    if (phase === "scoring") return;
    handleReset();
    onClose();
  }, [phase, handleReset, onClose]);

  const allScored =
    scores.length === RUBRICS.length && status === "scored";

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(e) => {
        if (!e.open) handleClose();
      }}
      placement="center"
      size="lg"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.CloseTrigger />
            <Dialog.Header>
              <Dialog.Title>
                {phase === "drafting" && "Submit an Argument"}
                {phase === "scoring" && "Evaluating Your Argument"}
                {phase === "complete" && "Evaluation Complete"}
              </Dialog.Title>
            </Dialog.Header>

            <Dialog.Body>
              {/* ── Drafting phase ── */}
              {phase === "drafting" && (
                <Stack gap={4}>
                  <Box>
                    <Textarea
                      placeholder="Write your argument here (50–2000 characters)..."
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={8}
                      resize="vertical"
                    />
                    <Flex justify="space-between" mt={1}>
                      <Text fontSize="xs" color={getCharCountColor(charCount)}>
                        {charCount} / 2000
                      </Text>
                      {charCount > 0 && charCount < 50 && (
                        <Text fontSize="xs" color="fg.muted">
                          {50 - charCount} more characters needed
                        </Text>
                      )}
                    </Flex>
                  </Box>

                  <Input
                    placeholder="Your name (optional)"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    size="sm"
                  />

                  {submitError && (
                    <Box
                      p={3}
                      borderWidth="1px"
                      borderRadius="md"
                      borderColor="red.500"
                      bg="red.50"
                    >
                      <Text fontSize="sm" color="red.700">
                        {submitError}
                      </Text>
                    </Box>
                  )}
                </Stack>
              )}

              {/* ── Scoring phase ── */}
              {phase === "scoring" && (
                <Stack gap={4}>
                  <Box
                    p={3}
                    borderRadius="md"
                    bg="bg.subtle"
                    opacity={0.6}
                  >
                    <Text fontSize="sm" lineClamp={3}>
                      {body}
                    </Text>
                  </Box>

                  <Text fontSize="sm" textAlign="center" color="fg.muted">
                    4 AI judges are evaluating your argument...
                  </Text>

                  <ScoringProgress scores={scores} status={status} />

                  {pollError && (
                    <Text fontSize="sm" color="red.500" textAlign="center">
                      {pollError}
                    </Text>
                  )}
                </Stack>
              )}

              {/* ── Complete phase ── */}
              {phase === "complete" && (
                <Stack gap={4}>
                  {allScored ? (
                    <>
                      <Text fontSize="sm" textAlign="center" color="green.500">
                        All 4 judges have evaluated your argument!
                      </Text>
                      <ScoringProgress scores={scores} status={status} />
                      {compositeScore != null && (
                        <Text
                          fontSize="lg"
                          fontWeight="bold"
                          textAlign="center"
                        >
                          Composite Score: {compositeScore.toFixed(1)}
                        </Text>
                      )}
                    </>
                  ) : status === "failed" ? (
                    <>
                      <Text fontSize="sm" textAlign="center" color="red.500">
                        Evaluation failed. Please try again.
                      </Text>
                      <ScoringProgress scores={scores} status={status} />
                    </>
                  ) : (
                    <>
                      <Text
                        fontSize="sm"
                        textAlign="center"
                        color="yellow.500"
                      >
                        Partial evaluation — some judges completed.
                      </Text>
                      <ScoringProgress scores={scores} status={status} />
                      {compositeScore != null && (
                        <Text
                          fontSize="lg"
                          fontWeight="bold"
                          textAlign="center"
                        >
                          Composite Score: {compositeScore.toFixed(1)}
                        </Text>
                      )}
                    </>
                  )}
                </Stack>
              )}
            </Dialog.Body>

            <Dialog.Footer>
              {phase === "drafting" && (
                <Flex gap={2} w="100%" justify="flex-end">
                  <Button variant="ghost" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button
                    colorPalette="blue"
                    disabled={!isValid}
                    onClick={() => void handleSubmit()}
                  >
                    Submit for Judging
                  </Button>
                </Flex>
              )}

              {phase === "complete" && (
                <Flex gap={2} w="100%" justify="flex-end">
                  {status === "failed" && (
                    <Button variant="ghost" onClick={handleReset}>
                      Try Again
                    </Button>
                  )}
                  <Button
                    colorPalette="blue"
                    onClick={handleViewOnLeaderboard}
                  >
                    View on Leaderboard
                  </Button>
                </Flex>
              )}
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
