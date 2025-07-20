# CLAUDE.md - GraphQL Explorer Development Guide

必ず日本語で回答してください。

## Project Overview

This is a **full-stack GraphQL client application** built with modern web technologies. It serves as a GraphQL explorer and testing tool, similar to GraphiQL or Apollo Studio, allowing users to write GraphQL queries, set headers, variables, and execute requests against any GraphQL endpoint.

## Architecture Summary

### Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript (ES modules)
- **UI Framework**: Radix UI components with shadcn/ui design system
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query for server state, React hooks for local state
- **Database**: Drizzle ORM + PostgreSQL (Neon Database)
- **Code Editor**: Monaco Editor (simplified to text areas due to worker issues)
- **Routing**: Wouter for lightweight client-side routing

### Project Structure

```
/
├── client/                    # Frontend React application
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/           # shadcn/ui component library
│   │   │   └── monaco-editor.tsx
│   │   ├── hooks/            # Custom React hooks
│   │   ├── lib/              # Utilities and client libraries
│   │   ├── pages/            # Application pages
│   │   └── main.tsx         # App entry point
│   └── index.html
├── server/                   # Backend Express application
│   ├── index.ts             # Server entry point
│   ├── routes.ts            # Route registration
│   ├── storage.ts           # Storage abstraction layer
│   └── vite.ts              # Vite integration
├── shared/                   # Shared TypeScript types and schemas
│   └── schema.ts            # Drizzle database schema
├── package.json
├── vite.config.ts           # Vite configuration
├── tsconfig.json            # TypeScript configuration
├── tailwind.config.ts       # Tailwind CSS configuration
└── drizzle.config.ts        # Database configuration
```

## Key Scripts & Commands

### Development

```bash
npm run dev          # Start development server (client + server)
npm run check        # TypeScript type checking
```

### Production

```bash
npm run build        # Build both client and server
npm start           # Start production server
```

### Database

```bash
npm run db:push     # Push schema changes to database
```

## Core Features & Components

### 1. GraphQL Client Page (`client/src/pages/graphql-client.tsx`)

- **Main interface** for GraphQL operations
- **Resizable layout** with adjustable query editor and response panels
- **Multi-endpoint management** with persistent storage
- **Query history** with automatic saving (up to 50 queries per endpoint)
- **Variables and headers** management
- **Schema introspection** with documentation viewer
- **Import/Export** functionality for all data

### 2. Endpoint Management

