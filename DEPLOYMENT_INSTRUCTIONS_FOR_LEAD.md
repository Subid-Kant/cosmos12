# Bug Arena — Grand Live Event Deployment Guide

You now have a **Production-Ready Backend** designed to handle 100+ concurrent students, with rate-limiting, security headers (Helmet), compression, and seamless database integration.

Since InfinityFree (`cosmos.42web.io`) **only supports PHP and static files**, you MUST deploy the Node.js backend to a separate cloud provider.

Follow these steps carefully to go live.

---

## 🟢 PHASE 1: Deploy the Database (MongoDB Atlas)
Your local MongoDB is great for testing, but you need a cloud database for the live event.
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and create an account.
2. Create a **Free Cluster (M0)**.
3. Under **Database Access**, create a user (e.g., `bugarena_admin`) and save the password.
4. Under **Network Access**, click "Add IP Address" -> Allow Access From Anywhere (`0.0.0.0/0`).
5. Under **Databases**, click "Connect" -> "Drivers" -> Node.js.
6. Copy the connection string. It looks like:
   `mongodb+srv://bugarena_admin:<password>@cluster0.xxxxx.mongodb.net/bugarena?retryWrites=true&w=majority`
*(Replace `<password>` with the password you created).*

---

## 🚀 PHASE 2: Deploy the Backend (Render.com)
We've added a `render.yaml` file, making deployment almost 1-click.
1. Push this entire repository (including the `server/` folder) to GitHub.
2. Go to [Render.com](https://render.com) and sign in.
3. Click **New +** -> **Blueprint**.
4. Connect your GitHub repository.
5. Render will automatically detect the `render.yaml` file and set up the **bug-arena-backend** service.
6. In the Render Dashboard for your new web service, go to **Environment**, and fill in the missing values:
   - `MONGO_URI`: (Paste the Atlas string from Phase 1)
7. Save changes. Render will build and start your server.
8. Copy your new Render URL (e.g., `https://bug-arena-backend.onrender.com`).

---

## 🌐 PHASE 3: Build & Deploy Frontend to 42web.io
Now tell the frontend to talk to your new Render backend.

1. Open `.env` in the root of the project (NOT `server/.env`).
2. Change the `VITE_API_URL` to point to your new Render backend URL:
   ```env
   VITE_API_URL=https://bug-arena-backend.onrender.com/api
   ```
   *(Make sure to append `/api` if you need to, or `/api/registry` depending on your frontend setup. Based on your code, it should be:)*
   ```env
   VITE_API_URL=https://bug-arena-backend.onrender.com/api/registry
   ```
3. In your terminal, run the build command:
   ```bash
   npm run build
   ```
4. This creates a `dist/` folder containing the static HTML/JS/CSS.
5. Upload the **contents** of the `dist/` folder to `htdocs/` on your InfinityFree (cosmos.42web.io) hosting via FTP (FileZilla) or their web file manager.

---

## 🎉 DONE!
Your Bug Arena is now live, scalable, and secure for the main event!
