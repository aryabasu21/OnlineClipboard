FROM node:20-alpine
# NOTE: Scan image in CI (e.g., Trivy/Grype) and upgrade base image tag when patches released.
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY src ./src
EXPOSE 4000
CMD ["node","src/server.js"]
