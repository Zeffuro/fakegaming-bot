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
WORKDIR /app/code

COPY package*.json ./

# Install the Node.js dependencies
RUN npm install
RUN npm run build

# The command to run your bot, relative to the WORKDIR
CMD ["node", "packages/bot/dist/index.js"]