FROM node:10

RUN apt-get update -yq && \
	apt-get install -yq build-essential libc6-dev libc6-dev-i386 wget && \
	rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json .
COPY package-lock.json .
RUN npm install

COPY . .
RUN npm run tsc
CMD ["docker-message"]