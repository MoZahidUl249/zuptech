import { t } from "elysia";

export const metricsQueryDto = t.Object({
  period: t.Optional(t.Union([t.Literal("week"), t.Literal("month"), t.Literal("year")])),
});

export type MetricsQueryDto = typeof metricsQueryDto.static;
