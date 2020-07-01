FROM node:10

RUN mkdir /stuff
WORKDIR /stuff

COPY ./package.json .
COPY ./package-lock.json .

RUN npm install --unsafe-perm

COPY . .

CMD ["npm", "start"]
