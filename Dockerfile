FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ffmpeg \
    fonts-noto-cjk \
    python3 \
    python3-pil \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
COPY index.html server.js render_captions.py ./

ENV HOST=0.0.0.0
ENV PORT=5175
ENV PYTHON=python3
ENV SUBTITLE_FONT=/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc

EXPOSE 5175

CMD ["npm", "run", "start"]
