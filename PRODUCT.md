# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React, TypeScript, and Vite for the client; the existing Actix Web server for static files and WebRTC signaling.

## Users

People joining one-to-one or small-group video calls, and people hosting or watching small-group livestreams. Calls and livestreams have equal priority.

## Product Purpose

Let people connect in browser-based video rooms for direct calls, group calls, and livestreams using WebRTC.

## Positioning

A browser-first place to start or join real-time video rooms, with familiar collaboration patterns inspired by Discord and Google Meet.

## Operating Context

Users need to start or join a room, grant camera and microphone access when relevant, and manage their media during a live session.

## Capabilities and Constraints

- The client uses React, TypeScript, and Vite.
- Live media uses WebRTC with WebSocket signaling.
- One-to-one and small-group calls and livestreams are in scope.
- Peer-to-peer mesh is suitable for small rooms only; larger broadcast audiences require an SFU.
- The existing server is a small Actix Web application.

## Evidence on Hand

No brand assets, customer evidence, or product copy were supplied. Do not invent testimonials, audience numbers, or service guarantees.

## Product Principles

- Make starting and joining a live room straightforward.
- Treat one-to-one calls, group calls, and livestreams as first-class use cases.
- Make camera and microphone state visible and controllable.
- Communicate connection and permission problems with a clear recovery path.
