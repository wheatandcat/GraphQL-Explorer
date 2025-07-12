# GraphQL Client Application

## Overview

This is a full-stack GraphQL client application built with modern web technologies. The application serves as a GraphQL explorer and testing tool, similar to GraphiQL or Apollo Studio, allowing users to write GraphQL queries, set headers, variables, and execute requests against any GraphQL endpoint.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

- **December 12, 2024**: Implemented resizable layout for Query Editor and Response sections
  - Added drag-to-resize functionality between query editor and response panels
  - Implemented localStorage persistence for layout preferences
  - Query editor height adjustable between 20%-80% of available space
  - Resize bar with visual feedback on hover

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **Routing**: Wouter for lightweight client-side routing
- **UI Framework**: Radix UI components with shadcn/ui design system
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query for server state management
- **Code Editor**: Monaco Editor for GraphQL query editing with syntax highlighting

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM configured for PostgreSQL
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **Session Management**: Express sessions with PostgreSQL store
- **Development**: tsx for TypeScript execution in development

### Key Components

#### Frontend Components
1. **GraphQL Client Page** (`client/src/pages/graphql-client.tsx`)
   - Main interface for GraphQL operations
   - Resizable layout with adjustable query editor and response panels
   - Text area editors for query writing and variable input
   - Request headers and variables management
   - Response display with formatting and status indicators
   - LocalStorage persistence for layout preferences

2. **Monaco Editor Component** (`client/src/components/monaco-editor.tsx`)
   - Simplified text area implementation (replaced Monaco due to worker issues)
   - GraphQL and JSON editing capabilities
   - Monospace font styling with proper formatting

3. **UI Components** (`client/src/components/ui/`)
   - Complete shadcn/ui component library
   - Radix UI primitives for accessibility
   - Consistent design system with CSS variables

#### Backend Components
1. **Storage Layer** (`server/storage.ts`)
   - Abstract storage interface
   - In-memory implementation for development
   - Ready for database integration with Drizzle ORM

2. **Routes** (`server/routes.ts`)
   - Express route registration
   - API endpoints with `/api` prefix
   - HTTP server creation and configuration

3. **Database Schema** (`shared/schema.ts`)
   - Drizzle schema definitions
   - User model with validation
   - Shared between client and server

### Data Flow

1. **GraphQL Request Flow**:
   - User enters GraphQL query in Monaco editor
   - Variables and headers configured in UI
   - Request sent to specified GraphQL endpoint
   - Response displayed with syntax highlighting and formatting

2. **Application State**:
   - Query editor state managed locally
   - Server responses cached with TanStack Query
   - UI state managed with React hooks

3. **Development Flow**:
   - Vite dev server for frontend with HMR
   - tsx for backend TypeScript execution
   - Shared types between frontend and backend

### External Dependencies

#### Core Dependencies
- **@neondatabase/serverless**: Serverless PostgreSQL driver
- **drizzle-orm**: Type-safe SQL ORM
- **@tanstack/react-query**: Server state management
- **monaco-editor**: Code editor (loaded dynamically)
- **@radix-ui/***: Accessible UI primitives
- **wouter**: Lightweight routing

#### Development Tools
- **Vite**: Frontend build tool and dev server
- **tsx**: TypeScript execution for Node.js
- **tailwindcss**: Utility-first CSS framework
- **drizzle-kit**: Database schema management

### Deployment Strategy

#### Build Process
1. **Frontend Build**: Vite builds React app to `dist/public`
2. **Backend Build**: esbuild bundles server code to `dist/index.js`
3. **Production**: Node.js serves bundled application

#### Database Setup
- Drizzle migrations in `./migrations` directory
- PostgreSQL database required (configured via `DATABASE_URL`)
- Schema managed through Drizzle Kit

#### Environment Configuration
- Development: Separate frontend (Vite) and backend (tsx) processes
- Production: Single Node.js process serving both static files and API
- Database URL required for PostgreSQL connection

#### Development vs Production
- **Development**: 
  - Frontend: `http://localhost:5173` (Vite dev server)
  - Backend: Express server with live reload
  - Hot module replacement enabled
- **Production**:
  - Single Express server serving static files and API
  - Optimized builds with code splitting
  - Environment-based configuration

The application is designed as a modern, type-safe GraphQL client with a focus on developer experience and performance. The architecture supports both development and production environments with appropriate tooling for each phase.