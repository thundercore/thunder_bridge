FROM node:10

RUN mkdir /stuff
WORKDIR /stuff

COPY ./package.json .
COPY ./package-lock.json .

RUN git config --global url."https://".insteadOf git:// && npm install --unsafe-perm

COPY . .

CMD ["npm", "start"]
