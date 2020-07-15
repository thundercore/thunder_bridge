FROM node:10

WORKDIR /app
COPY package.json .
COPY package-lock.json .
RUN npm install
COPY index.js /app

CMD ["node", "index.js"]