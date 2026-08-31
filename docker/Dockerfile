FROM mcr.microsoft.com/playwright:v1.48.0-jammy

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .

ENV TEST_ENV=dev
CMD ["npm", "run", "test:all"]
