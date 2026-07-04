# Use Node.js 20
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Generate Prisma client (required for your DB operations)
RUN npx prisma generate

# Build the TypeScript code
RUN npx tsc --skipLibCheck --noEmit false || true

# Expose the API port
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start"]