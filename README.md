# Desktop Plan Widget (Electron + React + TypeScript + Tailwind)

A polished floating Windows productivity widget with todo planning, due-time reminders, completion prompts, and local persistence.

## Features

- Frameless transparent Electron desktop widget window
- Draggable, resizable, rounded, glassmorphism UI
- Pin/unpin and launch-on-startup controls
- Daily task planner with inline edit, complete, delete
- Due date/time + reminder lead time (including custom)
- Native desktop notifications for reminder and due check-ins
- Completion prompt with Completed / Snooze / Reschedule actions
- Daily progress ring and motivational quote area
- Local persistence via `localStorage` + window config in Electron userData

## Tech Stack

- Electron
- React + TypeScript
- Tailwind CSS
- Vite

## Project Structure

- `electron/main.ts` Electron main process, window lifecycle, IPC, notifications
- `electron/preload.ts` secure renderer bridge API
- `src/App.tsx` planner UI + task logic
- `src/hooks/useReminderEngine.ts` reminder scheduling + due prompts
- `src/components/*` modular UI components
- `src/lib/*` storage and productivity helpers
- `src/types/task.ts` shared task/reminder types

## Setup

```bash
npm install
```

## Run in Development

```bash
npm run dev
```

This runs Vite and Electron together.

## Build Production

```bash
npm run build
```

## Run Built App (local)

```bash
npm run start
```

## Package Windows EXE

```bash
npm run dist
```

Artifacts are generated in the `release` folder.

For portable build:

```bash
npm run dist:portable
```

## Notes

- Notifications use Electron native `Notification`.
- Tasks are stored in browser `localStorage`.
- Window pin/startup/position preferences are stored in Electron `userData/widget-config.json`.
