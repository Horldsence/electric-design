# src/components/

## OVERVIEW
React 19 frontend components - console interface, log viewer, schematic viewer, workspace selector.

## STRUCTURE

```
ConsoleInterface.tsx    # Main UI shell (sidebar + main area)
LogViewer.tsx           # Real-time log display
SchematicViewer.tsx     # Circuit visualization
WorkspaceSelector.tsx   # Project/workspace switching
```

## WHERE TO LOOK

**Component hierarchy**: `ConsoleInterface.tsx` line 36 - Renders Sidebar + MainPanel

**Log streaming**: `LogViewer.tsx` line 18 - WebSocket subscription to `/ws`

**Schematic rendering**: `SchematicViewer.tsx` line 24 - `circuit-to-svg` integration

**Workspace list**: `WorkspaceSelector.tsx` line 12 - `projects/` directory scanning

## CONVENTIONS

**React 19 patterns**: No external state management - use hooks + context

**TypeScript**: Strict typing with interfaces for props

**CSS modules**: Component-scoped styles (if any)

**Error boundaries**: Each component should handle its own error states

## ANTI-PATTERNS

**Business logic**: Keep components thin - delegate to `src/services/`

**Direct API calls**: Use WebSocket via `src/hooks/use-socket.ts`, don't duplicate fetch logic

**Hardcoded strings**: Move messages to constants or i18n

**Missing loading states**: All async operations need loading/error UI
