# Nexus - Bug Arena Grand Live Event

Welcome to the **Nexus** platform! This repository contains the full-stack codebase for the Bug Arena Grand Live Event. 

## 🌟 Overview

Nexus is an immersive, 3D web experience built with React, Three.js, and GSAP. It acts as the central hub for various events, including:
- **Events**
- **Hackathons**
- **Puzzles**
- **Bug Arena**
- **Learning Modules**

The platform features a visually stunning, mouse-driven particle assembly in the background using `@react-three/fiber` and a robust backend designed for scalability and high concurrency.

## 🛠️ Tech Stack

**Frontend:**
- React (v19)
- Vite
- Three.js & @react-three/fiber (3D Graphics)
- GSAP (Animations)

**Backend:**
- Node.js & Express
- MongoDB (via Mongoose)
- Security: Helmet, CORS, Rate Limiting

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- MongoDB instance (Local or Atlas)

### Local Development Setup

1. **Frontend Setup (Root Directory):**
   ```bash
   # Install dependencies
   npm install

   # Configure environment variables (copy .env.example)
   cp .env.example .env

   # Start the development server
   npm run dev
   ```
   The frontend will be available at `http://localhost:5173`.

2. **Backend Setup (Server Directory):**
   ```bash
   # Navigate to the server directory
   cd server

   # Install backend dependencies
   npm install

   # Start the backend server
   npm run dev
   ```

## 🌐 Deployment
For production deployment, refer to the [Deployment Instructions](DEPLOYMENT_INSTRUCTIONS_FOR_LEAD.md). 
- **Frontend** can be hosted as static files on services like InfinityFree or Vercel/Netlify.
- **Backend** is configured to be easily deployed on Render using the provided `render.yaml`.