- **Multiple endpoints** support with easy switching
- **Per-endpoint configuration**: headers, query history, last-used tracking
- **Default endpoint**: Countries API (https://countries.trevorblades.com/)
- **Persistent storage** via localStorage

### 3. GraphQL Client Library (`client/src/lib/graphql-client.ts`)

- **Type-safe GraphQL client** with TypeScript interfaces
- **Response metrics**: timing, size, status codes
- **Error handling** for network and GraphQL errors
- **Connection testing** functionality

### 4. UI Components

- **Complete shadcn/ui library** in `client/src/components/ui/`
- **Monaco Editor wrapper** (simplified to textarea due to worker issues)
- **Responsive design** with mobile support
- **Dark/light theme** support via CSS variables

## Development Workflow

### Getting Started

1. **Clone and install**: `npm install`
2. **Set up database**: Configure `DATABASE_URL` environment variable
3. **Push schema**: `npm run db:push`
4. **Start development**: `npm run dev`

### Development Environment

- **Frontend**: `http://localhost:5173` (Vite dev server)
- **Backend**: Express server with live reload
- **Hot Module Replacement**: Enabled for fast development

### Production Environment

- **Single Express server** serving both static files and API
- **Port**: Uses `PORT` environment variable (default: 8081)
- **Optimized builds** with code splitting

## Data Management

### Local Storage

- **Endpoints configuration**: `graphql-client-endpoints`
- **Current endpoint**: `graphql-client-current-endpoint`
- **Query editor height**: `graphql-client-query-height`

### Data Structure

```typescript
interface EndpointConfig {
  id: string;
  name: string;
  url: string;
  headers: Header[];
  history: QueryHistory[];
  lastUsed: number;
}

interface QueryHistory {
  id: string;
  query: string;
  variables: string;
  endpoint: string;
  timestamp: number;
  name?: string;
}
```

## Configuration Files

### TypeScript (`tsconfig.json`)

- **Path aliases**: `@/*` for client src, `@shared/*` for shared
- **ES modules** with bundler module resolution
- **Strict mode** enabled

### Vite (`vite.config.ts`)

- **React plugin** with HMR
- **Path aliases** matching TypeScript config
- **Build output**: `dist/public` for client assets

### Tailwind (`tailwind.config.ts`)

- **shadcn/ui configuration** with CSS variables
- **Typography plugin** included
- **Animation utilities** enabled

### Database (`drizzle.config.ts`)

- **PostgreSQL dialect**
- **Schema**: `./shared/schema.ts`
- **Migrations**: `./migrations` directory

## Key Features Deep Dive

### 1. Query History

- **Automatic saving** on successful query execution
- **Per-endpoint storage** (up to 50 queries each)
- **Metadata tracking**: query name, timestamp, variables
- **Quick restore** functionality

### 2. Schema Documentation

- **Introspection queries** to fetch GraphQL schema
- **Interactive documentation** similar to Altair GraphQL Client
- **Type navigation** with clickable type references
- **Root types display** (Query, Mutation, Subscription)

### 3. Import/Export

- **Full data export**: endpoints, settings, history
- **Individual endpoint export**
- **JSON format** with versioning
- **Merge capability** on import

### 4. Resizable Layout

- **Drag-to-resize** between query editor and response
- **Height persistence** via localStorage
- **20%-80% constraints** for usability

## Common Development Tasks

### Adding New UI Components

1. Use shadcn/ui CLI: `npx shadcn-ui@latest add [component]`
2. Components auto-installed to `client/src/components/ui/`
3. Follow existing patterns for styling and props

### Modifying GraphQL Client

- **Main logic**: `client/src/lib/graphql-client.ts`
- **Type definitions** at top of file
- **Error handling** for network and response errors

### Database Schema Changes

1. **Modify**: `shared/schema.ts`
2. **Generate migration**: `npm run db:push`
3. **Types automatically** updated via Drizzle

### Adding New Pages

1. **Create** in `client/src/pages/`
2. **Update routing** in `client/src/App.tsx`
3. **Follow existing** TypeScript patterns

## Environment Variables

### Required

- `DATABASE_URL`: PostgreSQL connection string (Neon Database)

### Optional

- `PORT`: Server port (default: 5000)
- `NODE_ENV`: Environment mode (development/production)

## Testing

Currently **no test setup** is configured. Consider adding:

- **Vitest** for unit testing
- **React Testing Library** for component testing
- **Playwright** for e2e testing

## Deployment Considerations

### Build Process

1. **Frontend build**: Vite builds to `dist/public`
2. **Backend build**: esbuild bundles to `dist/index.js`
3. **Production**: Single Node.js process serves everything

### Database Setup

- **Neon Database** (serverless PostgreSQL) recommended
- **Migrations** managed via Drizzle Kit
- **Connection pooling** handled by Neon

### Performance

- **Code splitting** enabled in Vite build
- **Asset optimization** via Vite
- **Server-side caching** can be added to Express routes

## Known Issues & Limitations

1. **Monaco Editor**: Simplified to textarea due to worker issues in current setup
2. **No authentication**: Currently no user system implemented
3. **Client-side storage**: All data stored in localStorage (no server persistence for user data)
4. **No real-time features**: Consider WebSocket integration for collaborative features

## Recent Updates (as of July 2025)

- **Multi-endpoint management** with persistent storage
- **Import/Export functionality** for all data
- **Schema documentation** with introspection
- **Resizable layout** with drag-to-resize
- **Query history** with automatic saving
- **Simplified UI** removing unnecessary buttons

This codebase is well-structured for a modern React application with a clean separation between frontend and backend concerns. The TypeScript integration provides excellent developer experience with type safety throughout the stack.
