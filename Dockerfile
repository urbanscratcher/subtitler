FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY index.html server.js ./

ENV HOST=0.0.0.0
ENV PORT=5175

EXPOSE 5175

CMD ["npm", "run", "start"]
