This is a [Next.js](https://nextjs.org) app that chats with a **local LM Studio server** (OpenAI-compatible API).

## Getting Started

### 1) Start LM Studio local server

- In LM Studio, load a model.
- Start the server with the **OpenAI compatible** option.
- Default base URL is usually `http://localhost:1234/v1`.

### 2) Configure environment variables

This repo includes a `.env` you can edit, and a `.env.example` as reference:

- `LMSTUDIO_API_BASE_URL` (example: `http://localhost:1234/v1`)
- `LMSTUDIO_MODEL` (must match the model id LM Studio exposes, e.g. `google/gemma-4-e4b`)
- `LMSTUDIO_API_KEY` (usually can be empty for local LM Studio)

### 3) Run the dev server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

The UI calls `POST /api/chat`, which proxies requests to your local LM Studio server.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
