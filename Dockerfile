# Backend Dockerfile - NestJS with Node Alpine

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci  && npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build

FROM node:20

# Set working directory
WORKDIR /app

# Copy only package files first for caching
COPY package*.json ./

# Install dependencies (dev + prod)
RUN npm install

# Copy the rest of the source code
COPY . .

# Build the app
RUN npm run build

# Expose and run
EXPOSE 3000
CMD ["node", "dist/main.js"]