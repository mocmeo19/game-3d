FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY index.html vite.config.ts tsconfig.json ./
COPY src ./src

# Public models and audio are copied directly into the runtime image below.
RUN npm run build

FROM nginx:stable-alpine AS runtime

COPY nginx.conf /etc/nginx/nginx.conf
COPY public /usr/share/nginx/html
COPY --from=build /app/dist /usr/share/nginx/html

USER nginx
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
