# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# .env.production은 build context에 넣지 않는다. BuildKit secret으로 잠깐
# 마운트하고 NEXT_PUBLIC_* 값만 별도 build 프로세스에 전달한다.
RUN --mount=type=secret,id=env_production,required=true \
    node scripts/build-with-public-env.mjs /run/secrets/env_production

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# nodemailer 는 동적 require 가 있어 Next standalone 파일추적이 누락한다.
# (의존성 0개 패키지라) node_modules 로 직접 복사해 런타임 resolve 보장.
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/nodemailer ./node_modules/nodemailer
# 멀티코어 클러스터 래퍼 (server.js 옆에 배치)
COPY --chown=nextjs:nodejs cluster-server.js ./

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
# 워커 수 (공유 서버라 기본 4로 제한, 필요시 조정). cluster-server.js 가 참조.
ENV WEB_CONCURRENCY=4

# 단일 프로세스(server.js) 대신 멀티코어 클러스터로 SSR 부하 분산
CMD ["node", "cluster-server.js"]
