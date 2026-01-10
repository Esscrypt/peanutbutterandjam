FROM oven/bun:1.3.5 as build

WORKDIR /app
COPY . .
RUN bun install --ignore-scripts

ARG TURBO_TEAM
ENV TURBO_TEAM=$TURBO_TEAM
ARG TURBO_TOKEN
ENV TURBO_TOKEN=$TURBO_TOKEN
RUN bun turbo build:bin --filter @pbnjam/rpc-api

FROM gcr.io/distroless/base-debian11
WORKDIR /app
COPY --from=build /app/apis/info/bin /app/bin

CMD [ "/app/bin" ]
