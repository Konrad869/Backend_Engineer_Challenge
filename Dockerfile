
FROM oven/bun:1


WORKDIR /usr/src/app


COPY . .

RUN bun install


EXPOSE 3000


ENTRYPOINT bun start
