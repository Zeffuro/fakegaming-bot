# Use the official Node.js 22 slim image as the base
FROM node:22-slim

# Install git and other system dependencies for 'canvas'
RUN apt-get update && apt-get install -y \
    git \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app

# Add a unique argument to break the cache on every build
ARG CACHEBUST=2

# Clone your bot's repository
RUN git clone https://github.com/Zeffuro/fakegaming-bot.git .

# Install the Node.js dependencies
RUN npm install

# Command to run the bot using ts-node
CMD ["node", "--loader", "ts-node/esm", "src/index.ts"]