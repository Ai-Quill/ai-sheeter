# AI Sheet - Any LLM

## Project Overview

AI Sheet is a Google Sheets add-on that allows users to interact with various AI models directly from their spreadsheets. It supports multiple AI providers including ChatGPT, Claude, Groq, and Gemini.

## Architecture

The project consists of two main parts:
1. Google Apps Script (Front-end)
2. Next.js Backend (API Server)

### Front-end (Google Apps Script)

The front-end is built using Google Apps Script and is responsible for:
- Creating the user interface (sidebar)
- Handling user interactions
- Making API calls to the backend
- Encrypting and decrypting API keys

Key files:
- `Code.gs`: Main script file containing all the functions
- `Sidebar.html`: HTML file for the sidebar UI

### Back-end (Next.js)

The back-end is built with Next.js and handles:
- API requests from the front-end
- Interaction with AI providers
- User settings management
- Credit usage tracking

Key directories:
- `src/app/api`: Contains all API route handlers
- `src/lib`: Contains utility functions and configurations
- `src/utils`: Contains helper functions like encryption

## API Documentation

### 1. Get User Settings

- **Endpoint**: `/api/get-user-settings`
- **Method**: GET
- **Query Parameters**: 
  - `userEmail`: The email of the user
- **Response**: JSON object containing user settings

### 2. Save All Settings

- **Endpoint**: `/api/save-all-settings`
- **Method**: POST
- **Body**: 
  ```json
  {
    "userEmail": "user@example.com",
    "settings": {
      "CHATGPT": {
        "apiKey": "encrypted_api_key",
        "defaultModel": "gpt-4"
      },
      // ... other models
    }
  }
  ```
- **Response**: Confirmation message and saved data

### 3. Query AI Model

- **Endpoint**: `/api/query`
- **Method**: POST
- **Body**:
  ```json
  {
    "model": "CHATGPT",
    "input": "User's input text",
    "userEmail": "user@example.com",
    "specificModel": "gpt-4",
    "encryptedApiKey": "encrypted_api_key"
  }
  ```
- **Response**: AI model's response and credits used

### 4. Fetch Available Models

- **Endpoint**: `/api/models`
- **Method**: GET
- **Response**: List of available AI models

## Security

- API keys are encrypted on the client-side before being sent to the server
- Encryption salt is stored in Google Apps Script properties
- Decryption only occurs on the server-side when making API calls to AI providers

## Database Schema

The project uses Supabase with the following main tables:
1. `api_keys`: Stores encrypted API keys for each user and model
2. `models`: Stores information about available AI models
3. `credit_usage`: Tracks credit usage for each query

## Environment Variables

Backend environment variables are stored in `.env.local` and include:
- Supabase URL and keys
- Encryption salt

## Deployment

- Front-end: Deployed as a Google Sheets add-on
- Back-end: Deployed on Vercel

## Development Setup

1. Clone the repository
2. Set up the Google Apps Script project
3. Install dependencies for the Next.js backend
4. Set up environment variables
5. Run the development server

## Contributing

[Include guidelines for contributing to the project]

## License

[Specify the license under which the project is released]
