import { Box } from "@chakra-ui/react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import type { ScoreResponse } from "../types/index.ts";
import { RUBRIC_META, RUBRICS } from "../types/index.ts";

interface ScoreRadarChartProps {
  scores: ScoreResponse[];
}

export function ScoreRadarChart({ scores }: ScoreRadarChartProps) {
  const scoreMap = new Map(scores.map((s) => [s.rubric, s.score]));

  const data = RUBRICS.map((rubric) => ({
    rubric: RUBRIC_META[rubric].name,
    score: scoreMap.get(rubric) ?? 0,
    fullMark: 10,
  }));

  return (
    <Box w="100%" maxW="280px" mx="auto">
      <ResponsiveContainer width="100%" height={250}>
        <RadarChart data={data} outerRadius="75%">
          <PolarGrid stroke="var(--chakra-colors-border)" />
          <PolarAngleAxis dataKey="rubric" tick={{ fontSize: 11 }} />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 10]}
            tick={{ fontSize: 10 }}
            tickCount={6}
          />
          <Radar
            name="Score"
            dataKey="score"
            stroke="#6366f1"
            fill="#6366f1"
            fillOpacity={0.25}
            dot={{ r: 4, fill: "#6366f1" }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </Box>
  );
}
