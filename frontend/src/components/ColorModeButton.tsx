import { IconButton } from "@chakra-ui/react";

interface ColorModeButtonProps {
  appearance: "light" | "dark";
  onToggle: () => void;
}

export function ColorModeButton({
  appearance,
  onToggle,
}: ColorModeButtonProps) {
  return (
    <IconButton
      aria-label={`Switch to ${appearance === "light" ? "dark" : "light"} mode`}
      variant="ghost"
      size="sm"
      onClick={onToggle}
      fontSize="lg"
    >
      {appearance === "light" ? "🌙" : "☀️"}
    </IconButton>
  );
}
