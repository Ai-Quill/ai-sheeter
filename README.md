# AI Sheet Backend

This project serves as the backend for the AI Sheet Google Sheets Add-on, providing a flexible API to interact with various AI models including ChatGPT, Claude, Groq, and Gemini.

## Features

- RESTful API endpoint for querying multiple AI models
- Integration with Supabase for secure API key management
- Support for ChatGPT, Claude, Groq, and Gemini AI models
- Easy extensibility for adding new AI models

## Tech Stack

- Next.js
- TypeScript
- Supabase
- Axios

## Prerequisites

- Node.js (v14 or later)
- npm or yarn
- Supabase account and project
- API keys for the AI models you want to use

## Setup

1. Clone the repository:
   ```
   git clone https://github.com/YOUR_USERNAME/ai-sheet-backend.git
   cd ai-sheet-backend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env.local` file in the root directory with the following content:
   ```
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Set up your Supabase database:
   - Create a table named `api_keys` with columns:
     - `id` (uuid, primary key)
     - `user_id` (text)
     - `model` (text)
     - `api_key` (text)

## Development

Run the development server. 
Let's go. 
