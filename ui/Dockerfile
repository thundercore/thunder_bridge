FROM node:14 as builder
WORKDIR /app
COPY . .
RUN git config --global url."https://".insteadOf git://
RUN yarn
RUN yarn build

FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
