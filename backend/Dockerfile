FROM oven/bun:1.3

RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package.json ./
RUN bun install --production

COPY prisma ./prisma
RUN bunx prisma generate --config prisma/prisma.config.ts

COPY . .

ENV NODE_ENV=production
EXPOSE 3700

CMD ["bun", "index.ts"]
