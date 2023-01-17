FROM node:8

WORKDIR /app
COPY package.json .
COPY package-lock.json .
RUN git config --global url."https://".insteadOf git:// && npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "start"]