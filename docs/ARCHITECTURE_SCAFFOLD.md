# NetworkSpace AI Coach — Architecture Scaffold

## Purpose
We are building an internal staff AI coaching platform.

This is NOT a demo auth app.
This is NOT a generic chatbot.

The system must:
- Identify a staff member
- Store their conversations
- Track structured activity (check-ins, metrics)
- Allow managers to view team activity
- Maintain long-term history safely
- Control AI cost through structured context

---

## Core Principle
We are proving identity first.
Everything else depends on reliable user identity.

Current Phase: Phase 1 — Authentication Reliability

Definition of done:
A user logs in -> refresh -> still authenticated -> protected routes blocked when logged out.

We are NOT building:
- roles
- tables
- chat
- analytics
until identity persistence works.

---

## Tech Stack (Locked)
Frontend/Server:
- Next.js App Router

Auth + Database:
- Supabase (Auth + Postgres + RLS)

Automation (later):
- n8n

AI:
- LLM via server route (later phase)

---

## Architecture Rules
1) Next.js handles UI + routing only
2) Supabase enforces security (never client logic)
3) No database schema until auth stable
4) No AI calls until chat persistence exists
5) No automation until events exist

---

## Folder Intent (High level)

app/
  login -> authentication entry
  app -> employee interface
  manager -> manager dashboard
  api -> server logic

lib/
  supabase/ -> auth clients only

docs/
  architecture + decisions

---

## What the Agent Must NOT Do
- Do not add profile tables
- Do not add example dashboards
- Do not add styling libraries
- Do not invent business logic
- Do not abstract prematurely

If unsure -> ask instead of guessing.

---

## Current Goal For The Agent
Implement reliable Supabase authentication using SSR:
- browser client
- server client
- session persistence
- protected route redirect

Stop once authentication persistence works.
