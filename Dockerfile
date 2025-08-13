FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Bundle app source
COPY . .

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Create volume for persistent configuration
VOLUME ["/usr/src/app/config"]

# Expose port
EXPOSE 3000

# Run the application
CMD ["node", "src/index.js"]