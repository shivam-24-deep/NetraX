# NetraX investigation API (Render / any Docker host).
# Build context is the repository root:  docker build -f server/Dockerfile .
#
# Node 24 runs the TypeScript sources directly (no build step) and the code has
# no npm dependencies, so the image is just the runtime plus two source folders.
FROM node:24-slim

WORKDIR /app
ENV NODE_ENV=production

COPY server ./server
COPY supabase/functions/_shared ./supabase/functions/_shared

# The sources are ES modules in .ts files; say so explicitly rather than
# relying on Node's syntax auto-detection.
RUN echo '{"type":"module"}' > package.json

# Run as the unprivileged "node" user that ships with the image.
USER node

# The platform provides PORT (Render: 10000); local-api.ts reads it.
EXPOSE 10000
CMD ["node", "server/local-api.ts"]
