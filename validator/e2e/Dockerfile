FROM node:8

RUN mkdir /stuff
WORKDIR /stuff

COPY ./validator/e2e/package.json .
COPY ./validator/e2e/package-lock.json .

COPY ./contracts ./contracts

RUN npm install --unsafe-perm

RUN cd contracts && \
  npm install && \
  ./node_modules/.bin/truffle compile && \
  cd deploy && \
  npm install

COPY ./validator/e2e .

CMD ["npm", "start"]
