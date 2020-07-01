FROM node:10 AS contract

RUN mkdir /contracts
WORKDIR /contracts

COPY package.json .
COPY package-lock.json .

RUN npm install

COPY . .

RUN npm run compile && ./flatten.sh

FROM node:10


RUN mkdir -p /contracts/deploy
WORKDIR /contracts/deploy

COPY deploy/package.json .
COPY deploy/package-lock.json .

RUN npm install --unsafe-perm

COPY --from=contract /contracts/build/ /contracts/build/
COPY --from=contract /contracts/flats/ /contracts/flats/

COPY deploy .

VOLUME [ "/contracts" ]
CMD [ "npm", "run", "deploy" ]