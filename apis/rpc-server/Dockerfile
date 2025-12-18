FROM oven/bun:1.2.19@sha256:31f25ad4c661322a3dc9d9d98fbf34989502b1ea588a2ca629da98c8e5a2d116 as build

WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile --prefer-offline --ignore-scripts

ARG TURBO_TEAM
ENV TURBO_TEAM=$TURBO_TEAM
ARG TURBO_TOKEN
ENV TURBO_TOKEN=$TURBO_TOKEN
RUN bun turbo build:bin --filter @pbnjam/rpc-api

FROM gcr.io/distroless/base-debian11
WORKDIR /app
COPY --from=build /app/apis/info/bin /app/bin

CMD [ "/app/bin" ]
