# Stage 1: Build the static assets
FROM node:20-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# VITE_API_URL is baked in at build time
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copy built assets to nginx html directory
COPY --from=build /app/dist /usr/share/nginx/html

# Write nginx config template (PORT is substituted at startup)
RUN mkdir -p /etc/nginx/templates && \
    printf 'server {\n\
    listen ${PORT};\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/templates/default.conf.template

# Railway provides $PORT; default to 80 for local Docker
ENV PORT=80

CMD ["nginx", "-g", "daemon off;"]
