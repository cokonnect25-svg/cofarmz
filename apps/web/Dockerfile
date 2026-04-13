FROM node:18-alpine

WORKDIR /app

# go inside correct folder
COPY apps/web/package*.json ./

RUN npm install --legacy-peer-deps

# copy only web app
COPY apps/web .

RUN npm run build

EXPOSE 8080

ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

CMD ["npm", "start"]